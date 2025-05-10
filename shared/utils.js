const { v4: uuidv4 } = require('uuid');

/**
 * Shared utility functions for A2A implementation
 */

// Generate unique IDs
const generateTaskId = () => `task-${uuidv4()}`;
const generateSessionId = () => `session-${uuidv4()}`;
const generateRequestId = () => `req-${uuidv4()}`;

// Validate JSON-RPC request structure
const validateJsonRpcRequest = (request) => {
  if (!request || typeof request !== 'object') {
    return false;
  }
  
  if (request.jsonrpc !== '2.0') {
    return false;
  }
  
  if (typeof request.method !== 'string') {
    return false;
  }
  
  // id can be string, number, or null, but not undefined for our purposes
  if ('id' in request && request.id === undefined) {
    return false;
  }
  
  return true;
};

// Validate message structure
const validateMessage = (message) => {
  if (!message || typeof message !== 'object') {
    return false;
  }
  
  if (!['user', 'agent'].includes(message.role)) {
    return false;
  }
  
  if (!Array.isArray(message.parts) || message.parts.length === 0) {
    return false;
  }
  
  // Validate each part
  for (const part of message.parts) {
    if (!validatePart(part)) {
      return false;
    }
  }
  
  return true;
};

// Validate part structure
const validatePart = (part) => {
  if (!part || typeof part !== 'object') {
    return false;
  }
  
  switch (part.type) {
    case 'text':
      return typeof part.text === 'string';
    case 'file':
      return validateFileContent(part.file);
    case 'data':
      return part.data !== undefined; // Can be any valid JSON
    default:
      return false;
  }
};

// Validate file content structure
const validateFileContent = (file) => {
  if (!file || typeof file !== 'object') {
    return false;
  }
  
  // Must have either bytes or uri, not both, not neither
  const hasBytes = typeof file.bytes === 'string';
  const hasUri = typeof file.uri === 'string';
  
  return hasBytes !== hasUri; // XOR: exactly one must be true
};

// Delay for simulating async operations
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Base64 encode/decode helpers
const encodeBase64 = (data) => Buffer.from(data).toString('base64');
const decodeBase64 = (base64) => Buffer.from(base64, 'base64');

// Create a simple file content object
const createFileContent = (name, mimeType, data, useUri = false) => {
  const content = {
    name,
    mimeType
  };
  
  if (useUri) {
    // In a real implementation, you'd upload to storage and return the URL
    content.uri = `https://storage.example.com/files/${encodeURIComponent(name)}`;
  } else {
    content.bytes = encodeBase64(data);
  }
  
  return content;
};

// Parse content from file
const parseFileContent = (file) => {
  if (file.bytes) {
    return {
      data: decodeBase64(file.bytes),
      source: 'bytes'
    };
  } else if (file.uri) {
    // In a real implementation, you'd fetch from the URI
    return {
      data: null,
      source: 'uri',
      uri: file.uri
    };
  }
  return null;
};

// Chunking utility for streaming
const chunkText = (text, chunkSize = 50) => {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
};

// Error message helpers
const getErrorMessage = (errorCode) => {
  const errorMessages = {
    [-32700]: 'Parse error',
    [-32600]: 'Invalid Request',
    [-32601]: 'Method not found',
    [-32602]: 'Invalid params',
    [-32603]: 'Internal error',
    [-32001]: 'Task not found',
    [-32002]: 'Task cannot be canceled',
    [-32003]: 'Push Notification is not supported',
    [-32004]: 'This operation is not supported',
    [-32005]: 'Incompatible content types',
    [-32006]: 'Streaming is not supported',
    [-32007]: 'Authentication required',
    [-32008]: 'Authorization failed',
    [-32009]: 'Invalid task state',
    [-32010]: 'Rate limit exceeded',
    [-32011]: 'Resource unavailable'
  };
  
  return errorMessages[errorCode] || 'Unknown error';
};

// URL validation for push notifications
const isValidHttpsUrl = (urlString) => {
  try {
    const url = new URL(urlString);
    return url.protocol === 'https:';
  } catch (_) {
    return false;
  }
};

// Simple authentication token validator
const validateBearerToken = (token, validTokens = []) => {
  if (!token) return false;
  if (!token.startsWith('Bearer ')) return false;
  
  const actualToken = token.substring(7);
  return validTokens.includes(actualToken);
};

// Extract authentication header
const getAuthFromHeaders = (headers) => {
  const auth = headers.authorization || headers.Authorization;
  return auth ? auth.trim() : null;
};

module.exports = {
  generateTaskId,
  generateSessionId,
  generateRequestId,
  validateJsonRpcRequest,
  validateMessage,
  validatePart,
  validateFileContent,
  delay,
  encodeBase64,
  decodeBase64,
  createFileContent,
  parseFileContent,
  chunkText,
  getErrorMessage,
  isValidHttpsUrl,
  validateBearerToken,
  getAuthFromHeaders
};
