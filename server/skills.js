const { 
  createMessage, 
  createTextPart, 
  createFilePart, 
  createDataPart, 
  createArtifact 
} = require('../shared/types');
const { 
  delay, 
  createFileContent, 
  parseFileContent
} = require('../shared/utils');
const llmService = require('./llm-service');

/**
 * Skills implementation for the A2A demo agent using real LLM services
 */

const skills = {
  // Text Analysis & Processing
  'text-analysis': {
    async process(task) {
      const message = task.status.message;
      let textToAnalyze = '';
      let provider = null;
      
      // Extract text and optional provider from user message
      for (const part of message.parts) {
        if (part.type === 'text') {
          textToAnalyze += part.text + ' ';
        } else if (part.type === 'data' && part.data && part.data.provider) {
          provider = part.data.provider;
        }
      }
      
      textToAnalyze = textToAnalyze.trim();
      
      if (!textToAnalyze) {
        throw new Error('No text provided for analysis');
      }
      
      try {
        // Use real LLM analysis - pass undefined instead of null to use default provider
        const analysis = await llmService.analyzeText(textToAnalyze, provider === null ? undefined : provider);
        
        // Create response message
        const responseParts = [
          createTextPart(`Text analysis completed using ${analysis.provider} (${analysis.model})!`),
          createDataPart(analysis, { mimeType: 'application/json' })
        ];
        
        // Create artifacts
        const artifacts = [
          createArtifact(
            'text-analysis-results.json',
            [createDataPart(analysis, { mimeType: 'application/json' })],
            `Detailed text analysis results from ${analysis.provider}`
          ),
          createArtifact(
            'analysis-summary.txt',
            [createTextPart(formatAnalysisSummary(analysis))],
            'Human-readable summary of the analysis'
          )
        ];
        
        return {
          message: createMessage('agent', responseParts),
          artifacts
        };
      } catch (error) {
        console.error('Error in text analysis:', error);
        throw error;
      }
    }
  },
  
  // Image Processing & Analysis
  'image-processing': {
    async process(task) {
      const message = task.status.message;
      let imageFile = null;
      let processingInstructions = null;
      let provider = null;
      
      // Extract image, instructions, and optional provider from user message
      for (const part of message.parts) {
        if (part.type === 'file' && part.file.mimeType?.startsWith('image/')) {
          imageFile = part.file;
        } else if (part.type === 'text') {
          processingInstructions = part.text;
        } else if (part.type === 'data' && part.data && part.data.provider) {
          provider = part.data.provider;
        }
      }
      
      if (!imageFile) {
        throw new Error('No image provided for processing');
      }
      
      try {
        // Parse the image
        const parsedImage = parseFileContent(imageFile);
        
        if (parsedImage.source === 'bytes') {
          // Convert bytes to base64 for LLM
          const base64Image = Buffer.from(parsedImage.data).toString('base64');
          
          // Use real LLM for image analysis - pass undefined instead of null to use default
          const prompt = `Analyze this image and ${processingInstructions || 'describe what you see'}. 
          Provide a detailed description and any relevant information.`;
          
          try {
            const result = await llmService.processImage(base64Image, prompt, provider === null ? 'openai' : (provider || 'openai'));
            
            // Generate mock processing results (for demo purposes)
            const processingResults = {
              originalDimensions: { width: 800, height: 600 },
              processedDimensions: { width: 400, height: 300 },
              description: result.text,
              provider: result.provider,
              model: result.model,
              processingTime: '2.1 seconds'
            };
            
            // Create processed image (mock)
            const processedImageContent = createFileContent(
              'processed-image.png',
              'image/png',
              Buffer.from('mock-processed-image-data')
            );
            
            // Create response message
            const responseParts = [
              createTextPart(`Image processing completed using ${result.provider}!`),
              createDataPart(processingResults, { mimeType: 'application/json' }),
              createFilePart(processedImageContent, { note: 'Processed image' })
            ];
            
            // Create artifacts
            const artifacts = [
              createArtifact(
                'processed-image.png',
                [createFilePart(processedImageContent)],
                'Processed version of the input image'
              ),
              createArtifact(
                'processing-results.json',
                [createDataPart(processingResults, { mimeType: 'application/json' })],
                `Detailed image processing results from ${result.provider}`
              )
            ];
            
            return {
              message: createMessage('agent', responseParts),
              artifacts
            };
          } catch (imageProcessingError) {
            console.error('Error processing image with LLM:', imageProcessingError);
            
            // Return error response
            const errorParts = [
              createTextPart(`Image processing failed: ${imageProcessingError.message || 'Unknown error occurred'}`),
              createDataPart({
                error: true,
                errorMessage: imageProcessingError.message || 'Unknown error',
                errorCode: imageProcessingError.code || 'PROCESSING_ERROR'
              }, { mimeType: 'application/json' })
            ];
            
            return {
              message: createMessage('agent', errorParts),
              artifacts: []
            };
          }
        } else {
          throw new Error('Image processing from URI not implemented yet');
        }
      } catch (error) {
        console.error('Error in image processing:', error);
        
        // Ensure we always return a proper structure even on error
        const errorParts = [
          createTextPart(`Image processing failed: ${error.message || 'Unknown error occurred'}`),
          createDataPart({
            error: true,
            errorMessage: error.message || 'Unknown error',
            errorCode: error.code || 'PROCESSING_ERROR'
          }, { mimeType: 'application/json' })
        ];
        
        return {
          message: createMessage('agent', errorParts),
          artifacts: []
        };
      }
    }
  },
  
  // Data Transformation & Formatting
  'data-transformation': {
    async process(task) {
      const message = task.status.message;
      let inputData = null;
      let targetFormat = null;
      let provider = null;
      
      // Extract data, format, and provider from user message
      for (const part of message.parts) {
        if (part.type === 'data') {
          if (part.data && part.data.inputData) {
            inputData = part.data.inputData;
          } else if (part.data && part.data.provider) {
            provider = part.data.provider;
          } else {
            inputData = part.data;
          }
        } else if (part.type === 'text') {
          if (part.text.includes('CSV')) targetFormat = 'CSV';
          else if (part.text.includes('JSON')) targetFormat = 'JSON';
          else if (part.text.includes('XML')) targetFormat = 'XML';
          else targetFormat = 'JSON'; // default
        }
      }
      
      if (!inputData) {
        throw new Error('No data provided for transformation');
      }
      
      try {
        // Use real LLM for data transformation - pass undefined instead of null to use default
        const transformedData = await llmService.transformData(inputData, targetFormat, provider === null ? undefined : provider);
        
        let outputMimeType;
        let outputFileName;
        
        switch (targetFormat) {
          case 'CSV':
            outputMimeType = 'text/csv';
            outputFileName = 'transformed-data.csv';
            break;
          case 'XML':
            outputMimeType = 'application/xml';
            outputFileName = 'transformed-data.xml';
            break;
          case 'JSON':
          default:
            outputMimeType = 'application/json';
            outputFileName = 'transformed-data.json';
            break;
        }
        
        // Create response message
        const responseParts = [
          createTextPart(`Data transformation completed! Converted to ${targetFormat} using ${provider === null ? 'mock' : (provider || 'default')}.`),
          createDataPart({ 
            transformationType: targetFormat,
            recordCount: Array.isArray(inputData) ? inputData.length : 1,
            outputSize: transformedData.length,
            provider: provider === null ? 'mock' : (provider || 'default')
          })
        ];
        
        // Create artifacts
        const artifacts = [
          createArtifact(
            outputFileName,
            [createDataPart(transformedData, { mimeType: outputMimeType })],
            `Data transformed to ${targetFormat} format using ${provider === null ? 'mock' : (provider || 'default')}`
          )
        ];
        
        return {
          message: createMessage('agent', responseParts),
          artifacts
        };
      } catch (error) {
        console.error('Error in data transformation:', error);
        throw error;
      }
    }
  },
  
  // Complex Task Orchestration
  'task-orchestration': {
    async process(task, taskManager) {
      const message = task.status.message;
      let orchestrationPlan = null;
      let provider = null;
      
      // Extract orchestration instructions and provider
      for (const part of message.parts) {
        if (part.type === 'text') {
          if (part.text.includes('batch')) orchestrationPlan = 'batch-processing';
          else if (part.text.includes('pipeline')) orchestrationPlan = 'data-pipeline';
          else if (part.text.includes('report')) orchestrationPlan = 'analytics-report';
          else orchestrationPlan = 'custom-workflow';
        } else if (part.type === 'data' && part.data && part.data.provider) {
          provider = part.data.provider;
        }
      }
      
      // Generate orchestration steps using LLM
      const prompt = `Create a detailed orchestration plan for: ${orchestrationPlan}. 
      
      Return a JSON array of steps, where each step has:
      - name: step name
      - duration: estimated time in milliseconds
      - requiresInput: boolean
      - description: what this step does
      
      Create 4-6 realistic steps for this orchestration.`;
      
      try {
        // Pass undefined instead of null to use default provider
        const result = await llmService.generateText(prompt, provider === null ? undefined : provider);
        const stepsText = result.text.replace(/```json\n?|\n?```/g, '').trim();
        const steps = JSON.parse(stepsText).map((step, index) => ({
          ...step,
          number: index + 1,
          status: 'pending'
        }));
        
        // Store orchestration state in task metadata
        task.metadata = task.metadata || {};
        task.metadata.orchestration = {
          plan: orchestrationPlan,
          steps,
          currentStep: 0,
          startTime: new Date().toISOString(),
          provider: result.provider
        };
        
        // Start processing the first step
        await delay(500);
        
        // Return initial response
        return {
          message: createMessage('agent', [
            createTextPart(`Starting ${orchestrationPlan} orchestration with ${steps.length} steps using ${result.provider}...`),
            createDataPart({
              plan: orchestrationPlan,
              totalSteps: steps.length,
              estimatedTime: calculateTotalTime(steps),
              provider: result.provider
            })
          ]),
          artifacts: []
        };
      } catch (error) {
        console.error('Error in task orchestration:', error);
        throw error;
      }
    },
    
    // Continue orchestration after user input
    async continueOrchestration(task, taskManager) {
      const orchestration = task.metadata?.orchestration;
      if (!orchestration) {
        throw new Error('No orchestration state found');
      }
      
      const { steps, currentStep } = orchestration;
      const nextStep = currentStep + 1;
      
      if (nextStep >= steps.length) {
        return this.completeOrchestration(task, orchestration);
      }
      
      // Update orchestration state
      orchestration.currentStep = nextStep;
      
      // Process next step
      const step = steps[nextStep];
      await delay(step.duration);
      
      // Check if step requires user input
      if (step.requiresInput) {
        return this.requestUserInput(task, step);
      }
      
      // Continue to next step
      return this.continueOrchestration(task, taskManager);
    },
    
    async requestUserInput(task, step) {
      // Update task to input-required state
      task.status = {
        state: 'input-required',
        message: createMessage('agent', [
          createTextPart(`Step "${step.name}" requires user input:`),
          createTextPart(step.description || 'Please provide the required input to continue.'),
          createDataPart({
            stepNumber: step.number,
            inputType: step.inputType || 'text',
            options: step.options || null
          })
        ]),
        timestamp: new Date().toISOString()
      };
      
      return {
        message: task.status.message,
        artifacts: []
      };
    },
    
    async completeOrchestration(task, orchestration) {
      const { plan, steps, startTime, provider } = orchestration;
      const endTime = new Date().toISOString();
      const duration = new Date(endTime) - new Date(startTime);
      
      // Create final report using LLM
      const reportPrompt = `Generate a completion report for the ${plan} orchestration.
      
      Details:
      - Plan: ${plan}
      - Total steps: ${steps.length}
      - Duration: ${Math.round(duration / 1000)}s
      - Provider: ${provider}
      
      Create a professional summary with key metrics and outcomes.`;
      
      try {
        // Pass undefined instead of null to use default provider
        const result = await llmService.generateText(reportPrompt, provider === null ? undefined : provider);
        
        const report = {
          plan,
          totalSteps: steps.length,
          completedSteps: steps.length,
          startTime,
          endTime,
          duration: `${Math.round(duration / 1000)}s`,
          status: 'completed',
          provider: provider || result.provider,
          summary: result.text,
          results: generateOrchestrationResults(steps)
        };
        
        // Create artifacts
        const artifacts = [
          createArtifact(
            'orchestration-report.json',
            [createDataPart(report, { mimeType: 'application/json' })],
            `Detailed orchestration execution report (${provider || result.provider})`
          ),
          createArtifact(
            'orchestration-summary.txt',
            [createTextPart(formatOrchestrationSummary(report))],
            'Human-readable orchestration summary'
          )
        ];
        
        return {
          message: createMessage('agent', [
            createTextPart(`Orchestration completed successfully using ${provider || result.provider}!`),
            createTextPart(`Executed ${steps.length} steps in ${report.duration}`),
            createDataPart(report, { mimeType: 'application/json' })
          ]),
          artifacts
        };
      } catch (error) {
        console.error('Error completing orchestration:', error);
        throw error;
      }
    }
  }
};

// Helper functions

function formatAnalysisSummary(analysis) {
  return `Text Analysis Summary (${analysis.provider})
====================
Word Count: ${analysis.wordCount}
Character Count: ${analysis.characterCount}
Sentiment: ${analysis.sentiment}
Language: ${analysis.detectedLanguage}
Key Phrases: ${analysis.keyPhrases.join(', ')}
Summary: ${analysis.summary}
Provider: ${analysis.provider} (${analysis.model})`;
}

function calculateTotalTime(steps) {
  const totalMs = steps.reduce((sum, step) => sum + step.duration, 0);
  return `${Math.round(totalMs / 1000)}s`;
}

function generateOrchestrationResults(steps) {
  return steps.map(step => ({
    step: step.number,
    name: step.name,
    status: 'completed',
    duration: `${step.duration}ms`,
    output: `Completed: ${step.description || step.name}`
  }));
}

function formatOrchestrationSummary(report) {
  return `Orchestration Summary
====================
Plan: ${report.plan}
Status: ${report.status}
Total Steps: ${report.totalSteps}
Duration: ${report.duration}
Start Time: ${report.startTime}
End Time: ${report.endTime}
Provider: ${report.provider}

Summary:
${report.summary}

Step Results:
${report.results.map(r => `- Step ${r.step}: ${r.name} (${r.duration})`).join('\n')}`;
}

module.exports = skills;
