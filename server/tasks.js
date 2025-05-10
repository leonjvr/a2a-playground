const { 
  TaskState, 
  createTask, 
  createTaskStatus, 
  createMessage,
  createTextPart,
  ErrorCodes,
  createJsonRpcError
} = require('../shared/types');
const { generateTaskId } = require('../shared/utils');
const skills = require('./skills');

/**
 * Task Manager for handling A2A task lifecycle
 */
class TaskManager {
  constructor() {
    this.tasks = new Map();
    this.sessions = new Map();
    this.pushNotificationConfigs = new Map();
    this.streamingConnections = new Map();
  }
  
  // Create a new task
  createTask(params) {
    const { id, sessionId, message } = params;
    
    // Validate that task doesn't already exist
    if (this.tasks.has(id)) {
      throw createJsonRpcError(
        ErrorCodes.INVALID_PARAMS,
        'Task with this ID already exists',
        { taskId: id }
      );
    }
    
    // Create initial task status
    const status = createTaskStatus('submitted', message);
    
    // Create the task
    const task = createTask(id, status, sessionId, [], null, {});
    
    // Store the task
    this.tasks.set(id, task);
    
    // Add to session if specified
    if (sessionId) {
      if (!this.sessions.has(sessionId)) {
        this.sessions.set(sessionId, []);
      }
      this.sessions.get(sessionId).push(id);
    }
    
    return task;
  }
  
  // Get an existing task
  getTask(taskId, historyLength = 0) {
    const task = this.tasks.get(taskId);
    
    if (!task) {
      throw createJsonRpcError(
        ErrorCodes.TASK_NOT_FOUND,
        'Task not found',
        { taskId }
      );
    }
    
    // Create a copy to avoid mutation
    const taskCopy = JSON.parse(JSON.stringify(task));
    
    // Apply history length limit if requested
    if (historyLength > 0 && taskCopy.history) {
      taskCopy.history = taskCopy.history.slice(-historyLength);
    }
    
    return taskCopy;
  }
  
  // Update task status
  updateTaskStatus(taskId, newStatus) {
    const task = this.tasks.get(taskId);
    
    if (!task) {
      throw createJsonRpcError(
        ErrorCodes.TASK_NOT_FOUND,
        'Task not found',
        { taskId }
      );
    }
    
    // Add previous status to history if it exists
    if (task.status && task.status.message) {
      task.history = task.history || [];
      task.history.push(task.status.message);
    }
    
    // Update status
    task.status = newStatus;
    
    // Trigger any streaming updates
    this.notifyStreamingConnections(taskId, 'status', task.status);
    
    // Trigger push notifications if configured
    if (this.pushNotificationConfigs.has(taskId)) {
      this.sendPushNotification(taskId);
    }
    
    return task;
  }
  
  // Add artifacts to a task
  addArtifacts(taskId, artifacts) {
    const task = this.tasks.get(taskId);
    
    if (!task) {
      throw createJsonRpcError(
        ErrorCodes.TASK_NOT_FOUND,
        'Task not found',
        { taskId }
      );
    }
    
    task.artifacts = task.artifacts || [];
    task.artifacts.push(...artifacts);
    
    // Trigger streaming updates for artifacts
    artifacts.forEach(artifact => {
      this.notifyStreamingConnections(taskId, 'artifact', artifact);
    });
    
    return task;
  }
  
  // Process a task with the appropriate skill
  async processTask(taskId) {
    const task = this.getTask(taskId);
    
    // Determine which skill to use based on message content or metadata
    const skillId = this.determineSkill(task);
    
    if (!skillId || !skills[skillId]) {
      throw new Error(`Unknown skill: ${skillId}`);
    }
    
    // Update task status to working
    this.updateTaskStatus(taskId, createTaskStatus('working', null));
    
    try {
      // Process with the determined skill
      const skill = skills[skillId];
      const result = await skill.process(task, this);
      
      // Update task with results
      if (result.artifacts && result.artifacts.length > 0) {
        this.addArtifacts(taskId, result.artifacts);
      }
      
      // Update final status
      const finalStatus = createTaskStatus('completed', result.message);
      this.updateTaskStatus(taskId, finalStatus);
      
      return this.getTask(taskId);
      
    } catch (error) {
      // Update task status to failed
      const errorMessage = createMessage('agent', [
        createTextPart(`Error: ${error.message}`)
      ]);
      
      const failedStatus = createTaskStatus('failed', errorMessage);
      this.updateTaskStatus(taskId, failedStatus);
      
      throw error;
    }
  }
  
  // Continue a task that requires user input
  async continueTask(taskId, userMessage) {
    const task = this.getTask(taskId);
    
    if (task.status.state !== 'input-required') {
      throw createJsonRpcError(
        ErrorCodes.INVALID_TASK_STATE,
        'Task is not waiting for input',
        { taskId, currentState: task.status.state }
      );
    }
    
    // Add user message to history
    task.history = task.history || [];
    task.history.push(userMessage);
    
    // Determine skill and continue processing
    const skillId = this.determineSkill(task);
    const skill = skills[skillId];
    
    if (skill.continueOrchestration) {
      // Special handling for orchestration tasks
      const result = await skill.continueOrchestration(task, this);
      
      if (result.artifacts) {
        this.addArtifacts(taskId, result.artifacts);
      }
      
      if (result.message) {
        const status = createTaskStatus(
          task.status.state === 'input-required' ? 'input-required' : 'completed',
          result.message
        );
        this.updateTaskStatus(taskId, status);
      }
      
      return this.getTask(taskId);
    } else {
      // For other skills, restart processing with the new input
      task.status.message = userMessage;
      return this.processTask(taskId);
    }
  }
  
  // Cancel a task
  cancelTask(taskId) {
    const task = this.getTask(taskId);
    
    // Check if task is cancelable
    const terminalStates = ['completed', 'canceled', 'failed'];
    if (terminalStates.includes(task.status.state)) {
      throw createJsonRpcError(
        ErrorCodes.TASK_NOT_CANCELABLE,
        'Task cannot be canceled',
        { taskId, currentState: task.status.state }
      );
    }
    
    // Update status to canceled
    const canceledStatus = createTaskStatus(
      'canceled',
      createMessage('agent', [createTextPart('Task canceled by user request')])
    );
    
    this.updateTaskStatus(taskId, canceledStatus);
    
    return this.getTask(taskId);
  }
  
  // Push notification methods
  setPushNotificationConfig(taskId, config) {
    const task = this.getTask(taskId);
    
    if (config) {
      this.pushNotificationConfigs.set(taskId, config);
    } else {
      this.pushNotificationConfigs.delete(taskId);
    }
    
    return {
      id: taskId,
      pushNotificationConfig: config
    };
  }
  
  getPushNotificationConfig(taskId) {
    const task = this.getTask(taskId); // This will throw if task doesn't exist
    
    const config = this.pushNotificationConfigs.get(taskId);
    
    return {
      id: taskId,
      pushNotificationConfig: config || null
    };
  }
  
  // Streaming methods
  addStreamingConnection(taskId, connection) {
    if (!this.streamingConnections.has(taskId)) {
      this.streamingConnections.set(taskId, []);
    }
    
    this.streamingConnections.get(taskId).push(connection);
    
    // Send initial status
    const task = this.getTask(taskId);
    connection.sendEvent('status', task.status, false);
    
    // Send existing artifacts
    if (task.artifacts) {
      task.artifacts.forEach(artifact => {
        connection.sendEvent('artifact', artifact);
      });
    }
  }
  
  removeStreamingConnection(taskId, connection) {
    const connections = this.streamingConnections.get(taskId);
    if (connections) {
      const index = connections.indexOf(connection);
      if (index > -1) {
        connections.splice(index, 1);
      }
      
      if (connections.length === 0) {
        this.streamingConnections.delete(taskId);
      }
    }
  }
  
  notifyStreamingConnections(taskId, eventType, data) {
    const connections = this.streamingConnections.get(taskId);
    if (!connections) return;
    
    const task = this.getTask(taskId);
    const isTerminal = ['completed', 'canceled', 'failed'].includes(task.status.state);
    
    connections.forEach(connection => {
      connection.sendEvent(eventType, data, isTerminal);
    });
    
    // Close connections for terminal states
    if (isTerminal) {
      connections.forEach(connection => connection.close());
      this.streamingConnections.delete(taskId);
    }
  }
  
  // Send push notification (mock implementation)
  async sendPushNotification(taskId) {
    const config = this.pushNotificationConfigs.get(taskId);
    if (!config) return;
    
    const task = this.getTask(taskId);
    const axios = require('axios');
    
    try {
      // Prepare notification payload
      const payload = {
        eventType: 'taskUpdate',
        taskId,
        status: task.status,
        timestamp: new Date().toISOString()
      };
      
      // Prepare headers
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (config.token) {
        headers['X-A2A-Notification-Token'] = config.token;
      }
      
      if (config.authentication) {
        // Handle different auth schemes
        if (config.authentication.schemes.includes('Bearer')) {
          // In a real implementation, you'd get a valid bearer token
          headers['Authorization'] = 'Bearer demo-token';
        }
      }
      
      // Send the notification
      await axios.post(config.url, payload, { headers });
      
    } catch (error) {
      console.error(`Failed to send push notification for task ${taskId}:`, error.message);
    }
  }
  
  // Helper method to determine which skill to use
  determineSkill(task) {
    // Check metadata for explicit skill
    if (task.metadata?.skill) {
      return task.metadata.skill;
    }
    
    // Analyze message content to determine skill
    const message = task.status.message;
    if (!message) return null;
    
    for (const part of message.parts) {
      if (part.type === 'text') {
        const text = part.text.toLowerCase();
        
        if (text.includes('analyze') || text.includes('sentiment')) {
          return 'text-analysis';
        }
        
        if (text.includes('image') || text.includes('photo') || text.includes('picture')) {
          return 'image-processing';
        }
        
        if (text.includes('convert') || text.includes('transform') || text.includes('csv') || text.includes('json')) {
          return 'data-transformation';
        }
        
        if (text.includes('batch') || text.includes('pipeline') || text.includes('orchestrate')) {
          return 'task-orchestration';
        }
      }
    }
    
    // Default to text analysis if no specific skill is detected
    return 'text-analysis';
  }
  
  // Clean up expired tasks (optional method for maintenance)
  cleanupExpiredTasks(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
    const now = Date.now();
    
    for (const [taskId, task] of this.tasks.entries()) {
      const taskTime = new Date(task.status.timestamp).getTime();
      const age = now - taskTime;
      
      // Remove old completed/failed/canceled tasks
      if (age > maxAge && ['completed', 'failed', 'canceled'].includes(task.status.state)) {
        this.tasks.delete(taskId);
        this.pushNotificationConfigs.delete(taskId);
      }
    }
  }
}

module.exports = TaskManager;
