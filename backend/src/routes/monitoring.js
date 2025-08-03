import express from 'express';
import monitoring from '../utils/monitoring.js';
import logger from '../utils/logger.js';
import config from '../config/environment.js';

const router = express.Router();

// Middleware to restrict monitoring endpoints in production
const requireAuth = (req, res, next) => {
  if (config.server.isProduction) {
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.MONITORING_TOKEN;
    
    if (!expectedToken) {
      return res.status(503).json({
        error: 'Monitoring not configured',
        message: 'MONITORING_TOKEN not set'
      });
    }
    
    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid authorization token required'
      });
    }
  }
  
  next();
};

// Get current system metrics
router.get('/metrics', requireAuth, (req, res) => {
  try {
    const metrics = monitoring.getMetrics();
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Failed to get metrics', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics'
    });
  }
});

// Get analytics data
router.get('/analytics', requireAuth, (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const analytics = monitoring.getAnalytics(days);
    
    res.json({
      success: true,
      data: analytics,
      period: {
        days,
        from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        to: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get analytics', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics'
    });
  }
});

// Get health status with detailed information
router.get('/health/detailed', requireAuth, (req, res) => {
  try {
    const metrics = monitoring.getMetrics();
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        server: {
          status: 'ok',
          uptime: metrics.server.uptime,
          environment: metrics.server.environment
        },
        memory: {
          status: metrics.memory.heapUsed < 500 * 1024 * 1024 ? 'ok' : 'warning',
          usage: Math.round(metrics.memory.heapUsed / 1024 / 1024),
          limit: 500,
          unit: 'MB'
        },
        requests: {
          status: metrics.requests.errorRate < 5 ? 'ok' : 'warning',
          total: metrics.requests.total,
          errorRate: metrics.requests.errorRate,
          threshold: 5
        },
        websocket: {
          status: metrics.websocket.activeConnections < 100 ? 'ok' : 'warning',
          activeConnections: metrics.websocket.activeConnections,
          limit: 100
        },
        mcp: {
          status: metrics.mcp.errorRate < 10 ? 'ok' : 'warning',
          totalRequests: metrics.mcp.totalRequests,
          errorRate: metrics.mcp.errorRate,
          threshold: 10
        }
      }
    };
    
    // Determine overall health status
    const hasWarnings = Object.values(health.checks).some(check => check.status === 'warning');
    const hasErrors = Object.values(health.checks).some(check => check.status === 'error');
    
    if (hasErrors) {
      health.status = 'unhealthy';
    } else if (hasWarnings) {
      health.status = 'degraded';
    }
    
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Failed to get detailed health', { error: error.message });
    res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve health status'
    });
  }
});

// Get performance metrics
router.get('/performance', requireAuth, (req, res) => {
  try {
    const metrics = monitoring.getMetrics();
    
    const performance = {
      responseTime: metrics.performance,
      throughput: {
        requestsPerMinute: Math.round(metrics.requests.total / (metrics.server.uptime / 60)),
        mcpRequestsPerMinute: Math.round(metrics.mcp.totalRequests / (metrics.server.uptime / 60))
      },
      resources: {
        memory: {
          used: Math.round(metrics.memory.heapUsed / 1024 / 1024),
          total: Math.round(metrics.memory.heapTotal / 1024 / 1024),
          external: Math.round(metrics.memory.external / 1024 / 1024),
          unit: 'MB'
        },
        uptime: {
          seconds: metrics.server.uptime,
          formatted: formatUptime(metrics.server.uptime)
        }
      },
      connections: {
        websocket: metrics.websocket.activeConnections
      }
    };
    
    res.json({
      success: true,
      data: performance,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get performance metrics', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance metrics'
    });
  }
});

// Export metrics in Prometheus format (for external monitoring)
router.get('/metrics/prometheus', requireAuth, (req, res) => {
  try {
    const metrics = monitoring.getMetrics();
    
    const prometheusMetrics = [
      `# HELP chatbot_requests_total Total number of HTTP requests`,
      `# TYPE chatbot_requests_total counter`,
      `chatbot_requests_total ${metrics.requests.total}`,
      ``,
      `# HELP chatbot_errors_total Total number of errors`,
      `# TYPE chatbot_errors_total counter`,
      `chatbot_errors_total ${metrics.requests.errors}`,
      ``,
      `# HELP chatbot_websocket_connections Current WebSocket connections`,
      `# TYPE chatbot_websocket_connections gauge`,
      `chatbot_websocket_connections ${metrics.websocket.activeConnections}`,
      ``,
      `# HELP chatbot_mcp_requests_total Total MCP requests`,
      `# TYPE chatbot_mcp_requests_total counter`,
      `chatbot_mcp_requests_total ${metrics.mcp.totalRequests}`,
      ``,
      `# HELP chatbot_mcp_errors_total Total MCP errors`,
      `# TYPE chatbot_mcp_errors_total counter`,
      `chatbot_mcp_errors_total ${metrics.mcp.errors}`,
      ``,
      `# HELP chatbot_response_time_ms Response time in milliseconds`,
      `# TYPE chatbot_response_time_ms histogram`,
      `chatbot_response_time_ms_average ${metrics.performance.average}`,
      `chatbot_response_time_ms_p95 ${metrics.performance.p95}`,
      `chatbot_response_time_ms_p99 ${metrics.performance.p99}`,
      ``,
      `# HELP chatbot_memory_usage_bytes Memory usage in bytes`,
      `# TYPE chatbot_memory_usage_bytes gauge`,
      `chatbot_memory_usage_bytes ${metrics.memory.heapUsed}`,
      ``,
      `# HELP chatbot_uptime_seconds Server uptime in seconds`,
      `# TYPE chatbot_uptime_seconds counter`,
      `chatbot_uptime_seconds ${metrics.server.uptime}`
    ].join('\n');
    
    res.set('Content-Type', 'text/plain');
    res.send(prometheusMetrics);
  } catch (error) {
    logger.error('Failed to generate Prometheus metrics', { error: error.message });
    res.status(500).send('# Error generating metrics');
  }
});

// Utility function to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);
  
  return parts.join(' ') || '0s';
}

export default router;