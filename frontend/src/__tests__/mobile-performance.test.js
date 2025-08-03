/**
 * Mobile Performance Tests
 * Tests for mobile-specific optimizations and performance metrics
 */

import { jest } from '@jest/globals';
import { TouchGestureHandler } from '../utils/TouchGestureHandler.js';
import { LazyLoader } from '../utils/LazyLoader.js';
import { PerformanceOptimizer } from '../utils/PerformanceOptimizer.js';
import { PWAInstaller } from '../utils/PWAInstaller.js';

// Mock DOM APIs
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

global.PerformanceObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock performance API
Object.defineProperty(global, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
    memory: {
      usedJSHeapSize: 50 * 1024 * 1024,
      totalJSHeapSize: 100 * 1024 * 1024,
    },
    getEntriesByType: jest.fn(() => []),
  },
});

// Mock navigator
Object.defineProperty(global, 'navigator', {
  value: {
    onLine: true,
    hardwareConcurrency: 4,
    connection: {
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
      saveData: false,
    },
    serviceWorker: {
      register: jest.fn(() => Promise.resolve({
        scope: '/',
        addEventListener: jest.fn(),
        waiting: null,
        active: { postMessage: jest.fn() },
      })),
    },
  },
});

describe('TouchGestureHandler', () => {
  let container;
  let gestureHandler;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    gestureHandler = new TouchGestureHandler(container);
  });

  afterEach(() => {
    gestureHandler.destroy();
    document.body.removeChild(container);
  });

  test('should initialize with default options', () => {
    expect(gestureHandler.options.swipeThreshold).toBe(50);
    expect(gestureHandler.options.swipeTimeout).toBe(300);
    expect(gestureHandler.options.enableSwipeToClose).toBe(true);
  });

  test('should detect swipe gestures', () => {
    const swipeHandler = jest.fn();
    container.addEventListener('gestureSwipe', swipeHandler);

    // Simulate touch events
    const touchStart = new TouchEvent('touchstart', {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    const touchEnd = new TouchEvent('touchend', {
      changedTouches: [{ clientX: 200, clientY: 100 }],
    });

    container.dispatchEvent(touchStart);
    
    // Fast forward time
    jest.advanceTimersByTime(100);
    
    container.dispatchEvent(touchEnd);

    expect(swipeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          direction: 'right',
          distance: expect.any(Number),
        }),
      })
    );
  });

  test('should detect tap gestures', () => {
    const tapHandler = jest.fn();
    container.addEventListener('gestureTap', tapHandler);

    const touchStart = new TouchEvent('touchstart', {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    const touchEnd = new TouchEvent('touchend', {
      changedTouches: [{ clientX: 102, clientY: 102 }],
    });

    container.dispatchEvent(touchStart);
    jest.advanceTimersByTime(100);
    container.dispatchEvent(touchEnd);

    expect(tapHandler).toHaveBeenCalled();
  });

  test('should handle touch cancellation', () => {
    const cancelHandler = jest.fn();
    container.addEventListener('gestureTouchCancel', cancelHandler);

    const touchStart = new TouchEvent('touchstart', {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    const touchCancel = new TouchEvent('touchcancel');

    container.dispatchEvent(touchStart);
    container.dispatchEvent(touchCancel);

    expect(cancelHandler).toHaveBeenCalled();
    expect(gestureHandler.isTracking).toBe(false);
  });
});

describe('LazyLoader', () => {
  let container;
  let lazyLoader;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.height = '400px';
    document.body.appendChild(container);
    lazyLoader = new LazyLoader(container, { itemHeight: 50 });
  });

  afterEach(() => {
    lazyLoader.destroy();
    document.body.removeChild(container);
  });

  test('should initialize with virtual scrolling', () => {
    expect(lazyLoader.options.enableVirtualScrolling).toBe(true);
    expect(lazyLoader.options.itemHeight).toBe(50);
    expect(lazyLoader.options.bufferSize).toBe(5);
  });

  test('should add items and update visible range', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      content: `Item ${i}`,
    }));

    lazyLoader.addItems(items);

    expect(lazyLoader.items.length).toBe(100);
    expect(lazyLoader.totalHeight).toBe(5000); // 100 * 50
  });

  test('should handle scroll events with throttling', () => {
    const scrollHandler = jest.fn();
    container.addEventListener('lazyLoaderScroll', scrollHandler);

    // Mock scroll
    Object.defineProperty(container, 'scrollTop', { value: 200, writable: true });
    Object.defineProperty(container, 'scrollHeight', { value: 1000, writable: true });
    Object.defineProperty(container, 'clientHeight', { value: 400, writable: true });

    lazyLoader.handleScroll();

    expect(scrollHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          scrollTop: 200,
          containerHeight: 400,
        }),
      })
    );
  });

  test('should trigger load more when near bottom', () => {
    const loadMoreHandler = jest.fn();
    container.addEventListener('loadMore', loadMoreHandler);

    // Set up scenario where we're near bottom
    lazyLoader.totalHeight = 1000;
    lazyLoader.containerHeight = 400;
    lazyLoader.scrollTop = 700; // Near bottom
    lazyLoader.hasMore = true;
    lazyLoader.isLoading = false;

    lazyLoader.handleScroll();

    expect(loadMoreHandler).toHaveBeenCalled();
  });

  test('should show and hide loading indicator', () => {
    lazyLoader.showLoadingIndicator();
    expect(container.querySelector('.lazy-loader__loading')).toBeTruthy();

    lazyLoader.hideLoadingIndicator();
    expect(container.querySelector('.lazy-loader__loading')).toBeFalsy();
  });

  test('should scroll to specific item', () => {
    const scrollToSpy = jest.spyOn(container, 'scrollTo').mockImplementation();
    
    lazyLoader.items = Array.from({ length: 50 }, (_, i) => ({ id: i }));
    lazyLoader.scrollToItem(10);

    expect(scrollToSpy).toHaveBeenCalledWith({
      top: 500, // 10 * 50
      behavior: 'smooth',
    });
  });
});

describe('PerformanceOptimizer', () => {
  let optimizer;

  beforeEach(() => {
    optimizer = new PerformanceOptimizer({
      enableMemoryMonitoring: true,
      enableFPSMonitoring: true,
    });
  });

  afterEach(() => {
    optimizer.destroy();
  });

  test('should initialize with monitoring enabled', () => {
    expect(optimizer.options.enableMemoryMonitoring).toBe(true);
    expect(optimizer.options.enableFPSMonitoring).toBe(true);
    expect(optimizer.timers.has('memory')).toBe(true);
  });

  test('should measure memory usage', () => {
    const memoryMetrics = optimizer.metrics.memory;
    
    expect(memoryMetrics.used).toBe(48); // ~50MB
    expect(memoryMetrics.total).toBe(95); // ~100MB
    expect(memoryMetrics.percentage).toBe(50);
  });

  test('should detect low-end devices', () => {
    // Mock low-end device
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 2 });
    Object.defineProperty(performance, 'memory', {
      value: {
        totalJSHeapSize: 512 * 1024 * 1024, // 512MB
      },
    });

    expect(optimizer.isLowEndDevice()).toBe(true);
  });

  test('should provide debounce functionality', () => {
    const mockFn = jest.fn();
    const debouncedFn = optimizer.debounce(mockFn, 100);

    debouncedFn();
    debouncedFn();
    debouncedFn();

    expect(mockFn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  test('should provide throttle functionality', () => {
    const mockFn = jest.fn();
    const throttledFn = optimizer.throttle(mockFn, 100);

    throttledFn();
    throttledFn();
    throttledFn();

    expect(mockFn).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(100);
    throttledFn();
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  test('should optimize images for mobile', () => {
    const container = document.createElement('div');
    const img = document.createElement('img');
    img.src = 'https://example.com/image.jpg';
    container.appendChild(img);

    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', { value: 375 });

    optimizer.optimizeImages(container);

    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.src).toContain('w=375');
  });

  test('should measure interaction timing', () => {
    const interaction = optimizer.measureInteraction('button-click');
    
    jest.advanceTimersByTime(50);
    const duration = interaction.end();

    expect(duration).toBeGreaterThan(0);
    expect(optimizer.metrics.interactions.count).toBe(1);
  });

  test('should get connection information', () => {
    const connectionInfo = optimizer.getConnectionInfo();
    
    expect(connectionInfo).toEqual({
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
      saveData: false,
    });
  });
});

describe('PWAInstaller', () => {
  let installer;

  beforeEach(() => {
    installer = new PWAInstaller({
      showInstallPrompt: false, // Don't show UI in tests
    });
  });

  afterEach(() => {
    installer.destroy();
  });

  test('should initialize with default options', () => {
    expect(installer.options.swPath).toBe('/sw.js');
    expect(installer.options.manifestPath).toBe('/manifest.json');
    expect(installer.options.enableNotifications).toBe(true);
  });

  test('should detect installation status', () => {
    // Mock standalone mode
    Object.defineProperty(window, 'matchMedia', {
      value: jest.fn(() => ({ matches: true })),
    });

    installer.checkInstallation();
    expect(installer.isInstalled).toBe(true);
  });

  test('should register service worker', async () => {
    const mockRegistration = {
      scope: '/',
      addEventListener: jest.fn(),
      waiting: null,
      active: { postMessage: jest.fn() },
    };

    navigator.serviceWorker.register.mockResolvedValue(mockRegistration);

    await installer.registerServiceWorker();

    expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js');
    expect(installer.registration).toBe(mockRegistration);
  });

  test('should handle install prompt', () => {
    const mockPrompt = {
      prompt: jest.fn(),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    };

    installer.deferredPrompt = mockPrompt;

    return installer.install().then((result) => {
      expect(result).toBe(true);
      expect(mockPrompt.prompt).toHaveBeenCalled();
    });
  });

  test('should detect online/offline status', () => {
    expect(installer.isOnline).toBe(true);

    // Mock offline
    Object.defineProperty(navigator, 'onLine', { value: false });
    
    const offlineEvent = new Event('offline');
    window.dispatchEvent(offlineEvent);

    expect(installer.isOnline).toBe(false);
  });

  test('should send messages to service worker', () => {
    const mockRegistration = {
      active: { postMessage: jest.fn() },
    };
    installer.registration = mockRegistration;

    const message = { type: 'TEST_MESSAGE' };
    installer.sendMessageToSW(message);

    expect(mockRegistration.active.postMessage).toHaveBeenCalledWith(message);
  });

  test('should get installation status', () => {
    const status = installer.getStatus();

    expect(status).toEqual({
      isInstalled: expect.any(Boolean),
      isOnline: expect.any(Boolean),
      hasServiceWorker: expect.any(Boolean),
      canInstall: expect.any(Boolean),
      notificationPermission: expect.any(String),
    });
  });
});

describe('Mobile Performance Integration', () => {
  test('should handle touch gestures with lazy loading', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const lazyLoader = new LazyLoader(container);
    const gestureHandler = new TouchGestureHandler(container);

    // Add items to lazy loader
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i, content: `Item ${i}` }));
    lazyLoader.addItems(items);

    // Simulate swipe gesture
    const swipeHandler = jest.fn();
    container.addEventListener('gestureSwipe', swipeHandler);

    const touchStart = new TouchEvent('touchstart', {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    const touchEnd = new TouchEvent('touchend', {
      changedTouches: [{ clientX: 100, clientY: 200 }],
    });

    container.dispatchEvent(touchStart);
    jest.advanceTimersByTime(100);
    container.dispatchEvent(touchEnd);

    expect(swipeHandler).toHaveBeenCalled();

    // Cleanup
    lazyLoader.destroy();
    gestureHandler.destroy();
    document.body.removeChild(container);
  });

  test('should optimize performance for low-end devices', () => {
    const optimizer = new PerformanceOptimizer();
    
    // Mock low-end device
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 2 });
    
    const isLowEnd = optimizer.isLowEndDevice();
    expect(isLowEnd).toBe(true);

    // Should apply optimizations
    const optimizationHandler = jest.fn();
    document.addEventListener('performanceApplyOptimizations', optimizationHandler);

    optimizer.applyLowEndOptimizations();
    expect(optimizationHandler).toHaveBeenCalled();

    optimizer.destroy();
  });

  test('should handle PWA installation with performance monitoring', async () => {
    const optimizer = new PerformanceOptimizer();
    const installer = new PWAInstaller();

    // Mock performance timing
    const interaction = optimizer.measureInteraction('pwa-install');
    
    // Mock successful installation
    installer.deferredPrompt = {
      prompt: jest.fn(),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    };

    const result = await installer.install();
    const duration = interaction.end();

    expect(result).toBe(true);
    expect(duration).toBeGreaterThan(0);

    optimizer.destroy();
    installer.destroy();
  });
});

// Performance benchmarks
describe('Performance Benchmarks', () => {
  test('touch gesture detection should be fast', () => {
    const container = document.createElement('div');
    const gestureHandler = new TouchGestureHandler(container);

    const startTime = performance.now();
    
    // Simulate 100 touch events
    for (let i = 0; i < 100; i++) {
      const touchEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: i, clientY: i }],
      });
      container.dispatchEvent(touchEvent);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Should process 100 events in less than 50ms
    expect(duration).toBeLessThan(50);

    gestureHandler.destroy();
  });

  test('lazy loading should handle large datasets efficiently', () => {
    const container = document.createElement('div');
    const lazyLoader = new LazyLoader(container);

    const startTime = performance.now();
    
    // Add 10,000 items
    const items = Array.from({ length: 10000 }, (_, i) => ({
      id: i,
      content: `Item ${i}`,
    }));
    
    lazyLoader.addItems(items);

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Should handle 10k items in less than 100ms
    expect(duration).toBeLessThan(100);
    expect(lazyLoader.items.length).toBe(10000);

    lazyLoader.destroy();
  });

  test('performance optimizer should have minimal overhead', () => {
    const startTime = performance.now();
    
    const optimizer = new PerformanceOptimizer();
    
    // Perform various operations
    optimizer.debounce(() => {}, 16);
    optimizer.throttle(() => {}, 16);
    optimizer.measureInteraction('test').end();
    optimizer.getMetrics();
    optimizer.isLowEndDevice();

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Should complete all operations in less than 10ms
    expect(duration).toBeLessThan(10);

    optimizer.destroy();
  });
});