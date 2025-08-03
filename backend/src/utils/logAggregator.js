import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import config from '../config/environment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Log Aggregation System for Production
 * Handles structured logging with rotation and filtering
 */
class LogAggregator {
  constructor() {
    this.logDir = join(__dirname, '..', '..', 'logs');
    this.streams = new Map();
    this.buffers = new Map();
    this.flushInterval = 5000; // 5 seconds
    this.maxBufferSize = 100;
    
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    
    this.currentLogLevel = this.logLevels[config.logging.level] || this.logLevels.info;
    
    this.init();
  }

  init() {
    // Ensure log directory exists
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
    
    // Initialize log streams
    this.initializeStreams();
    
    // Start periodic flush
    setInterval(() => {
      this.flushAllBuffers();
    }, this.flushInterval);
    
    // Handle process exit
    process.on('exit', () => {
      this.flushAllBuffers();
      this.closeAllStreams();
    });
    
    process.on('SIGTERM', () => {
      this.flushAllBuffers();
      this.closeAllStreams();
    });
    
    process.on('SIGINT', () => {
      this.flushAllBuffers();
      this.closeAllStreams();
    });
  }

  initializeStreams() {
    const date = new Date().toISOString().split('T')[0];
    
    // Application logs
    this.createStream('app', `app-${date}.log`);
    
    // Error logs
    this.createStream('error', `error-${date}.log`);
    
    // Access logs
    this.createStream('access', `access-${date}.log`);
    
    // Performance logs
    this.createStream('performance', `performance-${date}.log`);
    
    // Analytics logs
    this.createStream('analytics', `analytics-${date}.log`);
    
    // WebSocket logs
    this.createStream('websocket', `websocket-${date}.log`);
    
    // MCP logs
    this.createStream('mcp', `mcp-${date}.log`);
  }

  createStream(name, filename) {
    const filepath = join(this.logDir, filename);
    const stream = createWriteStream(filepath, { flags: 'a' });
    
    this.streams.set(name, stream);
    this.buffers.set(name, []);
    
    stream.on('error', (error) => {
      console.error(`Error writing to log file ${filename}:`, error);
    });
  }

  shouldLog(level) {
    return this.logLevels[level] <= this.currentLogLevel;
  }

  log(level, category, message, metadata = {}) {
    if (!this.shouldLog(level)) {
      return;
    }
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      category,
      message,
      metadata: {
        ...metadata,
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      }
    };
    
    // Add to appropriate buffer
    const buffer = this.buffers.get(category) || this.buffers.get('app');
    buffer.push(JSON.stringify(logEntry));
    
    // Also add errors to error log
    if (level === 'error') {
      const errorBuffer = this.buffers.get('error');
      if (errorBuffer) {
        errorBuffer.push(JSON.stringify(logEntry));
      }
    }
    
    // Flush if buffer is full
    if (buffer.length >= this.maxBufferSize) {
      this.flushBuffer(category);
    }
    
    // Console output in development
    if (config.server.isDevelopment) {
      this.consoleLog(level, category, message, metadata);
    }
  }

  consoleLog(level, category, message, metadata) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${category}]`;
    
    switch (level) {
      case 'error':
        console.error(prefix, message, metadata);
        break;
      case 'warn':
        console.warn(prefix, message, metadata);
        break;
      case 'info':
        console.info(prefix, message, metadata);
        break;
      case 'debug':
        console.debug(prefix, message, metadata);
        break;
      default:
        console.log(prefix, message, metadata);
    }
  }

  // Specific logging methods
  logError(message, metadata = {}) {
    this.log('error', 'app', message, metadata);
  }

  logWarning(message, metadata = {}) {
    this.log('warn', 'app', message, metadata);
  }

  logInfo(message, metadata = {}) {
    this.log('info', 'app', message, metadata);
  }

  logDebug(message, metadata = {}) {
    this.log('debug', 'app', message, metadata);
  }

  logAccess(req, res, responseTime) {
    this.log('info', 'access', 'HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      contentLength: res.get('Content-Length')
    });
  }

  logPerformance(metric, value, metadata = {}) {
    this.log('info', 'performance', `Performance metric: ${metric}`, {
      metric,
      value,
      ...metadata
    });
  }

  logAnalytics(event, data = {}) {
    this.log('info', 'analytics', `Analytics event: ${event}`, {
      event,
      ...data
    });
  }

  logWebSocket(event, metadata = {}) {
    this.log('info', 'websocket', `WebSocket event: ${event}`, metadata);
  }

  logMCP(event, metadata = {}) {
    this.log('info', 'mcp', `MCP event: ${event}`, metadata);
  }

  flushBuffer(category) {
    const buffer = this.buffers.get(category);
    const stream = this.streams.get(category);
    
    if (!buffer || !stream || buffer.length === 0) {
      return;
    }
    
    const data = buffer.join('\n') + '\n';
    stream.write(data);
    
    // Clear buffer
    this.buffers.set(category, []);
  }

  flushAllBuffers() {
    for (const category of this.buffers.keys()) {
      this.flushBuffer(category);
    }
  }

  closeAllStreams() {
    for (const stream of this.streams.values()) {
      stream.end();
    }
    this.streams.clear();
  }

  // Log rotation (called daily)
  rotateLog(category) {
    const stream = this.streams.get(category);
    if (stream) {
      stream.end();
    }
    
    const date = new Date().toISOString().split('T')[0];
    const filename = `${category}-${date}.log`;
    this.createStream(category, filename);
  }

  // Get log statistics
  getLogStats() {
    const stats = {
      buffers: {},
      streams: {},
      logLevel: config.logging.level,
      logDir: this.logDir
    };
    
    for (const [category, buffer] of this.buffers) {
      stats.buffers[category] = buffer.length;
    }
    
    for (const [category, stream] of this.streams) {
      stats.streams[category] = {
        writable: stream.writable,
        bytesWritten: stream.bytesWritten
      };
    }
    
    return stats;
  }

  // Search logs (simple implementation)
  async searchLogs(category, query, options = {}) {
    const { limit = 100, level = null, since = null } = options;
    const buffer = this.buffers.get(category) || [];
    
    let results = buffer
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(entry => entry !== null);
    
    // Filter by level
    if (level) {
      results = results.filter(entry => entry.level === level.toUpperCase());
    }
    
    // Filter by time
    if (since) {
      const sinceDate = new Date(since);
      results = results.filter(entry => new Date(entry.timestamp) >= sinceDate);
    }
    
    // Filter by query
    if (query) {
      const queryLower = query.toLowerCase();
      results = results.filter(entry => 
        entry.message.toLowerCase().includes(queryLower) ||
        JSON.stringify(entry.metadata).toLowerCase().includes(queryLower)
      );
    }
    
    // Limit results
    return results.slice(-limit);
  }

  // Export logs for external analysis
  exportLogs(category, format = 'json') {
    const buffer = this.buffers.get(category) || [];
    
    if (format === 'json') {
      return buffer.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(entry => entry !== null);
    }
    
    if (format === 'csv') {
      const entries = this.exportLogs(category, 'json');
      if (entries.length === 0) return '';
      
      const headers = ['timestamp', 'level', 'category', 'message'];
      const csvLines = [headers.join(',')];
      
      entries.forEach(entry => {
        const row = [
          entry.timestamp,
          entry.level,
          entry.category,
          `"${entry.message.replace(/"/g, '""')}"`
        ];
        csvLines.push(row.join(','));
      });
      
      return csvLines.join('\n');
    }
    
    return buffer.join('\n');
  }
}

// Create singleton instance
const logAggregator = new LogAggregator();

export default logAggregator;