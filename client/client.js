const axios = require('axios');
const {
  createJsonRpcRequest,
  createMessage,
  createTextPart,
  createDataPart,
  createFilePart
} = require('../shared/types');
const {
  generateTaskId,
  generateSessionId,
  generateRequestId,
  createFileContent
} = require('../shared/utils');

/**
 * Basic A2A Client Implementation
 * Demonstrates synchronous task execution with polling
 */

class A2AClient {
  constructor(serverUrl, authToken = null, apiKey = null) {
    this.serverUrl = serverUrl;
    this.authToken = authToken;
    this.apiKey = apiKey;
    
    // Configure axios defaults
    this.axios = axios.create({
      baseURL: serverUrl,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Set authentication headers
    if (authToken) {
      this.axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    }
    
    if (apiKey) {
      this.axios.defaults.headers.common['X-A2A-API-Key'] = apiKey;
    }
  }
  
  // Get agent card
  async getAgentCard() {
    try {
      const response = await this.axios.get('/.well-known/agent.json');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get agent card: ${error.message}`);
    }
  }
  
  // Send a task and wait for completion
  async sendTask(message, sessionId = null, waitForCompletion = true, timeout = 30000) {
    const taskId = generateTaskId();
    const requestId = generateRequestId();
    
    const request = createJsonRpcRequest('tasks/send', {
      id: taskId,
      sessionId,
      message
    }, requestId);
    
    try {
      // Send the initial task
      const response = await this.axios.post('/a2a/v1', request);
      
      if (response.data.error) {
        throw new Error(`JSON-RPC Error: ${response.data.error.message}`);
      }
      
      const task = response.data.result;
      
      if (!waitForCompletion) {
        return task;
      }
      
      // Poll for completion
      return await this.waitForTaskCompletion(taskId, timeout);
      
    } catch (error) {
      throw new Error(`Failed to send task: ${error.message}`);
    }
  }
  
  // Poll task status until completion
  async waitForTaskCompletion(taskId, timeout = 30000) {
    const startTime = Date.now();
    const pollInterval = 1000; // Poll every second
    
    while (Date.now() - startTime < timeout) {
      const task = await this.getTask(taskId);
      
      // Check if task is in a terminal state
      if (['completed', 'canceled', 'failed'].includes(task.status.state)) {
        return task;
      }
      
      // Check if task requires input
      if (task.status.state === 'input-required') {
        console.log('Task requires user input:', task.status.message.parts[0].text);
        throw new Error('Task requires user input - cannot complete automatically');
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error(`Task ${taskId} did not complete within ${timeout}ms`);
  }
  
  // Get task status
  async getTask(taskId, historyLength = 0) {
    const requestId = generateRequestId();
    
    const request = createJsonRpcRequest('tasks/get', {
      id: taskId,
      historyLength
    }, requestId);
    
    try {
      const response = await this.axios.post('/a2a/v1', request);
      
      if (response.data.error) {
        throw new Error(`JSON-RPC Error: ${response.data.error.message}`);
      }
      
      return response.data.result;
    } catch (error) {
      throw new Error(`Failed to get task: ${error.message}`);
    }
  }
  
  // Cancel a task
  async cancelTask(taskId) {
    const requestId = generateRequestId();
    
    const request = createJsonRpcRequest('tasks/cancel', {
      id: taskId
    }, requestId);
    
    try {
      const response = await this.axios.post('/a2a/v1', request);
      
      if (response.data.error) {
        throw new Error(`JSON-RPC Error: ${response.data.error.message}`);
      }
      
      return response.data.result;
    } catch (error) {
      throw new Error(`Failed to cancel task: ${error.message}`);
    }
  }
  
  // Continue a task that requires input
  async continueTask(taskId, userInput) {
    const requestId = generateRequestId();
    
    const message = createMessage('user', [createTextPart(userInput)]);
    
    const request = createJsonRpcRequest('tasks/send', {
      id: taskId,
      message
    }, requestId);
    
    try {
      const response = await this.axios.post('/a2a/v1', request);
      
      if (response.data.error) {
        throw new Error(`JSON-RPC Error: ${response.data.error.message}`);
      }
      
      return response.data.result;
    } catch (error) {
      throw new Error(`Failed to continue task: ${error.message}`);
    }
  }
  
  // Set push notification config
  async setPushNotification(taskId, webhookUrl, token = null, authentication = null) {
    const requestId = generateRequestId();
    
    const request = createJsonRpcRequest('tasks/pushNotification/set', {
      id: taskId,
      pushNotificationConfig: {
        url: webhookUrl,
        token,
        authentication
      }
    }, requestId);
    
    try {
      const response = await this.axios.post('/a2a/v1', request);
      
      if (response.data.error) {
        throw new Error(`JSON-RPC Error: ${response.data.error.message}`);
      }
      
      return response.data.result;
    } catch (error) {
      throw new Error(`Failed to set push notification: ${error.message}`);
    }
  }
}

// Demo scenarios
async function runDemo() {
  console.log('=== A2A Basic Client Demo ===\n');
  
  // Initialize client
  const client = new A2AClient('http://localhost:3100', 'demo-bearer-token-789');
  
  try {
    // Get agent card
    console.log('1. Getting agent card...');
    const agentCard = await client.getAgentCard();
    console.log(`Agent: ${agentCard.name}`);
    console.log(`Capabilities: ${JSON.stringify(agentCard.capabilities)}\n`);
    
    // Example 1: Text Analysis
    console.log('2. Running text analysis...');
    const textMessage = createMessage('user', [
      createTextPart('Analyze the sentiment of this text: "I absolutely love this amazing product! It has exceeded all my expectations and made my life so much easier."')
    ]);
    
    const textTask = await client.sendTask(textMessage);
    console.log('Task completed!');
    console.log('Results:', JSON.stringify(textTask.artifacts[0].parts[0].data, null, 2));
    console.log();
    
    // Example 2: Data Transformation
    console.log('3. Running data transformation...');
    const data = [
      { id: 1, name: 'Alice', score: 95 },
      { id: 2, name: 'Bob', score: 87 },
      { id: 3, name: 'Charlie', score: 92 }
    ];
    
    const dataMessage = createMessage('user', [
      createTextPart('Convert this JSON data to CSV format'),
      createDataPart(data)
    ]);
    
    const dataTask = await client.sendTask(dataMessage);
    console.log('Task completed!');
    console.log('CSV output:', dataTask.artifacts[0].parts[0].data);
    console.log();
    
    // Example 3: Image Processing (with mock image)
    console.log('4. Running image processing...');
    const imageContent = createFileContent('test-image.png', 'image/png', Buffer.from('mock-image-data'));
    
    const imageMessage = createMessage('user', [
      createTextPart('Extract text from this image'),
      createFilePart(imageContent)
    ]);
    
    try {
      const imageTask = await client.sendTask(imageMessage, null, true, 10000);
      console.log('Task completed!');
      
      // Check if task completed successfully and has artifacts
      if (imageTask.status.state === 'completed' && imageTask.artifacts && imageTask.artifacts.length > 1) {
        const processingResults = imageTask.artifacts[1].parts[0].data;
        console.log('Processing results:', JSON.stringify(processingResults, null, 2));
      } else {
        console.log('Image processing task completed but with issues');
        console.log('Status:', imageTask.status.state);
        if (imageTask.status.message?.parts?.[0]?.text) {
          console.log('Message:', imageTask.status.message.parts[0].text);
        }
      }
    } catch (error) {
      console.log('Image processing failed (expected with mock data):', error.message);
    }
    console.log();
    
    // Example 4: Task orchestration with user input
    console.log('5. Running task orchestration...');
    const orchestrationMessage = createMessage('user', [
      createTextPart('Start a data pipeline orchestration process')
    ]);
    
    try {
      const orchestrationTask = await client.sendTask(orchestrationMessage, null, true, 15000);
      console.log('Orchestration completed!');
      console.log('Final status:', orchestrationTask.status.state);
    } catch (error) {
      if (error.message.includes('requires user input')) {
        console.log('Note: Orchestration task requires user input and cannot be completed automatically in this demo.');
      } else {
        console.error('Orchestration error:', error.message);
      }
    }
    
  } catch (error) {
    console.error('Demo failed:', error.message);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runDemo().catch(console.error);
}

module.exports = A2AClient;
