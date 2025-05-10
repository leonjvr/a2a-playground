const axios = require('axios');
const EventSource = require('eventsource');
const {
  createJsonRpcRequest,
  createMessage,
  createTextPart,
  createDataPart
} = require('../shared/types');
const {
  generateTaskId,
  generateSessionId,
  generateRequestId
} = require('../shared/utils');

/**
 * Streaming A2A Client Implementation
 * Demonstrates real-time task updates via Server-Sent Events
 */

class A2AStreamingClient {
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
    
    this.activeConnections = new Map();
  }
  
  // Send task with streaming subscription
  async sendTaskWithStreaming(message, sessionId = null, timeout = 60000) {
    const taskId = generateTaskId();
    const requestId = generateRequestId();
    
    const request = createJsonRpcRequest('tasks/sendSubscribe', {
      id: taskId,
      sessionId,
      message
    }, requestId);
    
    return new Promise((resolve, reject) => {
      // Set up EventSource headers
      const headers = {};
      
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }
      
      if (this.apiKey) {
        headers['X-A2A-API-Key'] = this.apiKey;
      }
      
      // Create streaming connection by sending JSON-RPC request with POST
      this.axios.post('/a2a/v1', request, {
        responseType: 'stream',
        headers: {
          'Accept': 'text/event-stream'
        }
      }).then(response => {
        console.log(`[Stream ${taskId}] Connected`);
        
        // Store connection
        this.activeConnections.set(taskId, response);
        
        // Store task state
        let taskState = {
          id: taskId,
          status: null,
          artifacts: [],
          history: []
        };
        
        let buffer = '';
        
        // Handle incoming data
        response.data.on('data', (chunk) => {
          buffer += chunk.toString();
          
          // Process complete messages
          const messages = buffer.split('\n\n');
          buffer = messages.pop() || ''; // Keep incomplete message in buffer
          
          for (const message of messages) {
            if (!message.trim()) continue;
            
            try {
              // Parse SSE message
              const lines = message.split('\n');
              let data = null;
              let eventType = null;
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  data = line.substring(6);
                } else if (line.startsWith('event: ')) {
                  eventType = line.substring(7);
                }
              }
              
              if (!data) continue;
              if (data.startsWith(':')) continue; // Skip comments
              
              const parsed = JSON.parse(data);
              
              if (parsed.error) {
                console.error(`[Stream ${taskId}] Error:`, parsed.error);
                response.data.destroy();
                this.activeConnections.delete(taskId);
                reject(new Error(parsed.error.message));
                return;
              }
              
              if (parsed.result) {
                this.processStreamingResult(taskId, parsed.result, taskState);
                
                // Check if stream is complete
                if (parsed.result.final) {
                  console.log(`[Stream ${taskId}] Stream completed`);
                  response.data.destroy();
                  this.activeConnections.delete(taskId);
                  resolve(taskState);
                }
              }
            } catch (error) {
              console.error(`[Stream ${taskId}] Parse error:`, error.message);
            }
          }
        });
        
        // Handle stream errors
        response.data.on('error', (error) => {
          console.error(`[Stream ${taskId}] Stream error:`, error);
          this.activeConnections.delete(taskId);
          reject(error);
        });
        
        // Handle stream end
        response.data.on('end', () => {
          console.log(`[Stream ${taskId}] Stream ended`);
          this.activeConnections.delete(taskId);
          resolve(taskState);
        });
        
        // Timeout protection
        const timeoutId = setTimeout(() => {
          console.log(`[Stream ${taskId}] Timeout reached`);
          response.data.destroy();
          this.activeConnections.delete(taskId);
          reject(new Error('Streaming timeout'));
        }, timeout);
        
        // Clear timeout when stream ends
        response.data.on('end', () => clearTimeout(timeoutId));
        response.data.on('error', () => clearTimeout(timeoutId));
        
      }).catch(error => {
        console.error(`[Stream ${taskId}] Failed to establish connection:`, error.message);
        reject(error);
      });
    });
  }
  
  // Process streaming results
  processStreamingResult(taskId, result, taskState) {
    // Update task state
    if (result.status) {
      taskState.status = result.status;
      console.log(`[Stream ${taskId}] Status: ${result.status.state}`);
      
      if (result.status.message) {
        const messageText = result.status.message.parts.find(p => p.type === 'text')?.text;
        if (messageText) {
          console.log(`[Stream ${taskId}] Message: ${messageText}`);
        }
      }
    }
    
    // Handle artifact updates
    if (result.artifact) {
      const artifact = result.artifact;
      console.log(`[Stream ${taskId}] Artifact update: ${artifact.name}`);
      
      // Find or create artifact in state
      let existingArtifact = taskState.artifacts.find(a => a.index === artifact.index);
      
      if (!existingArtifact) {
        existingArtifact = {
          index: artifact.index,
          name: artifact.name,
          description: artifact.description,
          parts: [],
          isComplete: false
        };
        taskState.artifacts.push(existingArtifact);
      }
      
      // Update artifact
      existingArtifact.name = artifact.name;
      existingArtifact.description = artifact.description;
      
      if (artifact.append) {
        existingArtifact.parts.push(...artifact.parts);
      } else {
        existingArtifact.parts = artifact.parts;
      }
      
      if (artifact.lastChunk) {
        existingArtifact.isComplete = true;
        console.log(`[Stream ${taskId}] Artifact complete: ${artifact.name}`);
      }
      
      // For text artifacts, show incremental updates
      const textPart = artifact.parts.find(p => p.type === 'text');
      if (textPart && existingArtifact.parts.length > 1) {
        const fullText = existingArtifact.parts
          .filter(p => p.type === 'text')
          .map(p => p.text)
          .join('');
        console.log(`[Stream ${taskId}] Text so far: "${fullText.substring(0, 100)}..."`);
      }
    }
  }
  
  // Resubscribe to an existing task
  async resubscribe(taskId, timeout = 60000) {
    const requestId = generateRequestId();
    
    const request = createJsonRpcRequest('tasks/resubscribe', {
      id: taskId
    }, requestId);
    
    return this.sendTaskWithStreaming(null, null, timeout);
  }
  
  // Close all active connections
  closeAllConnections() {
    for (const [taskId, connection] of this.activeConnections) {
      console.log(`Closing connection for task ${taskId}`);
      if (connection.data && connection.data.destroy) {
        connection.data.destroy();
      }
    }
    this.activeConnections.clear();
  }
}

// Demo scenarios
async function runStreamingDemo() {
  console.log('=== A2A Streaming Client Demo ===\n');
  
  // Initialize client
  const client = new A2AStreamingClient('http://localhost:3100', 'demo-bearer-token-789');
  
  try {
    // Example 1: Stream a text story generation
    console.log('1. Streaming text generation...');
    const storyMessage = createMessage('user', [
      createTextPart('Write a short story about a robot exploring Mars. Stream the story as you generate it.')
    ]);
    
    const storyTask = await client.sendTaskWithStreaming(storyMessage);
    console.log('\nGenerated story:');
    const storyArtifact = storyTask.artifacts.find(a => a.name.includes('story'));
    if (storyArtifact) {
      const fullStory = storyArtifact.parts
        .filter(p => p.type === 'text')
        .map(p => p.text)
        .join('');
      console.log(fullStory);
    }
    console.log();
    
    // Example 2: Stream orchestration progress
    console.log('2. Streaming orchestration process...');
    const orchestrationMessage = createMessage('user', [
      createTextPart('Run a batch processing orchestration and stream the progress updates')
    ]);
    
    try {
      const orchestrationTask = await client.sendTaskWithStreaming(orchestrationMessage, null, 30000);
      console.log('\nOrchestration completed!');
      console.log('Final status:', orchestrationTask.status.state);
      
      if (orchestrationTask.artifacts.length > 0) {
        console.log('Generated artifacts:');
        orchestrationTask.artifacts.forEach(artifact => {
          console.log(`- ${artifact.name} (Complete: ${artifact.isComplete})`);
        });
      }
    } catch (error) {
      if (error.message.includes('requires user input') || error.message.includes('input-required')) {
        console.log('\nNote: Orchestration requires user input and cannot be completed in streaming mode for this demo.');
        console.log('The task would need to be continued with a separate request.');
      } else {
        console.error('Orchestration error:', error.message);
      }
    }
    console.log();
    
    // Example 3: Stream data transformation
    console.log('3. Streaming data transformation...');
    const data = Array.from({ length: 1000 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
      value: Math.floor(Math.random() * 100)
    }));
    
    const transformMessage = createMessage('user', [
      createTextPart('Transform this large dataset to CSV and stream the results'),
      createDataPart(data)
    ]);
    
    const transformTask = await client.sendTaskWithStreaming(transformMessage);
    console.log('\nData transformation completed!');
    console.log('Generated artifacts:');
    transformTask.artifacts.forEach(artifact => {
      console.log(`- ${artifact.name} (Parts: ${artifact.parts.length})`);
    });
    
  } catch (error) {
    console.error('Streaming demo failed:', error.message);
  } finally {
    // Clean up connections
    client.closeAllConnections();
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runStreamingDemo().catch(console.error);
}

module.exports = A2AStreamingClient;
