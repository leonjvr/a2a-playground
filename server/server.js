const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const TaskManager = require('./tasks');
const {
  createJsonRpcResponse,
  createJsonRpcError,
  ErrorCodes,
  TaskState
} = require('../shared/types');
const {
  validateJsonRpcRequest,
  validateMessage,
  getAuthFromHeaders,
  validateBearerToken,
  generateRequestId
} = require('../shared/utils');

/**
 * A2A Protocol Server Implementation
 */

const app = express();
const port = process.env.PORT || 3100;

// Initialize task manager with LLM service
const taskManager = new TaskManager();

// Valid API keys and tokens for demo purposes
const VALID_API_KEYS = ['demo-api-key-123', 'test-api-key-456'];
const VALID_BEARER_TOKENS = ['demo-bearer-token-789', 'test-bearer-token-012'];

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Authentication middleware
const authenticateRequest = (req, res, next) => {
  // Skip auth for well-known endpoints
  if (req.path === '/.well-known/agent.json' || req.path === '/docs') {
    return next();
  }
  
  const auth = getAuthFromHeaders(req.headers);
  
  if (!auth) {
    return res.status(401).json(createJsonRpcResponse(null, null, createJsonRpcError(
      ErrorCodes.AUTHENTICATION_REQUIRED,
      'Authentication required'
    )));
  }
  
  // Check Bearer token
  if (auth.startsWith('Bearer ')) {
    if (!validateBearerToken(auth, VALID_BEARER_TOKENS)) {
      return res.status(401).json(createJsonRpcResponse(null, null, createJsonRpcError(
        ErrorCodes.AUTHENTICATION_REQUIRED,
        'Invalid bearer token'
      )));
    }
  } 
  // Check API key
  else if (req.headers['x-a2a-api-key']) {
    if (!VALID_API_KEYS.includes(req.headers['x-a2a-api-key'])) {
      return res.status(401).json(createJsonRpcResponse(null, null, createJsonRpcError(
        ErrorCodes.AUTHENTICATION_REQUIRED,
        'Invalid API key'
      )));
    }
  } 
  // No valid auth method
  else {
    return res.status(401).json(createJsonRpcResponse(null, null, createJsonRpcError(
      ErrorCodes.AUTHENTICATION_REQUIRED,
      'Invalid authentication method'
    )));
  }
  
  next();
};

// Apply authentication to all A2A endpoints
app.use('/a2a/*', authenticateRequest);

// Serve agent card at well-known location
app.get('/.well-known/agent.json', (req, res) => {
  try {
    const agentCard = JSON.parse(fs.readFileSync(path.join(__dirname, 'agent-card.json'), 'utf8'));
    res.json(agentCard);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load agent card' });
  }
});

// Documentation endpoint
app.get('/docs', (req, res) => {
  const llmService = require('./llm-service');
  res.json({
    name: 'A2A Demo Server with LLM Integration',
    version: '1.0.0',
    llm: {
      defaultProvider: llmService.defaultProvider,
      availableProviders: llmService.getAvailableProviders(),
      capabilities: {
        textAnalysis: true,
        imageProcessing: true,
        dataTransformation: true,
        taskOrchestration: true
      }
    },
    endpoints: {
      'GET /.well-known/agent.json': 'Retrieve agent card',
      'POST /a2a/v1': 'Main JSON-RPC endpoint',
      'GET /docs': 'This documentation'
    },
    authentication: {
      'Bearer': 'Valid tokens: demo-bearer-token-789, test-bearer-token-012',
      'ApiKey': 'Header: X-A2A-API-Key, Valid keys: demo-api-key-123, test-api-key-456'
    },
    methods: [
      'tasks/send',
      'tasks/sendSubscribe',
      'tasks/get',
      'tasks/cancel',
      'tasks/pushNotification/set',
      'tasks/pushNotification/get',
      'tasks/resubscribe'
    ]
  });
});

// JSON-RPC error wrapper
const handleJsonRpcError = (error, id = null) => {
  console.error('JSON-RPC Error:', error);
  
  if (error.code && error.message) {
    return createJsonRpcResponse(null, id, error);
  }
  
  return createJsonRpcResponse(null, id, createJsonRpcError(
    ErrorCodes.INTERNAL_ERROR,
    error.message || 'Internal server error',
    { stack: process.env.NODE_ENV === 'development' ? error.stack : undefined }
  ));
};

// Streaming connection class
class StreamingConnection {
  constructor(res, taskId, requestId) {
    this.res = res;
    this.taskId = taskId;
    this.requestId = requestId;
    
    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    
    // Send initial comment to establish connection
    res.write(': connected\n\n');
    
    // Handle client disconnect
    res.on('close', () => {
      taskManager.removeStreamingConnection(taskId, this);
    });
  }
  
  sendEvent(eventType, data, isFinal = false) {
    const event = {
      jsonrpc: '2.0',
      id: this.requestId,
      result: {
        id: this.taskId,
        [eventType === 'status' ? 'status' : 'artifact']: data,
        final: isFinal
      }
    };
    
    this.res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
  
  close() {
    this.res.end();
  }
}

// Main JSON-RPC endpoint
app.post('/a2a/v1', async (req, res) => {
  const request = req.body;
  
  // Validate JSON-RPC request structure
  if (!validateJsonRpcRequest(request)) {
    return res.json(handleJsonRpcError(
      createJsonRpcError(ErrorCodes.INVALID_REQUEST, 'Invalid JSON-RPC request'),
      request.id
    ));
  }
  
  try {
    const { method, params, id } = request;
    let result;
    
    switch (method) {
      case 'tasks/send':
        result = await handleTasksSend(params);
        res.json(createJsonRpcResponse(result, id));
        break;
      
      case 'tasks/sendSubscribe':
        await handleTasksSendSubscribe(params, res, id);
        // Response is handled by streaming
        break;
      
      case 'tasks/get':
        result = await handleTasksGet(params);
        res.json(createJsonRpcResponse(result, id));
        break;
      
      case 'tasks/cancel':
        result = await handleTasksCancel(params);
        res.json(createJsonRpcResponse(result, id));
        break;
      
      case 'tasks/pushNotification/set':
        result = await handleTasksPushNotificationSet(params);
        res.json(createJsonRpcResponse(result, id));
        break;
      
      case 'tasks/pushNotification/get':
        result = await handleTasksPushNotificationGet(params);
        res.json(createJsonRpcResponse(result, id));
        break;
      
      case 'tasks/resubscribe':
        await handleTasksResubscribe(params, res, id);
        // Response is handled by streaming
        break;
      
      default:
        throw createJsonRpcError(
          ErrorCodes.METHOD_NOT_FOUND,
          `Method '${method}' not found`
        );
    }
  } catch (error) {
    res.json(handleJsonRpcError(error, request.id));
  }
});

// Method handlers

async function handleTasksSend(params) {
  // Validate params
  if (!params.id || !params.message) {
    throw createJsonRpcError(
      ErrorCodes.INVALID_PARAMS,
      'Missing required parameters: id, message'
    );
  }
  
  if (!validateMessage(params.message)) {
    throw createJsonRpcError(
      ErrorCodes.INVALID_PARAMS,
      'Invalid message format'
    );
  }
  
  // Check if task exists
  let task;
  try {
    task = taskManager.getTask(params.id);
    
    // If task exists and is waiting for input, continue it
    if (task.status.state === 'input-required') {
      return await taskManager.continueTask(params.id, params.message);
    }
    
    // If task exists but not waiting for input, throw error
    throw createJsonRpcError(
      ErrorCodes.INVALID_TASK_STATE,
      'Task already exists and is not waiting for input',
      { currentState: task.status.state }
    );
  } catch (error) {
    if (error.code === ErrorCodes.TASK_NOT_FOUND) {
      // Task doesn't exist, create new one
      task = taskManager.createTask(params);
      
      // Set push notification config if provided
      if (params.pushNotification) {
        taskManager.setPushNotificationConfig(params.id, params.pushNotification);
      }
      
      // Start processing
      process.nextTick(async () => {
        try {
          await taskManager.processTask(params.id);
        } catch (error) {
          console.error(`Error processing task ${params.id}:`, error);
        }
      });
      
      return task;
    }
    throw error;
  }
}

async function handleTasksSendSubscribe(params, res, requestId) {
  // Validate params
  if (!params.id || !params.message) {
    throw createJsonRpcError(
      ErrorCodes.INVALID_PARAMS,
      'Missing required parameters: id, message'
    );
  }
  
  if (!validateMessage(params.message)) {
    throw createJsonRpcError(
      ErrorCodes.INVALID_PARAMS,
      'Invalid message format'
    );
  }
  
  // Create streaming connection
  const connection = new StreamingConnection(res, params.id, requestId);
  
  // Check if task exists
  let task;
  try {
    task = taskManager.getTask(params.id);
    
    // Add streaming connection
    taskManager.addStreamingConnection(params.id, connection);
    
    // If task is waiting for input, continue it
    if (task.status.state === 'input-required') {
      process.nextTick(async () => {
        try {
          await taskManager.continueTask(params.id, params.message);
        } catch (error) {
          console.error(`Error continuing task ${params.id}:`, error);
        }
      });
    }
  } catch (error) {
    if (error.code === ErrorCodes.TASK_NOT_FOUND) {
      // Create new task
      task = taskManager.createTask(params);
      
      // Set push notification config if provided
      if (params.pushNotification) {
        taskManager.setPushNotificationConfig(params.id, params.pushNotification);
      }
      
      // Add streaming connection
      taskManager.addStreamingConnection(params.id, connection);
      
      // Start processing
      process.nextTick(async () => {
        try {
          await taskManager.processTask(params.id);
        } catch (error) {
          console.error(`Error processing task ${params.id}:`, error);
        }
      });
    } else {
      throw error;
    }
  }
}

async function handleTasksGet(params) {
  if (!params.id) {
    throw createJsonRpcError(
      ErrorCodes.INVALID_PARAMS,
      'Missing required parameter: id'
    );
  }
  
  return taskManager.getTask(params.id, params.historyLength);
}

async function handleTasksCancel(params) {
  if (!params.id) {
    throw createJsonRpcError(
      ErrorCodes.INVALID_PARAMS,
      'Missing required parameter: id'
    );
  }
  
  return taskManager.cancelTask(params.id);
}

async function handleTasksPushNotificationSet(params) {
  if (!params.id || !params.pushNotificationConfig) {
    throw createJsonRpcError(
      ErrorCodes.INVALID_PARAMS,
      'Missing required parameters: id, pushNotificationConfig'
    );
  }
  
  return taskManager.setPushNotificationConfig(params.id, params.pushNotificationConfig);
}

async function handleTasksPushNotificationGet(params) {
  if (!params.id) {
    throw createJsonRpcError(
      ErrorCodes.INVALID_PARAMS,
      'Missing required parameter: id'
    );
  }
  
  return taskManager.getPushNotificationConfig(params.id);
}

async function handleTasksResubscribe(params, res, requestId) {
  if (!params.id) {
    throw createJsonRpcError(
      ErrorCodes.INVALID_PARAMS,
      'Missing required parameter: id'
    );
  }
  
  // Get existing task
  const task = taskManager.getTask(params.id);
  
  // Create new streaming connection
  const connection = new StreamingConnection(res, params.id, requestId);
  
  // Add streaming connection
  taskManager.addStreamingConnection(params.id, connection);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    activeTasks: taskManager.tasks.size,
    activeStreams: Array.from(taskManager.streamingConnections.values())
      .reduce((sum, connections) => sum + connections.length, 0)
  });
});

// Start server
app.listen(port, () => {
  console.log(`A2A Demo Server running on http://localhost:${port}`);
  console.log(`Agent Card available at: http://localhost:${port}/.well-known/agent.json`);
  console.log(`Documentation available at: http://localhost:${port}/docs`);
  
  // Initialize and show LLM information
  const llmService = require('./llm-service');
  console.log(`Using LLM Provider: ${llmService.defaultProvider}`);
  console.log(`Available Providers: ${llmService.getAvailableProviders().join(', ')}`);
  
  // Clean up expired tasks every hour
  setInterval(() => {
    taskManager.cleanupExpiredTasks();
  }, 60 * 60 * 1000);
});

module.exports = app;
