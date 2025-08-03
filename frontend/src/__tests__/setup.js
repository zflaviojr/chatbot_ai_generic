/**
 * Configuração global para testes do frontend
 */
import { jest } from '@jest/globals';

// Dummy test to prevent "no tests" error
describe('Setup', () => {
  test('should configure test environment', () => {
    expect(true).toBe(true);
  });
});

// Mock de WebSocket global
global.WebSocket = class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    this.CONNECTING = 0;
    this.OPEN = 1;
    this.CLOSING = 2;
    this.CLOSED = 3;
    
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 0);
  }
  
  send(data) {
    // Mock send
  }
  
  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) this.onclose({ code: 1000, reason: 'Normal closure' });
  }
  
  addEventListener(event, handler) {
    this[`on${event}`] = handler;
  }
  
  removeEventListener(event, handler) {
    this[`on${event}`] = null;
  }
};

// Constantes do WebSocket
global.WebSocket.CONNECTING = 0;
global.WebSocket.OPEN = 1;
global.WebSocket.CLOSING = 2;
global.WebSocket.CLOSED = 3;

// Mock de ResizeObserver
global.ResizeObserver = class MockResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  
  observe() {
    // Mock observe
  }
  
  unobserve() {
    // Mock unobserve
  }
  
  disconnect() {
    // Mock disconnect
  }
};

// Mock de scrollTo para elementos DOM
Element.prototype.scrollTo = jest.fn();
HTMLElement.prototype.scrollTo = jest.fn();

// Mock de visualViewport
global.visualViewport = {
  height: 800,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

// Mock de Notification API
global.Notification = class MockNotification {
  constructor(title, options) {
    this.title = title;
    this.options = options;
  }
  
  static permission = 'granted';
  static requestPermission = jest.fn(() => Promise.resolve('granted'));
};

// Mock de Audio API
global.Audio = jest.fn().mockImplementation(() => ({
  play: jest.fn(() => Promise.resolve()),
  pause: jest.fn(),
  volume: 1,
  currentTime: 0,
  duration: 0
}));

// Mock de localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock de sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock de console para testes mais limpos
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Limpa mocks após cada teste
afterEach(() => {
  jest.clearAllMocks();
  
  // Limpa DOM
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

// Configurações globais para testes
beforeAll(() => {
  // Define viewport padrão
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: 1024,
  });
  
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: 768,
  });
  
  // Mock de matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});