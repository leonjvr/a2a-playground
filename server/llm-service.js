require('dotenv').config();
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");

/**
 * LLM Service for integrating multiple LLM providers
 */

class LLMService {
  constructor() {
    this.providers = {};
    this.defaultProvider = process.env.DEFAULT_LLM_PROVIDER || 'openai';
    this.mockMode = true; // Will be set to false if any real provider is enabled
    
    // Initialize OpenAI
    if (process.env.ENABLE_OPENAI === 'true' && process.env.OPENAI_API_KEY) {
      this.providers.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      this.mockMode = false;
      console.log('✓ OpenAI initialized');
    }
    
    // Initialize Anthropic
    if (process.env.ENABLE_ANTHROPIC === 'true' && process.env.ANTHROPIC_API_KEY) {
      this.providers.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      this.mockMode = false;
      console.log('✓ Anthropic initialized');
    }
    
    // Initialize Azure OpenAI
    if (process.env.ENABLE_AZURE === 'true' && process.env.AZURE_OPENAI_KEY) {
      this.providers.azure = new OpenAIClient(
        process.env.AZURE_OPENAI_ENDPOINT,
        new AzureKeyCredential(process.env.AZURE_OPENAI_KEY)
      );
      this.mockMode = false;
      console.log('✓ Azure OpenAI initialized');
    }
    
    if (this.mockMode) {
      console.log('⚠️  Running in MOCK MODE - No LLM providers enabled');
      console.log('   To enable real LLM providers, add API keys to .env and set ENABLE_[PROVIDER]=true');
    } else {
      console.log(`Default LLM provider: ${this.defaultProvider}`);
    }
  }
  
  getAvailableProviders() {
    if (this.mockMode) {
      return ['mock'];
    }
    return Object.keys(this.providers);
  }
  
  async analyzeText(text, provider) {
    if (this.mockMode) {
      return this.mockAnalyzeText(text);
    }
    
    // If provider is null or undefined, use the default
    const actualProvider = (provider === null || provider === undefined) ? this.defaultProvider : provider;
    
    if (!this.providers[actualProvider]) {
      throw new Error(`Provider ${actualProvider} is not available. Available providers: ${this.getAvailableProviders().join(', ')}`);
    }
    
    try {
      switch (actualProvider) {
        case 'openai':
          return await this.analyzeWithOpenAI(text);
        case 'anthropic':
          return await this.analyzeWithAnthropic(text);
        case 'azure':
          return await this.analyzeWithAzure(text);
        default:
          throw new Error(`Unknown provider: ${actualProvider}`);
      }
    } catch (error) {
      console.error(`Error with ${actualProvider}:`, error.message);
      throw error;
    }
  }
  
  // Mock implementation for when no LLM providers are enabled
  mockAnalyzeText(text) {
    // Extract mock key phrases
    const words = text.toLowerCase().split(/\s+/);
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    const keyWords = words.filter(word => word.length > 3 && !commonWords.has(word));
    const keyPhrases = keyWords.slice(0, 5).map(word => word.charAt(0).toUpperCase() + word.slice(1));
    
    // Mock sentiment analysis
    const positiveWords = ['good', 'great', 'excellent', 'wonderful', 'amazing', 'love', 'fantastic', 'awesome'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'horrible', 'disgusting', 'worst'];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) positiveCount++;
      if (negativeWords.includes(word)) negativeCount++;
    });
    
    let sentiment = 'neutral';
    if (positiveCount > negativeCount) sentiment = 'positive';
    if (negativeCount > positiveCount) sentiment = 'negative';
    
    // Mock summary
    const sentences = text.split(/[.!?]+/);
    const summary = sentences[0] + (sentences.length > 1 ? '...' : '');
    
    return {
      wordCount: text.split(/\s+/).length,
      characterCount: text.length,
      sentiment,
      detectedLanguage: 'en',
      keyPhrases,
      summary,
      provider: 'mock',
      model: 'mock-model'
    };
  }
  
  async analyzeWithOpenAI(text) {
    const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    
    const completion = await this.providers.openai.chat.completions.create({
      model: model,
      messages: [{
        role: "user",
        content: `Analyze this text for sentiment, key phrases (up to 5), and provide a brief summary:

Text: "${text}"

Return your response in JSON format with these fields:
- sentiment: (positive/negative/neutral)
- keyPhrases: (array of strings)
- summary: (string)
- wordCount: (number)
- characterCount: (number)
- detectedLanguage: (string)`
      }],
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 1000,
      temperature: 0.7,
      response_format: { type: "json_object" }
    });
    
    const analysisText = completion.choices[0].message.content;
    const analysis = JSON.parse(analysisText);
    
    return {
      ...analysis,
      provider: 'openai',
      model: model,
      wordCount: text.split(/\s+/).length,
      characterCount: text.length
    };
  }
  
  async analyzeWithAnthropic(text) {
    const model = process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307';
    
    const response = await this.providers.anthropic.messages.create({
      model: model,
      max_tokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS) || 1000,
      messages: [{
        role: "user",
        content: `Analyze this text for sentiment, key phrases (up to 5), and provide a brief summary:

Text: "${text}"

Return your response in JSON format with these fields:
- sentiment: (positive/negative/neutral)
- keyPhrases: (array of strings)
- summary: (string)
- detectedLanguage: (string)`
      }]
    });
    
    const analysisText = response.content[0].text;
    const analysis = JSON.parse(analysisText);
    
    return {
      ...analysis,
      provider: 'anthropic',
      model: model,
      wordCount: text.split(/\s+/).length,
      characterCount: text.length
    };
  }
  
  async analyzeWithAzure(text) {
    const deploymentName = process.env.AZURE_DEPLOYMENT_NAME;
    
    const result = await this.providers.azure.getChatCompletions(
      deploymentName,
      [{
        role: "user",
        content: `Analyze this text for sentiment, key phrases (up to 5), and provide a brief summary:

Text: "${text}"

Return your response in JSON format with these fields:
- sentiment: (positive/negative/neutral)
- keyPhrases: (array of strings)
- summary: (string)
- detectedLanguage: (string)`
      }],
      {
        maxTokens: parseInt(process.env.AZURE_MAX_TOKENS) || 1000,
        temperature: 0.7
      }
    );
    
    const analysisText = result.choices[0].message.content;
    const analysis = JSON.parse(analysisText);
    
    return {
      ...analysis,
      provider: 'azure',
      model: deploymentName,
      wordCount: text.split(/\s+/).length,
      characterCount: text.length
    };
  }
  
  async generateText(prompt, provider, options = {}) {
    if (this.mockMode) {
      return this.mockGenerateText(prompt);
    }
    
    // If provider is null or undefined, use the default
    const actualProvider = (provider === null || provider === undefined) ? this.defaultProvider : provider;
    
    if (!this.providers[actualProvider]) {
      throw new Error(`Provider ${actualProvider} is not available. Available providers: ${this.getAvailableProviders().join(', ')}`);
    }
    
    try {
      switch (actualProvider) {
        case 'openai':
          return await this.generateWithOpenAI(prompt, options);
        case 'anthropic':
          return await this.generateWithAnthropic(prompt, options);
        case 'azure':
          return await this.generateWithAzure(prompt, options);
        default:
          throw new Error(`Unknown provider: ${actualProvider}`);
      }
    } catch (error) {
      console.error(`Error with ${actualProvider}:`, error.message);
      throw error;
    }
  }
  
  mockGenerateText(prompt) {
    // Generate a simple mock response based on the prompt
    let mockResponse = '';
    
    if (prompt.includes('JSON')) {
      mockResponse = '[{"step": 1, "name": "Mock Step 1", "duration": 1000}, {"step": 2, "name": "Mock Step 2", "duration": 2000}]';
    } else if (prompt.includes('orchestration')) {
      mockResponse = 'Mock orchestration plan created successfully with 4 steps.';
    } else if (prompt.includes('report')) {
      mockResponse = 'This is a mock generated report. All data has been processed successfully.';
    } else {
      mockResponse = 'This is a mock response from the LLM service.';
    }
    
    return {
      text: mockResponse,
      provider: 'mock',
      model: 'mock-model',
      usage: { total_tokens: 50 }
    };
  }
  
  async transformData(data, targetFormat, provider) {
    if (this.mockMode) {
      return this.mockTransformData(data, targetFormat);
    }
    
    const prompt = `Transform the following data to ${targetFormat} format:

${JSON.stringify(data, null, 2)}

Return only the transformed data in ${targetFormat} format.`;
    
    // If provider is null or undefined, use the default
    const actualProvider = (provider === null || provider === undefined) ? this.defaultProvider : provider;
    const result = await this.generateText(prompt, actualProvider);
    return result.text;
  }
  
  mockTransformData(data, targetFormat) {
    // Simple mock data transformation
    switch (targetFormat.toUpperCase()) {
      case 'CSV':
        if (Array.isArray(data)) {
          const headers = Object.keys(data[0]);
          const csvRows = [headers.join(',')];
          data.forEach(row => {
            const values = headers.map(header => row[header]);
            csvRows.push(values.join(','));
          });
          return csvRows.join('\n');
        }
        return 'Mock CSV transformation';
      
      case 'XML':
        return `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <data>Mock XML transformation</data>
</root>`;
      
      case 'JSON':
      default:
        return JSON.stringify(data, null, 2);
    }
  }
  
  async generateWithOpenAI(prompt, options = {}) {
    const model = options.model || process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    
    const completion = await this.providers.openai.chat.completions.create({
      model: model,
      messages: [{
        role: "user",
        content: prompt
      }],
      max_tokens: options.maxTokens || parseInt(process.env.OPENAI_MAX_TOKENS) || 1000,
      temperature: options.temperature || 0.7,
      stream: options.stream || false
    });
    
    if (options.stream) {
      return completion;
    }
    
    return {
      text: completion.choices[0].message.content,
      provider: 'openai',
      model: model,
      usage: completion.usage
    };
  }
  
  async generateWithAnthropic(prompt, options = {}) {
    const model = options.model || process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307';
    
    const response = await this.providers.anthropic.messages.create({
      model: model,
      max_tokens: options.maxTokens || parseInt(process.env.ANTHROPIC_MAX_TOKENS) || 1000,
      messages: [{
        role: "user",
        content: prompt
      }],
      temperature: options.temperature || 0.7,
      stream: options.stream || false
    });
    
    if (options.stream) {
      return response;
    }
    
    return {
      text: response.content[0].text,
      provider: 'anthropic',
      model: model,
      usage: response.usage
    };
  }
  
  async generateWithAzure(prompt, options = {}) {
    const deploymentName = process.env.AZURE_DEPLOYMENT_NAME;
    
    const result = await this.providers.azure.getChatCompletions(
      deploymentName,
      [{
        role: "user",
        content: prompt
      }],
      {
        maxTokens: options.maxTokens || parseInt(process.env.AZURE_MAX_TOKENS) || 1000,
        temperature: options.temperature || 0.7
      }
    );
    
    return {
      text: result.choices[0].message.content,
      provider: 'azure',
      model: deploymentName,
      usage: result.usage
    };
  }
  
  async processImage(imageData, prompt, provider) {
    if (this.mockMode) {
      return {
        text: 'Mock image analysis: This image appears to contain various objects and elements. Mock description provided since no real LLM provider is enabled.',
        provider: 'mock',
        model: 'mock-vision-model'
      };
    }
    
    // If provider is null or undefined, use 'openai' as default for image processing
    const actualProvider = (provider === null || provider === undefined) ? 'openai' : provider;
    
    // Note: Image processing capabilities vary by provider
    if (actualProvider === 'openai') {
      // Use the new vision model (gpt-4o or gpt-4o-mini)
      const model = process.env.OPENAI_VISION_MODEL || 'gpt-4o';
      
      const completion = await this.providers.openai.chat.completions.create({
        model: model,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageData}`
              }
            }
          ]
        }],
        max_tokens: 1000
      });
      
      return {
        text: completion.choices[0].message.content,
        provider: 'openai',
        model: model
      };
    } else {
      throw new Error(`Image processing not implemented for provider: ${actualProvider}`);
    }
  }
}

module.exports = new LLMService();
