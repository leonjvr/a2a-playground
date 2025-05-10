const A2AClient = require('../../client/client');
const readline = require('readline');
const {
  createMessage,
  createTextPart,
  createDataPart
} = require('../../shared/types');

/**
 * Example: Human-in-the-Loop Workflow
 * Demonstrates interactive tasks that require human input
 */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function humanInTheLoopWorkflow() {
  console.log('=== Human-in-the-Loop Workflow Scenario ===\n');
  
  const client = new A2AClient('http://localhost:3100', 'demo-bearer-token-789');
  
  try {
    // Start a document review workflow
    console.log('Starting a document review workflow that requires human approval...\n');
    
    const document = {
      id: 'doc-2024-001',
      title: 'Product Launch Strategy',
      content: `This document outlines our strategy for launching the new product line.
      Key points:
      - Target market: Young professionals (25-40)
      - Launch date: Q2 2024
      - Marketing budget: $500,000
      - Expected revenue: $2M in first year`,
      status: 'draft',
      author: 'Strategy Team'
    };
    
    // Step 1: Initial document analysis
    const analysisMessage = createMessage('user', [
      createTextPart('Analyze this document and prepare it for human review'),
      createDataPart(document)
    ]);
    
    console.log('1. Analyzing document...');
    const analysisTask = await client.sendTask(analysisMessage);
    
    if (analysisTask.status.state === 'completed') {
      const analysis = analysisTask.artifacts[0].parts[0].data;
      console.log('\n📋 Document Analysis:');
      console.log(`- Word count: ${analysis.wordCount}`);
      console.log(`- Key topics: ${analysis.keyPhrases.join(', ')}`);
      console.log(`- Readability score: ${analysis.sentiment}`);
    }
    
    // Step 2: Start review workflow
    console.log('\n2. Starting review workflow...');
    
    const reviewMessage = createMessage('user', [
      createTextPart('Start a document review workflow that requires human approval at each stage'),
      createDataPart(document)
    ]);
    
    let reviewTask = await client.sendTask(reviewMessage, null, false);
    
    // Continue the workflow with human input
    let workflowComplete = false;
    let stepNumber = 1;
    
    while (!workflowComplete) {
      // Check task status
      reviewTask = await client.getTask(reviewTask.id);
      
      if (reviewTask.status.state === 'input-required') {
        console.log(`\n📝 Human Input Required (Step ${stepNumber}):`);
        console.log('─'.repeat(50));
        
        // Display the prompt from the agent
        const promptText = reviewTask.status.message.parts.find(p => p.type === 'text')?.text;
        if (promptText) {
          console.log(promptText);
        }
        
        // Check if agent provided options
        const dataPart = reviewTask.status.message.parts.find(p => p.type === 'data');
        if (dataPart && dataPart.data.options) {
          console.log('\nOptions:');
          dataPart.data.options.forEach((option, index) => {
            console.log(`${index + 1}. ${option}`);
          });
        }
        
        // Get user input
        const userInput = await askQuestion('\nYour response: ');
        
        // Send user input to continue the workflow
        const userMessage = createMessage('user', [createTextPart(userInput)]);
        reviewTask = await client.continueTask(reviewTask.id, userMessage);
        
        stepNumber++;
      } else if (reviewTask.status.state === 'completed') {
        workflowComplete = true;
        console.log('\n✅ Review workflow completed!');
        
        // Display final results
        if (reviewTask.artifacts && reviewTask.artifacts.length > 0) {
          console.log('\n📊 Final Results:');
          reviewTask.artifacts.forEach(artifact => {
            console.log(`- ${artifact.name}`);
            if (artifact.description) {
              console.log(`  Description: ${artifact.description}`);
            }
          });
        }
      } else if (reviewTask.status.state === 'failed') {
        console.log('\n❌ Workflow failed');
        if (reviewTask.status.message) {
          console.log('Error:', reviewTask.status.message.parts[0].text);
        }
        workflowComplete = true;
      } else if (reviewTask.status.state === 'canceled') {
        console.log('\n⚠️  Workflow canceled');
        workflowComplete = true;
      } else {
        // Still processing
        console.log(`\n⏳ Step ${stepNumber}: ${reviewTask.status.state}...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      }
    }
    
    // Step 3: Final approval
    if (reviewTask.status.state === 'completed') {
      console.log('\n3. Final approval process...');
      
      const finalApprovalMessage = createMessage('user', [
        createTextPart('Generate final approval summary for this document review'),
        createDataPart({
          documentId: document.id,
          reviewTaskId: reviewTask.id,
          reviewSteps: stepNumber
        })
      ]);
      
      const approvalTask = await client.sendTask(finalApprovalMessage);
      
      if (approvalTask.status.state === 'completed') {
        console.log('\n📜 Final Approval Summary:');
        const summary = approvalTask.artifacts[0].parts[0].text;
        console.log(summary);
      }
    }
    
    console.log('\n✅ Human-in-the-loop workflow completed successfully!');
    console.log('\nWorkflow summary:');
    console.log(`- Total steps requiring human input: ${stepNumber - 1}`);
    console.log(`- Final status: ${reviewTask.status.state}`);
    console.log(`- Duration: Approximately ${stepNumber} minutes`);
    
  } catch (error) {
    console.error('\nError in human-in-the-loop workflow:', error.message);
  } finally {
    rl.close();
  }
}

// Alternative: Automated decision making example
async function automatedDecisionWorkflow() {
  console.log('\n=== Automated Decision Workflow ===\n');
  
  const client = new A2AClient('http://localhost:3100', 'demo-bearer-token-789');
  
  try {
    console.log('Demonstrating automated decision making with predefined rules...');
    
    const approvalRequest = {
      type: 'expense_approval',
      amount: 1500,
      category: 'Software',
      requestor: 'John Doe',
      description: 'Purchase of productivity software licenses',
      businessJustification: 'Required for team collaboration'
    };
    
    const decisionMessage = createMessage('user', [
      createTextPart('Process this expense approval request using automated decision rules'),
      createDataPart(approvalRequest)
    ]);
    
    console.log('Processing approval request...');
    const decisionTask = await client.sendTask(decisionMessage);
    
    if (decisionTask.status.state === 'completed') {
      const decision = decisionTask.artifacts[0].parts[0].data;
      console.log('\n📊 Automated Decision:');
      console.log(`- Status: ${decision.decision}`);
      console.log(`- Reason: ${decision.reason}`);
      console.log(`- Applied rules: ${decision.rulesApplied.join(', ')}`);
      
      if (decision.requiresEscalation) {
        console.log(`- ⚠️  Escalation required: ${decision.escalationReason}`);
      }
    }
    
  } catch (error) {
    console.error('Error in automated decision workflow:', error.message);
  }
}

// Run the appropriate scenario
async function main() {
  console.log('Select workflow scenario:');
  console.log('1. Human-in-the-loop document review');
  console.log('2. Automated decision making');
  
  const choice = await askQuestion('\nEnter choice (1 or 2): ');
  
  try {
    if (choice === '1') {
      await humanInTheLoopWorkflow();
    } else if (choice === '2') {
      await automatedDecisionWorkflow();
      rl.close();
    } else {
      console.log('Invalid choice. Running human-in-the-loop workflow...');
      await humanInTheLoopWorkflow();
    }
  } catch (error) {
    console.error('Scenario failed:', error.message);
    rl.close();
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error.message);
    rl.close();
    process.exit(1);
  });
}

module.exports = { humanInTheLoopWorkflow, automatedDecisionWorkflow };
