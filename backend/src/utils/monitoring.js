import logger from './logger.js';
import config from '../config/environment.js';

class MonitoringService {
  constructor() {
    this.metrics = {
      requests: 0,
      errors: 0,
      websocketConnections: 0,
      mcpRequests: 0,
      mcpErrors: 0,
      responseTime: [],
      uptime: Date.now()
    };
    
    this.errorCounts = new Map();
    this.performanceMetrics = new Map();
    
    // Start periodic metrics collection
    this.startMetricsCollection();
  }

  // Request tracking
  trackRequest(req, res, next) {
    const startTime = Date.now();
    this.metrics.requests++;
    
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      this.trackResponseTime(responseTime);
      
      if (res.statusCode >= 400) {
        this.trackError(`HTTP_${res.statusCode}`, {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          responseTime
        });
      }
      
      logger.info('Request completed', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        responseTime,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
    });
    
    next();
  }

  // Error tracking
  trackError(errorType, details = {}) {
    this.metrics.errors++;
    
    const errorKey = `${errorType}_${new Date().toISOString().split('T')[0]}`;
    const currentCount = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, currentCount + 1);
    
    logger.error('Error tracked', {
      errorType,
      details,
      timestamp: new Date().toISOString()
    });
    
    // Alert on high error rates
    if (currentCount > 10) {
      this.sendAlert('HIGH_ERROR_RATE', {
        errorType,
        count: currentCount,
        details
      });
    }
  }

  // Performance tracking
  trackResponseTime(responseTime) {
    this.metrics.responseTime.push(responseTime);
    
    // Keep only last 1000 response times
    if (this.metrics.responseTime.length > 1000) {
      this.metrics.responseTime = this.metrics.responseTime.slice(-1000);
    }
    
    // Alert on slow responses
    if (responseTime > 5000) {
      this.sendAlert('SLOW_RESPONSE', {
        responseTime,
        timestamp: new Date().toISOString()
      });
    }
  }

  // WebSocket connection tracking
  trackWebSocketConnection(action) {
    if (action === 'connect') {
      this.metrics.websocketConnections++;
    } else if (action === 'disconnect') {
      this.metrics.websocketConnections--;
    }
    
    logger.info('WebSocket connection tracked', {
      action,
      currentConnections: this.metrics.websocketConnections
    });
  }

  // MCP request tracking
  trackMCPRequest(success = true, responseTime = 0) {
    this.metrics.mcpRequests++;
    
    if (!success) {
      this.metrics.mcpErrors++;
      this.trackError('MCP_REQUEST_FAILED', { responseTime });
    }
    
    logger.info('MCP request tracked', {
      success,
      responseTime,
      totalRequests: this.metrics.mcpRequests,
      errorRate: (this.metrics.mcpErrors / this.metrics.mcpRequests * 100).toFixed(2)
    });
  }

  // Chat interaction analytics
  trackChatInteraction(data) {
    const {
      sessionId,
      messageType, // 'user' | 'bot' | 'error'
      messageLength,
      responseTime,
      success = true
    } = data;
    
    const interactionData = {
      sessionId,
      messageType,
      messageLength,
      responseTime,
      success,
      timestamp: new Date().toISOString()
    };
    
    // Store interaction for analytics
    this.storeInteraction(interactionData);
    
    logger.info('Chat interaction tracked', interactionData);
  }

  // Store interaction data
  storeInteraction(data) {
    const dateKey = new Date().toISOString().split('T')[0];
    const interactionKey = `interactions_${dateKey}`;
    
    if (!this.performanceMetrics.has(interactionKey)) {
      this.performanceMetrics.set(interactionKey, []);
    }
    
    const interactions = this.performanceMetrics.get(interactionKey);
    interactions.push(data);
    
    // Keep only last 7 days of interactions
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    for (const [key] of this.performanceMetrics) {
      const keyDate = new Date(key.split('_')[1]);
      if (keyDate < sevenDaysAgo) {
        this.performanceMetrics.delete(key);
      }
    }
  }

  // Get current metrics
  getMetrics() {
    const now = Date.now();
    const uptimeSeconds = Math.floor((now - this.metrics.uptime) / 1000);
    
    const responseTimeMetrics = this.calculateResponseTimeMetrics();
    
    return {
      server: {
        uptime: uptimeSeconds,
        environment: config.server.env,
        timestamp: new Date().toISOString()
      },
      requests: {
        total: this.metrics.requests,
        errors: this.metrics.errors,
        errorRate: this.metrics.requests > 0 ? 
          (this.metrics.errors / this.metrics.requests * 100).toFixed(2) : 0
      },
      websocket: {
        activeConnections: this.metrics.websocketConnections
      },
      mcp: {
        totalRequests: this.metrics.mcpRequests,
        errors: this.metrics.mcpErrors,
        errorRate: this.metrics.mcpRequests > 0 ? 
          (this.metrics.mcpErrors / this.metrics.mcpRequests * 100).toFixed(2) : 0
      },
      performance: responseTimeMetrics,
      memory: process.memoryUsage(),
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };
  }

  // Calculate response time statistics
  calculateResponseTimeMetrics() {
    if (this.metrics.responseTime.length === 0) {
      return {
        average: 0,
        median: 0,
        p95: 0,
        p99: 0,
        min: 0,
        max: 0
      };
    }
    
    const sorted = [...this.metrics.responseTime].sort((a, b) => a - b);
    const length = sorted.length;
    
    return {
      average: Math.round(sorted.reduce((a, b) => a + b, 0) / length),
      median: sorted[Math.floor(length / 2)],
      p95: sorted[Math.floor(length * 0.95)],
      p99: sorted[Math.floor(length * 0.99)],
      min: sorted[0],
      max: sorted[length - 1]
    };
  }

  // Get analytics data
  getAnalytics(days = 7) {
    const analytics = {
      interactions: {},
      errorSummary: {},
      trends: {}
    };
    
    // Get interaction data for specified days
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      const interactionKey = `interactions_${dateKey}`;
      
      const dayInteractions = this.performanceMetrics.get(interactionKey) || [];
      analytics.interactions[dateKey] = {
        total: dayInteractions.length,
        successful: dayInteractions.filter(i => i.success).length,
        failed: dayInteractions.filter(i => !i.success).length,
        averageResponseTime: dayInteractions.length > 0 ? 
          Math.round(dayInteractions.reduce((sum, i) => sum + (i.responseTime || 0), 0) / dayInteractions.length) : 0
      };
    }
    
    // Error summary
    for (const [errorKey, count] of this.errorCounts) {
      const [errorType, date] = errorKey.split('_');
      if (!analytics.errorSummary[errorType]) {
        analytics.errorSummary[errorType] = 0;
      }
      analytics.errorSummary[errorType] += count;
    }
    
    return analytics;
  }

  // Send alerts (can be extended to integrate with external services)
  sendAlert(alertType, data) {
    const alert = {
      type: alertType,
      severity: this.getAlertSeverity(alertType),
      data,
      timestamp: new Date().toISOString(),
      server: {
        environment: config.server.env,
        port: config.server.port
      }
    };
    
    logger.warn('Alert triggered', alert);
    
    // In production, you could send to external monitoring services:
    // - Slack webhook
    // - Email notification
    // - PagerDuty
    // - DataDog
    // - New Relic
    
    if (config.server.isProduction) {
      this.sendExternalAlert(alert);
    }
  }

  // Determine alert severity
  getAlertSeverity(alertType) {
    const severityMap = {
      'HIGH_ERROR_RATE': 'critical',
      'SLOW_RESPONSE': 'warning',
      'MCP_CONNECTION_FAILED': 'critical',
      'WEBSOCKET_CONNECTION_LIMIT': 'warning',
      'MEMORY_USAGE_HIGH': 'warning'
    };
    
    return severityMap[alertType] || 'info';
  }

  // Send alert to external services (placeholder)
  sendExternalAlert(alert) {
    // Implement integration with external monitoring services
    // Example: Slack webhook, email, etc.
    logger.info('External alert would be sent', { alert });
  }

  // Start periodic metrics collection
  startMetricsCollection() {
    // Collect metrics every 5 minutes
    setInterval(() => {
      this.collectSystemMetrics();
    }, 5 * 60 * 1000);
    
    // Clean old data every hour
    setInterval(() => {
      this.cleanOldData();
    }, 60 * 60 * 1000);
  }

  // Collect system metrics
  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    // Alert on high memory usage (>500MB)
    if (memUsageMB > 500) {
      this.sendAlert('MEMORY_USAGE_HIGH', {
        memoryUsage: memUsageMB,
        memoryDetails: memUsage
      });
    }
    
    logger.info('System metrics collected', {
      memory: memUsageMB,
      uptime: process.uptime(),
      activeConnections: this.metrics.websocketConnections
    });
  }

  // Clean old data
  cleanOldData() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Clean old error counts
    for (const [key] of this.errorCounts) {
      const keyDate = new Date(key.split('_')[1]);
      if (keyDate < thirtyDaysAgo) {
        this.errorCounts.delete(key);
      }
    }
    
    logger.info('Old monitoring data cleaned');
  }
}

// Create singleton instance
const monitoring = new MonitoringService();

export default monitoring;