/**
 * Performance Optimizer for mobile devices
 * Handles bundle optimization, memory management, and performance monitoring
 */
export class PerformanceOptimizer {
  constructor(options = {}) {
    this.options = {
      enableMemoryMonitoring: options.enableMemoryMonitoring !== false,
      memoryThreshold: options.memoryThreshold || 50, // MB
      enableFPSMonitoring: options.enableFPSMonitoring || false,
      enableBundleAnalysis: options.enableBundleAnalysis || false,
      debounceDelay: options.debounceDelay || 16, // ~60fps
      throttleDelay: options.throttleDelay || 100,
      ...options
    };

    this.metrics = {
      memory: { used: 0, total: 0, percentage: 0 },
      fps: { current: 0, average: 0, samples: [] },
      bundle: { size: 0, loadTime: 0 },
      interactions: { count: 0, averageTime: 0 }
    };

    this.observers = new Map();
    this.timers = new Map();
    
    this.init();
  }

  /**
   * Initialize performance optimizer
   */
  init() {
    this.setupMemoryMonitoring();
    this.setupFPSMonitoring();
    this.setupIntersectionObserver();
    this.setupPerformanceObserver();
    this.measureBundleSize();
  }

  /**
   * Setup memory monitoring
   */
  setupMemoryMonitoring() {
    if (!this.options.enableMemoryMonitoring || !('memory' in performance)) return;

    const checkMemory = () => {
      const memory = performance.memory;
      this.metrics.memory = {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
        percentage: Math.round((memory.usedJSHeapSize / memory.totalJSHeapSize) * 100)
      };

      // Warn if memory usage is high
      if (this.metrics.memory.percentage > this.options.memoryThreshold) {
        this.emit('memoryWarning', this.metrics.memory);
        this.suggestMemoryCleanup();
      }
    };

    // Check memory every 5 seconds
    this.timers.set('memory', setInterval(checkMemory, 5000));
    checkMemory(); // Initial check
  }

  /**
   * Setup FPS monitoring
   */
  setupFPSMonitoring() {
    if (!this.options.enableFPSMonitoring) return;

    let lastTime = performance.now();
    let frameCount = 0;
    const samples = [];

    const measureFPS = (currentTime) => {
      frameCount++;
      
      if (currentTime - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        samples.push(fps);
        
        // Keep only last 10 samples
        if (samples.length > 10) {
          samples.shift();
        }
        
        this.metrics.fps = {
          current: fps,
          average: Math.round(samples.reduce((a, b) => a + b, 0) / samples.length),
          samples: [...samples]
        };

        // Warn if FPS is consistently low
        if (this.metrics.fps.average < 30) {
          this.emit('performanceWarning', { type: 'fps', fps: this.metrics.fps });
        }

        frameCount = 0;
        lastTime = currentTime;
      }

      requestAnimationFrame(measureFPS);
    };

    requestAnimationFrame(measureFPS);
  }

  /**
   * Setup intersection observer for lazy loading
   */
  setupIntersectionObserver() {
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.emit('elementVisible', { element: entry.target, ratio: entry.intersectionRatio });
        }
      });
    }, {
      rootMargin: '50px',
      threshold: [0, 0.25, 0.5, 0.75, 1]
    });

    this.observers.set('intersection', observer);
  }

  /**
   * Setup performance observer
   */
  setupPerformanceObserver() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        
        entries.forEach(entry => {
          switch (entry.entryType) {
            case 'navigation':
              this.handleNavigationTiming(entry);
              break;
            case 'paint':
              this.handlePaintTiming(entry);
              break;
            case 'largest-contentful-paint':
              this.handleLCPTiming(entry);
              break;
            case 'first-input':
              this.handleFIDTiming(entry);
              break;
            case 'layout-shift':
              this.handleCLSTiming(entry);
              break;
          }
        });
      });

      // Observe different performance metrics
      const supportedTypes = ['navigation', 'paint', 'largest-contentful-paint', 'first-input', 'layout-shift'];
      supportedTypes.forEach(type => {
        try {
          observer.observe({ entryTypes: [type] });
        } catch (e) {
          // Type not supported, skip
        }
      });

      this.observers.set('performance', observer);
    } catch (error) {
      console.warn('PerformanceObserver not fully supported:', error);
    }
  }

  /**
   * Measure bundle size
   */
  measureBundleSize() {
    if (!this.options.enableBundleAnalysis) return;

    const startTime = performance.now();
    
    // Estimate bundle size from loaded resources
    if ('getEntriesByType' in performance) {
      const resources = performance.getEntriesByType('resource');
      let totalSize = 0;
      
      resources.forEach(resource => {
        if (resource.name.includes('.js') || resource.name.includes('.css')) {
          totalSize += resource.transferSize || 0;
        }
      });

      this.metrics.bundle = {
        size: Math.round(totalSize / 1024), // KB
        loadTime: Math.round(performance.now() - startTime)
      };
    }
  }

  /**
   * Handle navigation timing
   */
  handleNavigationTiming(entry) {
    const metrics = {
      dns: entry.domainLookupEnd - entry.domainLookupStart,
      tcp: entry.connectEnd - entry.connectStart,
      request: entry.responseStart - entry.requestStart,
      response: entry.responseEnd - entry.responseStart,
      dom: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
      load: entry.loadEventEnd - entry.loadEventStart
    };

    this.emit('navigationTiming', metrics);
  }

  /**
   * Handle paint timing
   */
  handlePaintTiming(entry) {
    this.emit('paintTiming', {
      name: entry.name,
      startTime: entry.startTime
    });
  }

  /**
   * Handle Largest Contentful Paint
   */
  handleLCPTiming(entry) {
    this.emit('lcpTiming', {
      startTime: entry.startTime,
      element: entry.element
    });
  }

  /**
   * Handle First Input Delay
   */
  handleFIDTiming(entry) {
    this.emit('fidTiming', {
      delay: entry.processingStart - entry.startTime,
      startTime: entry.startTime
    });
  }

  /**
   * Handle Cumulative Layout Shift
   */
  handleCLSTiming(entry) {
    this.emit('clsTiming', {
      value: entry.value,
      hadRecentInput: entry.hadRecentInput
    });
  }

  /**
   * Debounce function calls
   */
  debounce(func, delay = this.options.debounceDelay) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * Throttle function calls
   */
  throttle(func, delay = this.options.throttleDelay) {
    let lastCall = 0;
    return (...args) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        return func.apply(this, args);
      }
    };
  }

  /**
   * Optimize images for mobile
   */
  optimizeImages(container) {
    const images = container.querySelectorAll('img');
    
    images.forEach(img => {
      // Add loading="lazy" for native lazy loading
      if (!img.hasAttribute('loading')) {
        img.setAttribute('loading', 'lazy');
      }

      // Add intersection observer for custom lazy loading
      if (this.observers.has('intersection')) {
        this.observers.get('intersection').observe(img);
      }

      // Optimize for mobile screens
      if (window.innerWidth <= 768) {
        const originalSrc = img.src;
        if (originalSrc && !originalSrc.includes('w=')) {
          // Add width parameter for responsive images
          const separator = originalSrc.includes('?') ? '&' : '?';
          img.src = `${originalSrc}${separator}w=${Math.min(window.innerWidth, 800)}`;
        }
      }
    });
  }

  /**
   * Preload critical resources
   */
  preloadCriticalResources(resources) {
    resources.forEach(resource => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource.url;
      link.as = resource.type || 'script';
      
      if (resource.crossorigin) {
        link.crossOrigin = resource.crossorigin;
      }
      
      document.head.appendChild(link);
    });
  }

  /**
   * Suggest memory cleanup
   */
  suggestMemoryCleanup() {
    // Clear old message history
    this.emit('suggestCleanup', {
      type: 'memory',
      suggestions: [
        'Clear old messages',
        'Remove unused event listeners',
        'Cleanup cached data'
      ]
    });
  }

  /**
   * Measure interaction timing
   */
  measureInteraction(name, startTime = performance.now()) {
    return {
      end: () => {
        const duration = performance.now() - startTime;
        this.metrics.interactions.count++;
        
        // Update average
        const total = this.metrics.interactions.averageTime * (this.metrics.interactions.count - 1) + duration;
        this.metrics.interactions.averageTime = total / this.metrics.interactions.count;

        this.emit('interactionTiming', {
          name,
          duration,
          average: this.metrics.interactions.averageTime
        });

        return duration;
      }
    };
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      connection: this.getConnectionInfo()
    };
  }

  /**
   * Get connection information
   */
  getConnectionInfo() {
    if ('connection' in navigator) {
      const conn = navigator.connection;
      return {
        effectiveType: conn.effectiveType,
        downlink: conn.downlink,
        rtt: conn.rtt,
        saveData: conn.saveData
      };
    }
    return null;
  }

  /**
   * Check if device is low-end
   */
  isLowEndDevice() {
    // Check memory
    if ('memory' in performance && performance.memory.totalJSHeapSize < 1024 * 1024 * 1024) {
      return true;
    }

    // Check CPU cores
    if ('hardwareConcurrency' in navigator && navigator.hardwareConcurrency <= 2) {
      return true;
    }

    // Check connection
    const connection = this.getConnectionInfo();
    if (connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g')) {
      return true;
    }

    return false;
  }

  /**
   * Apply low-end device optimizations
   */
  applyLowEndOptimizations() {
    this.emit('applyOptimizations', {
      type: 'lowEnd',
      optimizations: [
        'Reduce animation duration',
        'Disable non-essential animations',
        'Increase debounce delays',
        'Reduce batch sizes',
        'Enable aggressive lazy loading'
      ]
    });
  }

  /**
   * Emit custom event
   */
  emit(eventName, detail = {}) {
    const event = new CustomEvent(`performance${eventName.charAt(0).toUpperCase() + eventName.slice(1)}`, {
      detail,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(event);
  }

  /**
   * Destroy performance optimizer
   */
  destroy() {
    // Clear timers
    this.timers.forEach(timer => clearInterval(timer));
    this.timers.clear();

    // Disconnect observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }
}