import request from 'supertest';
import express from 'express';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler.js';

describe('Error Handling Integration', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Test routes
    app.get('/test-error', (req, res, next) => {
      const error = new Error('Test error');
      next(error);
    });

    app.get('/test-validation-error', (req, res, next) => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      next(error);
    });

    app.get('/test-unauthorized', (req, res, next) => {
      const error = new Error('Unauthorized access');
      error.name = 'UnauthorizedError';
      next(error);
    });

    app.get('/test-service-unavailable', (req, res, next) => {
      const error = new Error('Service unavailable');
      error.code = 'ECONNREFUSED';
      next(error);
    });

    // Error handling middleware
    app.use('*', notFoundHandler);
    app.use(errorHandler);

    // Mock console methods
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should handle generic server errors', async () => {
    const response = await request(app)
      .get('/test-error')
      .expect(500);

    expect(response.body).toEqual({
      error: true,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: null,
      timestamp: expect.any(String)
    });
  });

  test('should handle validation errors', async () => {
    const response = await request(app)
      .get('/test-validation-error')
      .expect(400);

    expect(response.body).toEqual({
      error: true,
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: null,
      timestamp: expect.any(String)
    });
  });

  test('should handle unauthorized errors', async () => {
    const response = await request(app)
      .get('/test-unauthorized')
      .expect(401);

    expect(response.body).toEqual({
      error: true,
      code: 'UNAUTHORIZED',
      message: 'Unauthorized access',
      details: null,
      timestamp: expect.any(String)
    });
  });

  test('should handle service unavailable errors', async () => {
    const response = await request(app)
      .get('/test-service-unavailable')
      .expect(503);

    expect(response.body).toEqual({
      error: true,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Service temporarily unavailable',
      details: null,
      timestamp: expect.any(String)
    });
  });

  test('should handle 404 not found', async () => {
    const response = await request(app)
      .get('/non-existent-route')
      .expect(404);

    expect(response.body).toEqual({
      error: true,
      code: 'NOT_FOUND',
      message: 'Route not found',
      details: null,
      timestamp: expect.any(String)
    });
  });

  test('should include error details in development mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const response = await request(app)
      .get('/test-error')
      .expect(500);

    expect(response.body.details).toBe('Test error');

    process.env.NODE_ENV = originalEnv;
  });

  test('should not include error details in production mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const response = await request(app)
      .get('/test-error')
      .expect(500);

    expect(response.body.details).toBeNull();

    process.env.NODE_ENV = originalEnv;
  });
});