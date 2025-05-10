const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const {
  createJsonRpcRequest,
  createMessage,
  createTextPart,
  createDataPart
} = require('../shared/types');
const {
  generateTaskId,
  generateSessionId,
  generateRequestId,
  isValidHttpsUrl
} = require('../shared/utils');

/**
 * Push Notification A2A Client Implementation
 * Demonstrates asynchronous task updates via webhooks
 */

class A2APushClient {
  constructor(serverUrl, authToken = null, apiKey = null, webhookPort = 3001) {
    this.serverUrl = serverUrl;
    this.authToken = authToken;
    this.apiKey = apiKey;
    this.webhookPort = webhookPort;
    this.webhookServer = null;
    this.webhookUrl = `http://localhost:${webhookPort}/webhook`;
    this.pendingTasks = new Map();
    
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
  
  // Start webhook server to receive push notifications
  async startWebhookServer() {
    const app = express();
    app.use(bodyParser.json());
    
    // Webhook endpoint
    app.post('/webhook', (req, res) => {
      console.log('\n[Webhook] Received notification:', JSON.stringify(req.body, null, 2));
      
      const { taskId, status } = req.body;
      
      // Acknowledge receipt
      res.status(200).json({ received: true });
      
      // Process the notification
      this.handlePushNotification(req.body);
    });
    
    // Health check
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', port: this.webhookPort });
    });
    
    // Start server
    return new Promise((resolve, reject) => {
      this.webhookServer = app.listen(this.webhookPort, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`Webhook server listening on http://localhost:${this.webhookPort}`);
          resolve();
        }
      });
    });
  }
  
  // Stop webhook server
  async stopWebhookServer() {
    if (this.webhookServer) {
      return new Promise((resolve) => {
        this.webhookServer.close(() => {
          console.log('Webhook server stopped');
          resolve();
        });
      });
    }
  }
  
  // Handle incoming push notifications
  handlePushNotification(notification) {
    const { taskId, status } = notification;
    
    // Find pending task
    const taskInfo = this.pendingTasks.get(taskId);
    if (!taskInfo) {
      console.log(`[Webhook] Received notification for unknown task: ${taskId}`);
      return;
    }
    
    console.log(`[Webhook] Task ${taskId} status: ${status.state}`);
    
    // Check if task is complete
    if (['completed', 'failed', 'canceled'].includes(status.state)) {
      console.log(`[Webhook] Task ${taskId} finished with state: ${status.state}`);
      
      // Trigger callback if set
      if (taskInfo.callback) {
        taskInfo.callback(null, status);
      }
      
      // Remove from pending tasks
      this.pendingTasks.delete(taskId);
    } else {
      console.log(`[Webhook] Task ${taskId} still in progress...`);
      
      // Update task info
      taskInfo.lastStatus = status;
      taskInfo.lastUpdate = new Date().toISOString();
    }
  }
  
  // Send task with push notification
  async sendTaskWithPushNotification(message, sessionId = null) {
    const taskId = generateTaskId();
    const requestId = generateRequestId();
    
    // Generate unique token for this task
    const notificationToken = `task-${taskId}-token`;
    
    const request = createJsonRpcRequest('tasks/send', {
      id: taskId,
      sessionId,
      message,
      pushNotification: {
        url: this.webhookUrl,
        token: notificationToken,
        authentication: null // Using token-based auth in this demo
      }
    }, requestId);
    
    try {
      // Send the task
      const response = await this.axios.post('/a2a/v1', request);
      
      if (response.data.error) {
        throw new Error(`JSON-RPC Error: ${response.data.error.message}`);
      }
      
      const task = response.data.result;
      
      // Store task info
      this.pendingTasks.set(taskId, {
        id: taskId,
        token: notificationToken,
        createdAt: new Date().toISOString(),
        lastStatus: task.status,
        lastUpdate: new Date().toISOString()
      });
      
      console.log(`[Push] Task ${taskId} submitted, waiting for push notifications...`);
      
      return task;
    } catch (error) {
      throw new Error(`Failed to send task: ${error.message}`);
    }
  }
  
  // Send task and wait for completion via push notification
  async sendTaskAndWait(message, sessionId = null, timeout = 60000) {
    const task = await this.sendTaskWithPushNotification(message, sessionId);
    
    return new Promise((resolve, reject) => {
      const taskInfo = this.pendingTasks.get(task.id);
      
      // Set up callback for completion
      taskInfo.callback = (error, status) => {
        if (error) {
          reject(error);
        } else {
          resolve(status);
        }
      };
      
      // Set timeout
      const timeoutId = setTimeout(() => {
        this.pendingTasks.delete(task.id);
        reject(new Error(`Task ${task.id} timed out after ${timeout}ms`));
      }, timeout);
      
      // Clear timeout when task completes
      const originalCallback = taskInfo.callback;
      taskInfo.callback = (error, status) => {
        clearTimeout(timeoutId);
        originalCallback(error, status);
      };
    });
  }
  
  // Get task status (fallback method)
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
  
  // List pending tasks
  listPendingTasks() {
    console.log('\nPending Tasks:');
    if (this.pendingTasks.size === 0) {
      console.log('  No pending tasks');
    } else {
      for (const [taskId, info] of this.pendingTasks) {
        console.log(`  ${taskId}: ${info.lastStatus.state} (Last update: ${info.lastUpdate})`);
      }
    }
  }
}

// Demo scenarios
async function runPushDemo() {
  console.log('=== A2A Push Notification Client Demo ===\n');
  
  // Initialize client
  const client = new A2APushClient('http://localhost:3100', 'demo-bearer-token-789');
  
  try {
    // Start webhook server
    console.log('Starting webhook server...');
    await client.startWebhookServer();
    console.log();
    
    // Example 1: Long-running task with push notifications
    console.log('1. Submitting long-running orchestration task...');
    const orchestrationMessage = createMessage('user', [
      createTextPart('Run a comprehensive analytics report generation that takes several minutes')
    ]);
    
    // Submit task without waiting
    const orchestrationTask = await client.sendTaskWithPushNotification(orchestrationMessage);
    console.log(`Task submitted: ${orchestrationTask.id}`);
    console.log('Initial status:', orchestrationTask.status.state);
    
    // Example 2: Multiple concurrent tasks
    console.log('\n2. Submitting multiple concurrent tasks...');
    const tasks = [];
    
    for (let i = 1; i <= 3; i++) {
      const message = createMessage('user', [
        createTextPart(`Task ${i}: Process this batch of data items - simulating long-running operation`)
      ]);
      
      const task = await client.sendTaskWithPushNotification(message);
      tasks.push(task);
      console.log(`Task ${i} submitted: ${task.id}`);
    }
    
    // List pending tasks
    client.listPendingTasks();
    
    // Wait for notifications
    console.log('\n3. Waiting for push notifications...');
    console.log('Push notifications will be received and logged as tasks complete.');
    console.log('(In a real scenario, these tasks would actually be processed)');
    
    // Wait for some time to simulate task processing
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Example 3: Task with immediate completion
    console.log('\n4. Submitting task with quick completion...');
    const quickMessage = createMessage('user', [
      createTextPart('Analyze this short text: "Hello world!"')
    ]);
    
    try {
      const finalStatus = await client.sendTaskAndWait(quickMessage, null, 15000);
      console.log('Task completed via push notification!');
      console.log('Final status:', finalStatus.state);
      
      // Get full task details
      if (finalStatus.state === 'completed') {
        const fullTask = await client.getTask(finalStatus.taskId || tasks[0].id);
        console.log('Final artifacts:', fullTask.artifacts?.length || 0);
      }
    } catch (error) {
      console.error('Quick task failed:', error.message);
    }
    
    // Final status
    console.log('\nFinal status of all tasks:');
    client.listPendingTasks();
    
  } catch (error) {
    console.error('Push demo failed:', error.message);
  } finally {
    // Cleanup
    console.log('\nCleaning up...');
    await client.stopWebhookServer();
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runPushDemo().catch(console.error);
}

module.exports = A2APushClient;
