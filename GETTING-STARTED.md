# Getting Started with A2A + LLM Integration

## 🚀 Quick Start

The A2A playground is now successfully integrated with LLM providers! Currently running in MOCK mode.

## 🔑 Setting Up Real LLM Providers

### 1. Get API Keys

To use real LLM capabilities, you'll need API keys from one or more providers:

- **OpenAI**: Get your key at https://platform.openai.com/api-keys
- **Anthropic**: Get your key at https://console.anthropic.com/settings/keys
- **Azure OpenAI**: Set up through Azure Portal

### 2. Configure Environment

Edit your `.env` file and add your API keys:

```env
# Enable the provider(s) you want to use
ENABLE_OPENAI=true
ENABLE_ANTHROPIC=false
ENABLE_AZURE=false

# Add your API keys
OPENAI_API_KEY=sk-proj-your_openai_key_here
ANTHROPIC_API_KEY=sk-ant-your_anthropic_key_here

# Azure (if using)
AZURE_OPENAI_KEY=your_azure_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_DEPLOYMENT_NAME=gpt-35-turbo
```

### 3. Run the Demo

```bash
# Run the interactive demo launcher
node run-demo.js

# Or start just the server
npm run server

# Or run the basic client
npm run client
```

## 🎯 Testing with Real LLMs

### Using OpenAI (Recommended for beginners)

1. Add your OpenAI API key to `.env`
2. Set `ENABLE_OPENAI=true`
3. Run: `node test-integration.js`

### Using Anthropic (Great for advanced reasoning)

1. Add your Anthropic API key to `.env`
2. Set `ENABLE_ANTHROPIC=true`
3. Run: `node test-integration.js`

### Using Specific Providers

You can specify which provider to use in requests:

```javascript
// Use Anthropic for text analysis
{
  "message": {
    "role": "user",
    "parts": [
      {
        "type": "text",
        "text": "Analyze this sentiment"
      },
      {
        "type": "data",
        "data": {
          "provider": "anthropic"
        }
      }
    ]
  }
}
```

## 🔍 Current Demo Features

### 1. Text Analysis
- Sentiment analysis
- Key phrase extraction
- Language detection
- Text summarization

### 2. Image Processing (OpenAI only)
- Image description
- OCR capabilities
- Object detection

### 3. Data Transformation
- JSON ↔ CSV ↔ XML conversion
- Smart data cleaning
- Format-aware transformations

### 4. Task Orchestration
- Multi-step workflows
- AI-generated plans
- Human-in-the-loop processes

## 🛠 Troubleshooting

### No LLM Providers Available

If you see "Running in MOCK MODE", check:

1. API keys are correctly added to `.env`
2. At least one provider is enabled (`ENABLE_OPENAI=true`)
3. Restart the server after making changes

### API Key Errors

Common issues:
- Invalid key format
- Expired or revoked key
- Rate limits exceeded
- Insufficient permissions

### Connection Issues

- Ensure port 3100 is available
- Check firewall settings
- Verify internet connectivity

## 📚 Next Steps

1. **Explore**: Try different demos with `node run-demo.js`
2. **Customize**: Modify skills in `server/skills.js`
3. **Extend**: Add new LLM providers or capabilities
4. **Deploy**: Set up with your preferred LLM provider for production

## 💡 Pro Tips

- **Cost Management**: Start with cheaper models (GPT-3.5, Claude Haiku)
- **Performance**: OpenAI is fastest, Anthropic best for reasoning
- **Multi-Provider**: Use different providers for different tasks
- **Monitoring**: Check console logs for API usage and errors

## 🆘 Need Help?

- Check the [README.md](README.md) for detailed documentation
- Review [error logs] in the console
- Test with `node test-integration.js`
- Verify environment with `npm run test`

Happy experimenting with A2A + LLM! 🚀
