import logger from '../utils/logger.js';

/**
 * Error response format
 */
function createErrorResponse(code, message, details = null) {
  return {
    error: true,
    code,
    message,
    details,
    timestamp: new Date().toISOString()
  };
}

/**
 * Express error handling middleware
 */
function errorHandler(err, req, res, next) {
  // Log the error
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  // Determine error type and response
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = 'Internal server error';

  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Invalid request data';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
    message = 'Unauthorized access';
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = 503;
    errorCode = 'SERVICE_UNAVAILABLE';
    message = 'Service temporarily unavailable';
  }

  res.status(statusCode).json(
    createErrorResponse(errorCode, message, process.env.NODE_ENV === 'development' ? err.message : null)
  );
}

/**
 * 404 handler
 */
function notFoundHandler(req, res) {
  logger.warn('Route not found', { url: req.url, method: req.method });
  res.status(404).json(
    createErrorResponse('NOT_FOUND', 'Route not found')
  );
}

/**
 * WebSocket error handler
 */
function handleWebSocketError(ws, error, context = {}) {
  logger.error('WebSocket error', {
    error: error.message,
    context
  });

  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(
      createErrorResponse('WEBSOCKET_ERROR', 'Connection error occurred')
    ));
  }
}

/**
 * MCP error handler
 */
function handleMCPError(error, context = {}) {
  logger.error('MCP error', {
    error: error.message,
    context
  });

  return createErrorResponse('MCP_ERROR', 'Failed to communicate with chat service');
}

export {
  errorHandler,
  notFoundHandler,
  handleWebSocketError,
  handleMCPError,
  createErrorResponse
};