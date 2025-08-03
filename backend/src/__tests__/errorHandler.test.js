import { jest } from '@jest/globals';
import { 
  errorHandler, 
  notFoundHandler, 
  handleWebSocketError, 
  handleMCPError, 
  createErrorResponse 
} from '../middleware/errorHandler.js';

describe('Error Handler Middleware', () => {
  let mockReq, mockRes, mockNext, mockWs;

  beforeEach(() => {
    mockReq = {
      url: '/test',
      method: 'GET',
      ip: '127.0.0.1'
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    mockNext = jest.fn();
    
    mockWs = {
      readyState: 1, // OPEN
      OPEN: 1,
      send: jest.fn()
    };

    // Mock console methods
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createErrorResponse', () => {
    test('should create proper error response format', () => {
      const response = createErrorResponse('TEST_ERROR', 'Test message', 'Test details');
      
      expect(response).toEqual({
        error: true,
        code: 'TEST_ERROR',
        message: 'Test message',
        details: 'Test details',
        timestamp: expect.any(String)
      });
    });

    test('should create error response without details', () => {
      const response = createErrorResponse('TEST_ERROR', 'Test message');
      
      expect(response).toEqual({
        error: true,
        code: 'TEST_ERROR',
        message: 'Test message',
        details: null,
        timestamp: expect.any(String)
      });
    });
  });

  describe('errorHandler', () => {
    test('should handle generic errors', () => {
      const error = new Error('Test error');
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: true,
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        })
      );
    });

    test('should handle validation errors', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data'
        })
      );
    });

    test('should handle unauthorized errors', () => {
      const error = new Error('Unauthorized');
      error.name = 'UnauthorizedError';
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: true,
          code: 'UNAUTHORIZED',
          message: 'Unauthorized access'
        })
      );
    });

    test('should handle connection refused errors', () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: true,
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service temporarily unavailable'
        })
      );
    });
  });

  describe('notFoundHandler', () => {
    test('should handle 404 errors', () => {
      notFoundHandler(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: true,
          code: 'NOT_FOUND',
          message: 'Route not found'
        })
      );
    });
  });

  describe('handleWebSocketError', () => {
    test('should send error message to WebSocket client', () => {
      const error = new Error('WebSocket error');
      const context = { clientId: 'test-client' };
      
      handleWebSocketError(mockWs, error, context);
      
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify(expect.objectContaining({
          error: true,
          code: 'WEBSOCKET_ERROR',
          message: 'Connection error occurred'
        }))
      );
    });

    test('should not send message if WebSocket is closed', () => {
      mockWs.readyState = 3; // CLOSED
      const error = new Error('WebSocket error');
      
      handleWebSocketError(mockWs, error);
      
      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });

  describe('handleMCPError', () => {
    test('should return formatted MCP error response', () => {
      const error = new Error('MCP connection failed');
      const context = { requestId: 'test-request' };
      
      const response = handleMCPError(error, context);
      
      expect(response).toEqual(
        expect.objectContaining({
          error: true,
          code: 'MCP_ERROR',
          message: 'Failed to communicate with chat service'
        })
      );
    });
  });
});