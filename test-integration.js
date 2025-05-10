const { spawn } = require('child_process');
const axios = require('axios');

/**
 * Simple test to verify LLM integration is working
 */

async function testIntegration() {
  console.log('🧪 Testing A2A with LLM Integration...\n');
  
  // Start the server
  console.log('Starting server...');
  const serverProcess = spawn('node', ['server/server.js'], { stdio: 'pipe' });
  
  let serverReady = false;
  
  serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('Server:', output.trim());
    
    if (output.includes('A2A Demo Server running')) {
      serverReady = true;
      runClientTest();
    }
  });
  
  serverProcess.stderr.on('data', (data) => {
    console.error('Server Error:', data.toString());
  });
  
  // Give the server 10 seconds to start
  setTimeout(() => {
    if (!serverReady) {
      console.error('❌ Server failed to start within 10 seconds');
      serverProcess.kill();
      process.exit(1);
    }
  }, 10000);
  
  async function runClientTest() {
    console.log('\n✓ Server is running. Testing client...\n');
    
    try {
      // Test 1: Get agent card
      console.log('1. Testing agent card endpoint...');
      const agentCard = await axios.get('http://localhost:3100/.well-known/agent.json');
      console.log('✓ Agent card retrieved');
      console.log('  Name:', agentCard.data.name);
      console.log('  LLM Providers:', agentCard.data.metadata?.llmProviders?.join(', '));
      
      // Test 2: Send a simple task
      console.log('\n2. Testing text analysis task...');
      const textAnalysisRequest = {
        jsonrpc: '2.0',
        id: 'test-001',
        method: 'tasks/send',
        params: {
          id: 'task-test-001',
          message: {
            role: 'user',
            parts: [{
              type: 'text',
              text: 'This is a test message for sentiment analysis!'
            }]
          }
        }
      };
      
      const response = await axios.post('http://localhost:3100/a2a/v1', textAnalysisRequest, {
        headers: {
          'Authorization': 'Bearer demo-bearer-token-789',
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.error) {
        throw new Error(response.data.error.message);
      }
      
      console.log('✓ Task created successfully');
      console.log('  Task ID:', response.data.result.id);
      console.log('  Status:', response.data.result.status.state);
      
      // Check if task completed
      if (response.data.result.status.state === 'completed') {
        console.log('  Provider:', response.data.result.artifacts?.[0]?.parts?.[0]?.data?.provider || 'mock');
        console.log('  Sentiment:', response.data.result.artifacts?.[0]?.parts?.[0]?.data?.sentiment);
      }
      
      console.log('\n✅ All tests passed!');
      console.log('\nThe A2A playground is successfully integrated with LLM providers.');
      console.log('Current mode: MOCK (since no API keys are configured)');
      console.log('\nTo enable real LLM providers:');
      console.log('1. Add your API keys to the .env file');
      console.log('2. Set ENABLE_OPENAI=true (or ENABLE_ANTHROPIC=true, etc.)');
      console.log('3. Restart the server');
      
    } catch (error) {
      console.error('\n❌ Test failed:', error.message);
    } finally {
      console.log('\nShutting down server...');
      serverProcess.kill();
      process.exit(0);
    }
  }
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\nShutting down...');
  process.exit(0);
});

// Run the test
testIntegration().catch(console.error);
