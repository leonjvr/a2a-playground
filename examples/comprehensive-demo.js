const A2AClient = require('../client/client');
const A2AStreamingClient = require('../client/client-stream');
const A2APushClient = require('../client/client-push');
const {
  createMessage,
  createTextPart,
  createDataPart,
  createFilePart
} = require('../shared/types');
const { createFileContent, generateSessionId } = require('../shared/utils');

/**
 * Comprehensive A2A Demo
 * Showcases all major features and interaction patterns
 */

async function runComprehensiveDemo() {
  console.log('=== Comprehensive A2A Protocol Demo ===\n');
  console.log('This demo showcases all major features of the A2A protocol implementation.\n');
  
  // Initialize clients
  const basicClient = new A2AClient('http://localhost:3100', 'demo-bearer-token-789');
  const streamingClient = new A2AStreamingClient('http://localhost:3100', 'demo-bearer-token-789');
  const pushClient = new A2APushClient('http://localhost:3100', 'demo-bearer-token-789', null, 3002);
  
  try {
    // Section 1: Agent Discovery
    console.log('1️⃣  AGENT DISCOVERY');
    console.log('─'.repeat(30));
    
    const agentCard = await basicClient.getAgentCard();
    console.log(`Agent: ${agentCard.name}`);
    console.log(`Version: ${agentCard.version}`);
    console.log(`Capabilities: Streaming=${agentCard.capabilities.streaming}, Push=${agentCard.capabilities.pushNotifications}`);
    console.log(`Available skills: ${agentCard.skills.length}`);
    
    agentCard.skills.forEach(skill => {
      console.log(`  - ${skill.name}: ${skill.description.substring(0, 80)}...`);
    });
    
    console.log('\n✓ Agent discovery completed\n');
    
    // Section 2: Basic Task Execution
    console.log('2️⃣  BASIC TASK EXECUTION');
    console.log('─'.repeat(30));
    
    // Create a session for related tasks
    const sessionId = generateSessionId();
    
    // Text analysis task
    console.log('Executing text analysis task...');
    const textMessage = createMessage('user', [
      createTextPart('Analyze the sentiment and extract key phrases from this text: "The new product launch exceeded all expectations! Our team worked incredibly hard, and the customer response has been overwhelmingly positive. Sales figures are up 150% compared to projections."')
    ]);
    
    const textTask = await basicClient.sendTask(textMessage, sessionId);
    console.log(`Task Status: ${textTask.status.state}`);
    
    if (textTask.artifacts && textTask.artifacts.length > 0) {
      const analysis = textTask.artifacts[0].parts[0].data;
      console.log(`Sentiment: ${analysis.sentiment}`);
      console.log(`Key phrases: ${analysis.keyPhrases.join(', ')}`);
    }
    
    // Data transformation task
    console.log('\nExecuting data transformation task...');
    const sampleData = [
      { product: 'Widget A', sales: 1200, growth: 15 },
      { product: 'Widget B', sales: 950, growth: 8 },
      { product: 'Widget C', sales: 1800, growth: 25 }
    ];
    
    const dataMessage = createMessage('user', [
      createTextPart('Convert this sales data to CSV format and add a total row'),
      createDataPart(sampleData)
    ]);
    
    const dataTask = await basicClient.sendTask(dataMessage, sessionId);
    console.log(`Task Status: ${dataTask.status.state}`);
    
    console.log('\n✓ Basic tasks completed\n');
    
    // Section 3: Streaming Operations
    console.log('3️⃣  STREAMING OPERATIONS');
    console.log('─'.repeat(30));
    
    console.log('Starting long-running task with streaming updates...');
    
    const streamMessage = createMessage('user', [
      createTextPart('Generate a short story about AI and stream it paragraph by paragraph')
    ]);
    
    const streamTask = await streamingClient.sendTaskWithStreaming(streamMessage, sessionId, 15000);
    
    if (streamTask.artifacts && streamTask.artifacts.length > 0) {
      const story = streamTask.artifacts.find(a => a.isComplete);
      if (story) {
        const fullText = story.parts.filter(p => p.type === 'text').map(p => p.text).join('');
        console.log('\nGenerated story (first 200 chars):');
        console.log(fullText.substring(0, 200) + '...');
      }
    }
    
    streamingClient.closeAllConnections();
    console.log('\n✓ Streaming completed\n');
    
    // Section 4: Push Notifications
    console.log('4️⃣  PUSH NOTIFICATIONS');
    console.log('─'.repeat(30));
    
    console.log('Starting push notification webhook server...');
    await pushClient.startWebhookServer();
    
    console.log('Submitting long-running task with push notifications...');
    
    const pushMessage = createMessage('user', [
      createTextPart('Run a comprehensive analysis that takes several minutes and notify when complete')
    ]);
    
    const pushTask = await pushClient.sendTaskWithPushNotification(pushMessage, sessionId);
    console.log(`Task submitted: ${pushTask.id}`);
    console.log('Waiting for push notifications...');
    
    // Wait for demonstration purposes
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await pushClient.stopWebhookServer();
    console.log('\n✓ Push notifications demonstrated\n');
    
    // Section 5: Multi-Turn Interaction
    console.log('5️⃣  MULTI-TURN INTERACTION');
    console.log('─'.repeat(30));
    
    console.log('Starting multi-turn conversation...');
    
    // Start a conversation
    const conversationMessage = createMessage('user', [
      createTextPart('I need help planning a marketing campaign. Can you help me with the initial strategy?')
    ]);
    
    let conversationTask = await basicClient.sendTask(conversationMessage, sessionId, false);
    console.log(`Initial response: ${conversationTask.status.state}`);
    
    // Continue conversation
    if (conversationTask.status.state === 'completed') {
      const followUpMessage = createMessage('user', [
        createTextPart('Great! Now can you help me estimate the budget for this campaign?')
      ]);
      
      // This would be a new task continuing the conversation
      conversationTask = await basicClient.sendTask(followUpMessage, sessionId);
      console.log(`Follow-up response: ${conversationTask.status.state}`);
    }
    
    console.log('\n✓ Multi-turn interaction completed\n');
    
    // Section 6: File Handling
    console.log('6️⃣  FILE HANDLING');
    console.log('─'.repeat(30));
    
    console.log('Demonstrating file upload and processing...');
    
    // Create a mock file
    const mockImageData = Buffer.from('mock-image-data');
    const imageFile = createFileContent('sample-chart.png', 'image/png', mockImageData);
    
    const fileMessage = createMessage('user', [
      createTextPart('Extract text and analyze this chart image'),
      createFilePart(imageFile)
    ]);
    
    const fileTask = await basicClient.sendTask(fileMessage, sessionId);
    console.log(`File processing status: ${fileTask.status.state}`);
    
    console.log('\n✓ File handling completed\n');
    
    // Section 7: Session Summary
    console.log('7️⃣  SESSION SUMMARY');
    console.log('─'.repeat(30));
    
    console.log(`Session ID: ${sessionId}`);
    console.log('Tasks completed in this session:');
    console.log('1. Text sentiment analysis');
    console.log('2. Data transformation to CSV');
    console.log('3. Story generation with streaming');
    console.log('4. Long-running task with push notifications');
    console.log('5. Multi-turn conversation');
    console.log('6. File processing');
    
    console.log('\n✅ COMPREHENSIVE DEMO COMPLETED SUCCESSFULLY!');
    console.log('\nKey features demonstrated:');
    console.log('✓ Agent discovery via Agent Card');
    console.log('✓ Synchronous task execution');
    console.log('✓ Asynchronous streaming updates');
    console.log('✓ Push notifications via webhooks');
    console.log('✓ Multi-turn conversations');
    console.log('✓ File upload and processing');
    console.log('✓ Session management');
    console.log('✓ Multiple content types (text, data, files)');
    console.log('✓ Error handling and task lifecycle');
    
  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    // Cleanup
    if (streamingClient) {
      streamingClient.closeAllConnections();
    }
    if (pushClient && pushClient.webhookServer) {
      await pushClient.stopWebhookServer();
    }
  }
}

// Performance metrics
async function measurePerformance() {
  console.log('\n\n📊 PERFORMANCE METRICS');
  console.log('─'.repeat(30));
  
  const client = new A2AClient('http://localhost:3100', 'demo-bearer-token-789');
  const iterations = 10;
  const times = [];
  
  console.log(`Running ${iterations} iterations of basic tasks...`);
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    
    const message = createMessage('user', [
      createTextPart(`Iteration ${i + 1}: Analyze this text quickly`)
    ]);
    
    await client.sendTask(message);
    
    const duration = Date.now() - start;
    times.push(duration);
    process.stdout.write(`\r${i + 1}/${iterations} completed...`);
  }
  
  console.log('\n\nPerformance Results:');
  console.log(`Average response time: ${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(2)}ms`);
  console.log(`Minimum response time: ${Math.min(...times)}ms`);
  console.log(`Maximum response time: ${Math.max(...times)}ms`);
  console.log(`Standard deviation: ${calculateStdDev(times).toFixed(2)}ms`);
}

// Helper function for standard deviation
function calculateStdDev(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

// Main execution
async function main() {
  console.log('🚀 Starting Comprehensive A2A Demo\n');
  
  // Check if server is running
  try {
    const testClient = new A2AClient('http://localhost:3100');
    await testClient.getAgentCard();
    console.log('✓ Server is running and accessible\n');
  } catch (error) {
    console.error('❌ Server is not accessible. Please start the server first.');
    console.error('   Run: npm run server\n');
    process.exit(1);
  }
  
  // Run the main demo
  await runComprehensiveDemo();
  
  // Optional: Run performance tests
  const runPerformanceTests = process.argv.includes('--performance');
  if (runPerformanceTests) {
    await measurePerformance();
  }
  
  console.log('\n📝 Demo completed. Thank you for exploring A2A!');
  process.exit(0);
}

// Run the demo if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { runComprehensiveDemo, measurePerformance };
