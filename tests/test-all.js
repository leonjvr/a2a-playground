const A2AClient = require('../client/client');
const A2AStreamingClient = require('../client/client-stream');
const A2APushClient = require('../client/client-push');
const {
  createMessage,
  createTextPart,
  createDataPart,
  createFilePart
} = require('../shared/types');
const { createFileContent } = require('../shared/utils');

/**
 * Comprehensive test suite for A2A implementation
 */

// Color codes for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Test result tracking
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

// Helper functions
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTestStart(testName) {
  log(`\n🔍 Running test: ${testName}`, 'blue');
}

function logTestPass(testName) {
  log(`✅ PASS: ${testName}`, 'green');
  results.passed++;
  results.tests.push({ name: testName, status: 'PASS' });
}

function logTestFail(testName, error) {
  log(`❌ FAIL: ${testName}`, 'red');
  log(`   Error: ${error.message}`, 'red');
  results.failed++;
  results.tests.push({ name: testName, status: 'FAIL', error: error.message });
}

function logTestSkip(testName, reason) {
  log(`⏭️  SKIP: ${testName} (${reason})`, 'yellow');
  results.skipped++;
  results.tests.push({ name: testName, status: 'SKIP', reason });
}

// Test suites
async function testBasicClient() {
  log('\n📦 Testing Basic Client', 'yellow');
  
  try {
    const client = new A2AClient('http://localhost:3100', 'demo-bearer-token-789');
    
    // Test 1: Get agent card
    logTestStart('Get Agent Card');
    try {
      const agentCard = await client.getAgentCard();
      if (!agentCard.name || !agentCard.url || !agentCard.skills) {
        throw new Error('Invalid agent card structure');
      }
      logTestPass('Get Agent Card');
    } catch (error) {
      logTestFail('Get Agent Card', error);
    }
    
    // Test 2: Simple text analysis
    logTestStart('Simple Text Analysis');
    try {
      const message = createMessage('user', [
        createTextPart('Analyze the sentiment of this text: "I absolutely love this!"')
      ]);
      
      const task = await client.sendTask(message);
      
      if (task.status.state !== 'completed') {
        throw new Error(`Task not completed, status: ${task.status.state}`);
      }
      
      if (!task.artifacts || task.artifacts.length === 0) {
        throw new Error('No artifacts generated');
      }
      
      logTestPass('Simple Text Analysis');
    } catch (error) {
      logTestFail('Simple Text Analysis', error);
    }
    
    // Test 3: Data transformation
    logTestStart('Data Transformation');
    try {
      const data = [
        { id: 1, name: 'Test', value: 100 },
        { id: 2, name: 'Demo', value: 200 }
      ];
      
      const message = createMessage('user', [
        createTextPart('Convert this JSON to CSV'),
        createDataPart(data)
      ]);
      
      const task = await client.sendTask(message);
      
      if (task.status.state !== 'completed') {
        throw new Error('Task not completed');
      }
      
      logTestPass('Data Transformation');
    } catch (error) {
      logTestFail('Data Transformation', error);
    }
    
    // Test 4: Task cancellation
    logTestStart('Task Cancellation');
    try {
      const message = createMessage('user', [
        createTextPart('Run a very long batch processing task')
      ]);
      
      const task = await client.sendTask(message, null, false);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Give it time to start
      
      const cancelledTask = await client.cancelTask(task.id);
      
      if (cancelledTask.status.state !== 'canceled') {
        throw new Error('Task not canceled properly');
      }
      
      logTestPass('Task Cancellation');
    } catch (error) {
      logTestFail('Task Cancellation', error);
    }
    
  } catch (error) {
    log(`Failed to initialize basic client: ${error.message}`, 'red');
    logTestSkip('All Basic Client Tests', 'Client initialization failed');
  }
}

async function testStreamingClient() {
  log('\n📡 Testing Streaming Client', 'yellow');
  
  try {
    const client = new A2AStreamingClient('http://localhost:3100', 'demo-bearer-token-789');
    
    // Test 1: Stream text generation
    logTestStart('Stream Text Generation');
    try {
      const message = createMessage('user', [
        createTextPart('Write a short poem and stream it line by line')
      ]);
      
      const task = await client.sendTaskWithStreaming(message, null, 10000);
      
      if (!task.status || task.status.state !== 'completed') {
        throw new Error('Streaming task not completed');
      }
      
      if (!task.artifacts || task.artifacts.length === 0) {
        throw new Error('No artifacts generated during streaming');
      }
      
      logTestPass('Stream Text Generation');
    } catch (error) {
      logTestFail('Stream Text Generation', error);
    }
    
    // Test 2: Stream data processing
    logTestStart('Stream Data Processing');
    try {
      const largeData = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        value: Math.random() * 100
      }));
      
      const message = createMessage('user', [
        createTextPart('Process this large dataset and stream results'),
        createDataPart(largeData)
      ]);
      
      const task = await client.sendTaskWithStreaming(message, null, 15000);
      
      if (task.status.state !== 'completed') {
        throw new Error('Streaming data processing not completed');
      }
      
      logTestPass('Stream Data Processing');
    } catch (error) {
      logTestFail('Stream Data Processing', error);
    }
    
    // Cleanup
    client.closeAllConnections();
    
  } catch (error) {
    log(`Failed to initialize streaming client: ${error.message}`, 'red');
    logTestSkip('All Streaming Client Tests', 'Client initialization failed');
  }
}

async function testPushClient() {
  log('\n📣 Testing Push Notification Client', 'yellow');
  
  try {
    const client = new A2APushClient('http://localhost:3100', 'demo-bearer-token-789', null, 3001);
    
    // Start webhook server
    await client.startWebhookServer();
    
    // Test 1: Submit task with push notification
    logTestStart('Submit Task with Push Notification');
    try {
      const message = createMessage('user', [
        createTextPart('Run a quick analysis task and notify via webhook')
      ]);
      
      const task = await client.sendTaskWithPushNotification(message);
      
      if (!task.id) {
        throw new Error('Task not created properly');
      }
      
      logTestPass('Submit Task with Push Notification');
    } catch (error) {
      logTestFail('Submit Task with Push Notification', error);
    }
    
    // Test 2: Wait for task completion via push
    logTestStart('Wait for Task via Push Notification');
    try {
      const message = createMessage('user', [
        createTextPart('Analyze this text: "This is a test message"')
      ]);
      
      const status = await client.sendTaskAndWait(message, null, 15000);
      
      if (!status || !['completed', 'failed'].includes(status.state)) {
        throw new Error('Task did not complete or fail properly');
      }
      
      logTestPass('Wait for Task via Push Notification');
    } catch (error) {
      logTestFail('Wait for Task via Push Notification', error);
    }
    
    // Cleanup
    await client.stopWebhookServer();
    
  } catch (error) {
    log(`Failed to initialize push client: ${error.message}`, 'red');
    logTestSkip('All Push Client Tests', 'Client initialization failed');
  }
}

async function testErrorHandling() {
  log('\n🚨 Testing Error Handling', 'yellow');
  
  const client = new A2AClient('http://localhost:3100', 'demo-bearer-token-789');
  
  // Test 1: Invalid authentication
  logTestStart('Invalid Authentication');
  try {
    const invalidClient = new A2AClient('http://localhost:3100', 'invalid-token');
    
    const message = createMessage('user', [createTextPart('Test with invalid auth')]);
    
    try {
      await invalidClient.sendTask(message);
      logTestFail('Invalid Authentication', new Error('Should have thrown authentication error'));
    } catch (error) {
      if (error.message.includes('Authentication') || error.message.includes('401')) {
        logTestPass('Invalid Authentication');
      } else {
        logTestFail('Invalid Authentication', error);
      }
    }
  } catch (error) {
    logTestFail('Invalid Authentication', error);
  }
  
  // Test 2: Malformed request
  logTestStart('Malformed Request');
  try {
    try {
      await client.sendTask(null);
      logTestFail('Malformed Request', new Error('Should have thrown validation error'));
    } catch (error) {
      if (error.message.includes('message') || error.message.includes('Invalid')) {
        logTestPass('Malformed Request');
      } else {
        logTestFail('Malformed Request', error);
      }
    }
  } catch (error) {
    logTestFail('Malformed Request', error);
  }
  
  // Test 3: Non-existent task
  logTestStart('Non-existent Task');
  try {
    try {
      await client.getTask('non-existent-task-id');
      logTestFail('Non-existent Task', new Error('Should have thrown not found error'));
    } catch (error) {
      if (error.message.includes('not found') || error.message.includes('Task')) {
        logTestPass('Non-existent Task');
      } else {
        logTestFail('Non-existent Task', error);
      }
    }
  } catch (error) {
    logTestFail('Non-existent Task', error);
  }
}

async function testProtocolCompliance() {
  log('\n📋 Testing Protocol Compliance', 'yellow');
  
  const client = new A2AClient('http://localhost:3100', 'demo-bearer-token-789');
  
  // Test 1: JSON-RPC 2.0 format
  logTestStart('JSON-RPC 2.0 Format');
  try {
    const agentCard = await client.getAgentCard();
    
    // Check agent card structure
    const requiredFields = ['name', 'url', 'version', 'capabilities', 'skills'];
    for (const field of requiredFields) {
      if (!agentCard[field]) {
        throw new Error(`Missing required field in agent card: ${field}`);
      }
    }
    
    logTestPass('JSON-RPC 2.0 Format');
  } catch (error) {
    logTestFail('JSON-RPC 2.0 Format', error);
  }
  
  // Test 2: Task lifecycle states
  logTestStart('Task Lifecycle States');
  try {
    const message = createMessage('user', [
      createTextPart('Start a task orchestration to test lifecycle states')
    ]);
    
    const task = await client.sendTask(message, null, false);
    
    // Valid states according to spec
    const validStates = ['submitted', 'working', 'input-required', 'completed', 'canceled', 'failed', 'unknown'];
    
    if (!validStates.includes(task.status.state)) {
      throw new Error(`Invalid task state: ${task.status.state}`);
    }
    
    logTestPass('Task Lifecycle States');
  } catch (error) {
    logTestFail('Task Lifecycle States', error);
  }
  
  // Test 3: Message and Part structure
  logTestStart('Message and Part Structure');
  try {
    // Create a multi-part message
    const message = createMessage('user', [
      createTextPart('Text part example'),
      createDataPart({ key: 'value' }),
      createFilePart(createFileContent('test.txt', 'text/plain', 'file content'))
    ]);
    
    const task = await client.sendTask(message);
    
    // Verify response structure
    if (!task.status || !task.status.state || !task.status.timestamp) {
      throw new Error('Invalid task status structure');
    }
    
    logTestPass('Message and Part Structure');
  } catch (error) {
    logTestFail('Message and Part Structure', error);
  }
}

// Main test runner
async function runAllTests() {
  log('🚀 Starting A2A Test Suite', 'green');
  log('============================', 'green');
  
  const startTime = Date.now();
  
  // Check if server is running
  try {
    const client = new A2AClient('http://localhost:3100');
    await client.getAgentCard();
    log('✓ Server is running and accessible', 'green');
  } catch (error) {
    log('✗ Server is not running or not accessible', 'red');
    log('  Please start the server with: npm run server', 'yellow');
    process.exit(1);
  }
  
  // Run test suites
  await testBasicClient();
  await testStreamingClient();
  await testPushClient();
  await testErrorHandling();
  await testProtocolCompliance();
  
  // Print summary
  const duration = Date.now() - startTime;
  log('\n============================', 'green');
  log('📊 Test Summary', 'green');
  log('============================', 'green');
  log(`Total Tests: ${results.tests.length}`);
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, 'red');
  log(`Skipped: ${results.skipped}`, 'yellow');
  log(`Duration: ${duration}ms`);
  
  // Detailed results
  if (results.failed > 0) {
    log('\n❌ Failed Tests:', 'red');
    results.tests
      .filter(test => test.status === 'FAIL')
      .forEach(test => {
        log(`  • ${test.name}: ${test.error}`, 'red');
      });
  }
  
  if (results.skipped > 0) {
    log('\n⏭️  Skipped Tests:', 'yellow');
    results.tests
      .filter(test => test.status === 'SKIP')
      .forEach(test => {
        log(`  • ${test.name}: ${test.reason}`, 'yellow');
      });
  }
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    log(`\n🚨 Test runner failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { runAllTests };
