/**
 * Frontend Analytics and Usage Tracking
 * Tracks user interactions and performance metrics
 */
class Analytics {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    this.interactions = [];
    this.performanceMetrics = [];
    this.errors = [];
    
    // Configuration
    this.config = {
      batchSize: 10,
      flushInterval: 30000, // 30 seconds
      maxStoredEvents: 100,
      enableConsoleLogging: import.meta.env.VITE_DEBUG === 'true'
    };
    
    this.init();
  }

  init() {
    // Start periodic flush
    setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
    
    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      this.trackEvent('page_visibility', {
        visible: !document.hidden,
        timestamp: Date.now()
      });
    });
    
    // Track page unload
    window.addEventListener('beforeunload', () => {
      this.flush(true); // Force flush on page unload
    });
    
    // Track performance metrics
    this.trackPerformanceMetrics();
    
    if (this.config.enableConsoleLogging) {
      console.log('Analytics initialized', { sessionId: this.sessionId });
    }
  }

  // Generate unique session ID
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Track user interactions
  trackEvent(eventType, data = {}) {
    const event = {
      sessionId: this.sessionId,
      eventType,
      timestamp: Date.now(),
      data: {
        ...data,
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        url: window.location.href
      }
    };
    
    this.interactions.push(event);
    
    // Limit stored events
    if (this.interactions.length > this.config.maxStoredEvents) {
      this.interactions = this.interactions.slice(-this.config.maxStoredEvents);
    }
    
    if (this.config.enableConsoleLogging) {
      console.log('Event tracked:', eventType, data);
    }
    
    // Auto-flush if batch size reached
    if (this.interactions.length >= this.config.batchSize) {
      this.flush();
    }
  }

  // Track chat interactions
  trackChatInteraction(type, data = {}) {
    this.trackEvent('chat_interaction', {
      interactionType: type, // 'message_sent', 'response_received', 'error', 'typing'
      ...data
    });
  }

  // Track widget interactions
  trackWidgetInteraction(action, data = {}) {
    this.trackEvent('widget_interaction', {
      action, // 'open', 'close', 'minimize', 'resize'
      ...data
    });
  }

  // Track errors
  trackError(error, context = {}) {
    const errorEvent = {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      context,
      url: window.location.href,
      userAgent: navigator.userAgent
    };
    
    this.errors.push(errorEvent);
    
    // Limit stored errors
    if (this.errors.length > 50) {
      this.errors = this.errors.slice(-50);
    }
    
    this.trackEvent('error', {
      errorType: error.name,
      errorMessage: error.message,
      context
    });
    
    if (this.config.enableConsoleLogging) {
      console.error('Error tracked:', error, context);
    }
  }

  // Track performance metrics
  trackPerformanceMetrics() {
    // Track initial page load performance
    if (window.performance && window.performance.timing) {
      const timing = window.performance.timing;
      const loadTime = timing.loadEventEnd - timing.navigationStart;
      const domReady = timing.domContentLoadedEventEnd - timing.navigationStart;
      
      this.trackEvent('performance', {
        type: 'page_load',
        loadTime,
        domReady,
        timing: {
          dns: timing.domainLookupEnd - timing.domainLookupStart,
          connect: timing.connectEnd - timing.connectStart,
          request: timing.responseStart - timing.requestStart,
          response: timing.responseEnd - timing.responseStart,
          dom: timing.domComplete - timing.domLoading
        }
      });
    }
    
    // Track resource loading performance
    if (window.performance && window.performance.getEntriesByType) {
      const resources = window.performance.getEntriesByType('resource');
      const slowResources = resources.filter(resource => resource.duration > 1000);
      
      if (slowResources.length > 0) {
        this.trackEvent('performance', {
          type: 'slow_resources',
          count: slowResources.length,
          resources: slowResources.map(r => ({
            name: r.name,
            duration: r.duration,
            size: r.transferSize
          }))
        });
      }
    }
  }

  // Track WebSocket connection metrics
  trackWebSocketMetrics(event, data = {}) {
    this.trackEvent('websocket', {
      event, // 'connect', 'disconnect', 'message_sent', 'message_received', 'error'
      ...data
    });
  }

  // Track response times
  trackResponseTime(startTime, endTime, context = {}) {
    const responseTime = endTime - startTime;
    
    this.performanceMetrics.push({
      sessionId: this.sessionId,
      timestamp: endTime,
      responseTime,
      context
    });
    
    // Limit stored metrics
    if (this.performanceMetrics.length > 100) {
      this.performanceMetrics = this.performanceMetrics.slice(-100);
    }
    
    this.trackEvent('response_time', {
      responseTime,
      ...context
    });
    
    // Alert on slow responses
    if (responseTime > 5000) {
      this.trackEvent('slow_response', {
        responseTime,
        ...context
      });
    }
  }

  // Track user engagement
  trackEngagement() {
    const now = Date.now();
    const sessionDuration = now - this.startTime;
    
    return {
      sessionId: this.sessionId,
      sessionDuration,
      totalInteractions: this.interactions.length,
      chatInteractions: this.interactions.filter(i => i.eventType === 'chat_interaction').length,
      errors: this.errors.length,
      averageResponseTime: this.calculateAverageResponseTime(),
      deviceInfo: this.getDeviceInfo()
    };
  }

  // Calculate average response time
  calculateAverageResponseTime() {
    if (this.performanceMetrics.length === 0) return 0;
    
    const total = this.performanceMetrics.reduce((sum, metric) => sum + metric.responseTime, 0);
    return Math.round(total / this.performanceMetrics.length);
  }

  // Get device information
  getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        colorDepth: window.screen.colorDepth
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      touchSupport: 'ontouchstart' in window
    };
  }

  // Get analytics summary
  getAnalyticsSummary() {
    const engagement = this.trackEngagement();
    
    return {
      session: engagement,
      interactions: {
        total: this.interactions.length,
        byType: this.groupInteractionsByType(),
        recent: this.interactions.slice(-10)
      },
      performance: {
        averageResponseTime: engagement.averageResponseTime,
        slowResponses: this.performanceMetrics.filter(m => m.responseTime > 3000).length,
        metrics: this.performanceMetrics.slice(-10)
      },
      errors: {
        total: this.errors.length,
        recent: this.errors.slice(-5)
      }
    };
  }

  // Group interactions by type
  groupInteractionsByType() {
    const grouped = {};
    
    this.interactions.forEach(interaction => {
      const type = interaction.eventType;
      if (!grouped[type]) {
        grouped[type] = 0;
      }
      grouped[type]++;
    });
    
    return grouped;
  }

  // Flush analytics data to server
  async flush(force = false) {
    if (this.interactions.length === 0 && this.errors.length === 0 && !force) {
      return;
    }
    
    const payload = {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      interactions: [...this.interactions],
      errors: [...this.errors],
      performance: [...this.performanceMetrics],
      engagement: this.trackEngagement()
    };
    
    try {
      // Send to backend analytics endpoint
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      
      const response = await fetch(`${apiBaseUrl}/api/analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        // Clear sent data
        this.interactions = [];
        this.errors = [];
        this.performanceMetrics = [];
        
        if (this.config.enableConsoleLogging) {
          console.log('Analytics data flushed successfully');
        }
      } else {
        console.warn('Failed to flush analytics data:', response.status);
      }
    } catch (error) {
      console.warn('Error flushing analytics data:', error.message);
      
      // Store in localStorage as fallback
      try {
        const stored = JSON.parse(localStorage.getItem('chatbot_analytics') || '[]');
        stored.push(payload);
        
        // Keep only last 10 payloads
        const limited = stored.slice(-10);
        localStorage.setItem('chatbot_analytics', JSON.stringify(limited));
      } catch (storageError) {
        console.warn('Failed to store analytics in localStorage:', storageError.message);
      }
    }
  }

  // Get stored analytics from localStorage
  getStoredAnalytics() {
    try {
      return JSON.parse(localStorage.getItem('chatbot_analytics') || '[]');
    } catch (error) {
      console.warn('Failed to retrieve stored analytics:', error.message);
      return [];
    }
  }

  // Clear stored analytics
  clearStoredAnalytics() {
    try {
      localStorage.removeItem('chatbot_analytics');
      if (this.config.enableConsoleLogging) {
        console.log('Stored analytics cleared');
      }
    } catch (error) {
      console.warn('Failed to clear stored analytics:', error.message);
    }
  }
}

// Create singleton instance
const analytics = new Analytics();

// Global error handler
window.addEventListener('error', (event) => {
  analytics.trackError(event.error || new Error(event.message), {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    type: 'javascript_error'
  });
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  analytics.trackError(new Error(event.reason), {
    type: 'unhandled_promise_rejection'
  });
});

export default analytics;