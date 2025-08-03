import { jest } from '@jest/globals';
import logger from '../utils/logger.js';

describe('Logger', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = {
      error: jest.spyOn(console, 'error').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      info: jest.spyOn(console, 'info').mockImplementation(),
      debug: jest.spyOn(console, 'debug').mockImplementation()
    };
  });

  afterEach(() => {
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  test('should log error messages', () => {
    logger.error('Test error message');
    expect(consoleSpy.error).toHaveBeenCalledWith(
      expect.stringContaining('ERROR: Test error message')
    );
  });

  test('should log warn messages', () => {
    logger.warn('Test warning message');
    expect(consoleSpy.warn).toHaveBeenCalledWith(
      expect.stringContaining('WARN: Test warning message')
    );
  });

  test('should log info messages', () => {
    logger.info('Test info message');
    expect(consoleSpy.info).toHaveBeenCalledWith(
      expect.stringContaining('INFO: Test info message')
    );
  });

  test('should include metadata in log messages', () => {
    const metadata = { userId: '123', action: 'test' };
    logger.info('Test with metadata', metadata);
    
    expect(consoleSpy.info).toHaveBeenCalledWith(
      expect.stringContaining('Test with metadata | {"userId":"123","action":"test"}')
    );
  });

  test('should format timestamp correctly', () => {
    logger.info('Test timestamp');
    
    const logCall = consoleSpy.info.mock.calls[0][0];
    expect(logCall).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
  });
});