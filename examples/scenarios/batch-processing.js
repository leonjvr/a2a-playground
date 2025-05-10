const A2AStreamingClient = require('../../client/client-stream');
const {
  createMessage,
  createTextPart,
  createDataPart,
  createFilePart
} = require('../../shared/types');
const { createFileContent } = require('../../shared/utils');

/**
 * Example: Batch Processing Pipeline
 * Demonstrates large-scale batch processing with streaming updates
 */

async function batchProcessingPipeline() {
  console.log('=== Batch Processing Pipeline Scenario ===\n');
  
  const client = new A2AStreamingClient('http://localhost:3100', 'demo-bearer-token-789');
  
  try {
    // Simulate a batch of 100 documents to process
    const documents = Array.from({ length: 100 }, (_, i) => ({
      id: `doc-${i + 1}`,
      content: `Document ${i + 1} content with various keywords and important information.`,
      metadata: {
        author: `Author ${Math.floor(Math.random() * 10) + 1}`,
        category: ['Research', 'Business', 'Technical', 'Marketing'][Math.floor(Math.random() * 4)],
        date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
      }
    }));
    
    console.log(`Starting batch processing of ${documents.length} documents...`);
    
    // Step 1: Start batch processing with streaming
    const processingMessage = createMessage('user', [
      createTextPart('Process this batch of documents for keyword extraction, sentiment analysis, and categorization'),
      createDataPart(documents, { batchSize: 10 })
    ]);
    
    console.log('\n📊 Starting batch processing with real-time progress...');
    
    let processedCount = 0;
    let startTime = Date.now();
    
    // Process with streaming to get real-time updates
    const finalTask = await client.sendTaskWithStreaming(processingMessage);
    
    console.log('\n✅ Batch processing completed!');
    
    // Analyze results
    if (finalTask.artifacts && finalTask.artifacts.length > 0) {
      const results = finalTask.artifacts.find(a => a.name.includes('batch-results'));
      if (results && results.parts[0].type === 'data') {
        const batchResults = results.parts[0].data;
        
        console.log('\n📈 Processing Summary:');
        console.log(`Total Documents: ${batchResults.totalDocuments || documents.length}`);
        console.log(`Processing Time: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
        console.log(`Documents per Second: ${(documents.length / ((Date.now() - startTime) / 1000)).toFixed(2)}`);
        
        // Show sample insights
        if (batchResults.insights) {
          console.log('\n🔍 Key Insights:');
          console.log(`- Common Keywords: ${JSON.stringify(batchResults.insights.topKeywords || [])}`);
          console.log(`- Sentiment Distribution: ${JSON.stringify(batchResults.insights.sentimentDistribution || {})}`);
          console.log(`- Category Breakdown: ${JSON.stringify(batchResults.insights.categoryBreakdown || {})}`);
        }
      }
    }
    
    // Step 2: Generate summary report
    console.log('\n📑 Generating comprehensive report...');
    
    const reportMessage = createMessage('user', [
      createTextPart('Generate a comprehensive batch processing report including visualizations'),
      createDataPart({
        processedDocuments: documents.length,
        processingTime: Date.now() - startTime,
        taskId: finalTask.id
      })
    ]);
    
    const reportTask = await client.sendTaskWithStreaming(reportMessage);
    
    if (reportTask.artifacts) {
      console.log('\n📊 Generated Reports:');
      reportTask.artifacts.forEach(artifact => {
        console.log(`- ${artifact.name}: ${artifact.parts.length} parts`);
      });
    }
    
    // Step 3: Archive processed data
    console.log('\n💾 Archiving results...');
    
    const archiveMessage = createMessage('user', [
      createTextPart('Archive the batch processing results in multiple formats'),
      createDataPart({
        sourceTaskId: finalTask.id,
        formats: ['json', 'csv', 'pdf']
      })
    ]);
    
    const archiveTask = await client.sendTaskWithStreaming(archiveMessage);
    
    console.log('✅ Batch processing pipeline completed successfully!');
    console.log('\nPipeline steps executed:');
    console.log('1. ✓ Document batch processing');
    console.log('2. ✓ Analysis and insights generation');
    console.log('3. ✓ Report generation');
    console.log('4. ✓ Data archiving');
    
  } catch (error) {
    console.error('Error in batch processing pipeline:', error.message);
  } finally {
    client.closeAllConnections();
  }
}

// Run the scenario
if (require.main === module) {
  batchProcessingPipeline().catch(console.error);
}

module.exports = batchProcessingPipeline;
