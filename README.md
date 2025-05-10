# A2A (Agent2Agent) Protocol Playground with LLM Integration

A comprehensive demonstration implementation of the [Agent2Agent (A2A) Protocol](https://google.github.io/A2A/specification/) v0.1.0, now powered by real LLM providers including OpenAI, Anthropic, and Azure OpenAI.

## 🚀 Quick Start

1. **Set up your environment:**
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

2. **Install and run:**
   ```bash
   # Install dependencies
   npm install
   
   # Start the interactive demo launcher
   node run-demo.js
   ```

## 🔑 Environment Configuration

Before running the demos, you need to configure your API keys in a `.env` file. Copy `.env.example` to `.env` and add your keys:

```env
# Choose your default LLM provider
DEFAULT_LLM_PROVIDER=openai

# Add your API keys
OPENAI_API_KEY=sk-proj-your_key_here
ANTHROPIC_API_KEY=sk-ant-your_key_here
AZURE_OPENAI_KEY=your_azure_key_here

# Enable/disable providers
ENABLE_OPENAI=true
ENABLE_ANTHROPIC=true
ENABLE_AZURE=false
```

## 🤖 LLM Integration Features

### Supported Providers
- **OpenAI**: GPT-3.5-turbo, GPT-4, GPT-4-vision
- **Anthropic**: Claude 3 models (Haiku, Sonnet, Opus)
- **Azure OpenAI**: Any deployed OpenAI models

### Smart Provider Selection
You can specify LLM providers in requests:

```json
{
  "id": "task-123",
  "message": {
    "role": "user",
    "parts": [
      {
        "type": "text",
        "text": "Analyze this text sentiment"
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

## 🌟 Enhanced Features

### 1. Real Text Analysis
- Uses actual LLMs for sentiment analysis
- Supports multiple languages and contexts
- Provider-specific optimizations

### 2. Vision Capabilities
- Image understanding with GPT-4 Vision
- OCR and object detection
- Image description and analysis

### 3. Intelligent Data Transformation
- AI-powered format conversions
- Smart data cleaning and restructuring
- Context-aware transformations

### 4. Dynamic Task Orchestration
- LLM-generated workflow planning
- Adaptive step creation
- Multi-provider coordination

## 📁 Project Structure

```
a2a-playground/
├── server/
│   ├── server.js          # LLM-integrated server
│   ├── llm-service.js     # LLM provider management
│   ├── agent-card.json    # LLM-enhanced agent card
│   ├── tasks.js          # Task management
│   └── skills.js         # LLM-powered skills
├── client/               # Client implementations
├── .env.example         # Environment template
└── package.json         # Includes LLM dependencies
```

## 🔧 Configuration

### Environment Variables
```env
# Core Configuration
PORT=3100
DEFAULT_LLM_PROVIDER=openai

# OpenAI
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-3.5-turbo

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-haiku-20240307

# Azure OpenAI
AZURE_OPENAI_KEY=...
AZURE_OPENAI_ENDPOINT=https://...
AZURE_DEPLOYMENT_NAME=gpt-35-turbo
```

### Provider-Specific Models
Customize models for each provider in your `.env` file:
- OpenAI: `OPENAI_MODEL=gpt-4` for advanced tasks
- Anthropic: `ANTHROPIC_MODEL=claude-3-opus-20240229` for complex reasoning
- Azure: Set your deployment name in `AZURE_DEPLOYMENT_NAME`

## 📚 API Examples

### Basic Text Analysis
```javascript
// Analyze with default provider
POST /a2a/v1
{
  "jsonrpc": "2.0",
  "method": "tasks/send",
  "params": {
    "id": "task-123",
    "message": {
      "role": "user",
      "parts": [
        {
          "type": "text",
          "text": "Analyze sentiment of: 'This is amazing!'"
        }
      ]
    }
  }
}

// Analyze with specific provider
POST /a2a/v1
{
  "jsonrpc": "2.0",
  "method": "tasks/send",
  "params": {
    "id": "task-456",
    "message": {
      "role": "user",
      "parts": [
        {
          "type": "text",
          "text": "Analyze sentiment of: 'This is amazing!'"
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
}
```

## 🔒 Security

- API keys stored in environment variables
- `.env` file excluded from version control
- Rate limiting and error handling
- Provider-specific security best practices

## 🛠️ Development

```bash
# Start with hot reload
npm run dev

# Run tests with LLM integration
npm run test

# Install new dependencies
npm install
```

## 📋 Requirements

- Node.js 16+
- Valid API keys for chosen LLM providers
- Internet connection for API calls

## 🔗 References

- [A2A Protocol Specification](https://google.github.io/A2A/specification/)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Anthropic Claude API](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
- [Azure OpenAI Service](https://azure.microsoft.com/en-us/products/ai-services/openai-service)

## 📄 License

MIT License

---

Built with real AI integration for the A2A community 🤖