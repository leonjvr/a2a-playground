/**
 * A2A Protocol Type Definitions
 * Based on the official A2A v0.1.0 specification
 */

// Task states
const TaskState = {
  SUBMITTED: 'submitted',
  WORKING: 'working',
  INPUT_REQUIRED: 'input-required',
  COMPLETED: 'completed',
  CANCELED: 'canceled',
  FAILED: 'failed',
  UNKNOWN: 'unknown'
};

// Part types
const PartType = {
  TEXT: 'text',
  FILE: 'file',
  DATA: 'data'
};

// JSON-RPC error codes
const ErrorCodes = {
  // Standard JSON-RPC errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  
  // A2A-specific errors (-32000 to -32099)
  TASK_NOT_FOUND: -32001,
  TASK_NOT_CANCELABLE: -32002,
  PUSH_NOTIFICATION_NOT_SUPPORTED: -32003,
  OPERATION_NOT_SUPPORTED: -32004,
  CONTENT_TYPE_NOT_SUPPORTED: -32005,
  STREAMING_NOT_SUPPORTED: -32006,
  AUTHENTICATION_REQUIRED: -32007,
  AUTHORIZATION_FAILED: -32008,
  INVALID_TASK_STATE: -32009,
  RATE_LIMIT_EXCEEDED: -32010,
  RESOURCE_UNAVAILABLE: -32011
};

// Helper functions to create proper objects
const createTextPart = (text, metadata = null) => ({
  type: PartType.TEXT,
  text,
  metadata
});

const createFilePart = (file, metadata = null) => ({
  type: PartType.FILE,
  file,
  metadata
});

const createDataPart = (data, metadata = null) => ({
  type: PartType.DATA,
  data,
  metadata
});

const createMessage = (role, parts, metadata = null) => ({
  role,
  parts,
  metadata
});

const createTaskStatus = (state, message = null, timestamp = null) => ({
  state,
  message,
  timestamp: timestamp || new Date().toISOString()
});

const createTask = (id, status, sessionId = null, artifacts = null, history = null, metadata = null) => ({
  id,
  sessionId,
  status,
  artifacts,
  history,
  metadata
});

const createArtifact = (name, parts, description = null, index = 0, append = false, lastChunk = false, metadata = null) => ({
  name,
  description,
  parts,
  index,
  append,
  lastChunk,
  metadata
});

const createJsonRpcRequest = (method, params, id) => ({
  jsonrpc: '2.0',
  method,
  params,
  id
});

const createJsonRpcResponse = (result, id, error = null) => ({
  jsonrpc: '2.0',
  id,
  result: error ? undefined : result,
  error: error || undefined
});

const createJsonRpcError = (code, message, data = null) => ({
  code,
  message,
  data
});

module.exports = {
  TaskState,
  PartType,
  ErrorCodes,
  createTextPart,
  createFilePart,
  createDataPart,
  createMessage,
  createTaskStatus,
  createTask,
  createArtifact,
  createJsonRpcRequest,
  createJsonRpcResponse,
  createJsonRpcError
};
