const A2AClient = require('../../client/client');
const {
  createMessage,
  createTextPart,
  createDataPart
} = require('../../shared/types');

/**
 * Example: Multi-Agent Collaboration
 * Demonstrates how multiple agents could work together on a complex task
 */

async function multiAgentCollaboration() {
  console.log('=== Multi-Agent Collaboration Scenario ===\n');
  
  // In a real scenario, these would be different agent URLs
  const agents = {
    dataAnalyst: new A2AClient('http://localhost:3100', 'demo-bearer-token-789'),
    reportWriter: new A2AClient('http://localhost:3100', 'demo-bearer-token-789'),
    visualizer: new A2AClient('http://localhost:3100', 'demo-bearer-token-789')
  };
  
  try {
    // Step 1: Data Analyst processes raw data
    console.log('1. Data Analyst: Processing raw sales data...');
    
    const rawSalesData = [
      { month: 'Jan', sales: 50000, region: 'North' },
      { month: 'Jan', sales: 45000, region: 'South' },
      { month: 'Feb', sales: 55000, region: 'North' },
      { month: 'Feb', sales: 48000, region: 'South' },
      { month: 'Mar', sales: 60000, region: 'North' },
      { month: 'Mar', sales: 52000, region: 'South' }
    ];
    
    const analysisMessage = createMessage('user', [
      createTextPart('Analyze this sales data and provide statistical insights'),
      createDataPart(rawSalesData)
    ]);
    
    const analysisTask = await agents.dataAnalyst.sendTask(analysisMessage);
    const analysisResults = analysisTask.artifacts[0].parts[0].data;
    
    console.log('✓ Analysis completed');
    console.log('  Key insights:', JSON.stringify(analysisResults, null, 2));
    
    // Step 2: Report Writer creates narrative
    console.log('\n2. Report Writer: Creating executive summary...');
    
    const reportMessage = createMessage('user', [
      createTextPart('Create an executive summary report based on this sales analysis'),
      createDataPart(analysisResults)
    ]);
    
    const reportTask = await agents.reportWriter.sendTask(reportMessage);
    const executiveSummary = reportTask.artifacts[0].parts[0].text;
    
    console.log('✓ Report completed');
    console.log('  Executive summary:', executiveSummary.substring(0, 200) + '...');
    
    // Step 3: Visualizer creates charts
    console.log('\n3. Visualizer: Generating data visualizations...');
    
    const visualMessage = createMessage('user', [
      createTextPart('Create a visualization configuration for this sales data'),
      createDataPart({
        rawData: rawSalesData,
        analysis: analysisResults
      })
    ]);
    
    const visualTask = await agents.visualizer.sendTask(visualMessage);
    const visualConfig = visualTask.artifacts[0].parts[0].data;
    
    console.log('✓ Visualization completed');
    console.log('  Chart configuration created');
    
    // Step 4: Combine all results
    console.log('\n4. Combining all outputs into final deliverable...');
    
    const finalReport = {
      title: 'Q1 2024 Sales Performance Report',
      executiveSummary,
      statisticalAnalysis: analysisResults,
      visualizations: visualConfig,
      generatedAt: new Date().toISOString(),
      contributors: ['Data Analyst Agent', 'Report Writer Agent', 'Visualizer Agent']
    };
    
    console.log('\n✅ Multi-agent collaboration completed!');
    console.log('Final deliverable structure:');
    console.log(Object.keys(finalReport));
    
  } catch (error) {
    console.error('Error in multi-agent collaboration:', error.message);
  }
}

// Run the scenario
if (require.main === module) {
  multiAgentCollaboration().catch(console.error);
}

module.exports = multiAgentCollaboration;
