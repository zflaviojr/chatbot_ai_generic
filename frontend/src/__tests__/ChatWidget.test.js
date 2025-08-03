/**
 * @jest-environment jsdom
 */

import { ChatWidget } from '../components/ChatWidget.js';

// Mock do WebSocket
global.WebSocket = jest.fn(() => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1
}));

describe('ChatWidget', () => {
  let container;
  let chatWidget;

  beforeEach(() => {
    // Cria container de teste
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);

    // Mock de métodos do DOM
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024
    });

    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768
    });

    // Mock do visualViewport
    Object.defineProperty(window, 'visualViewport', {
      writable: true,
      configurable: true,
      value: {
        addEventListener: jest.fn(),
        height: 768
      }
    });
  });

  afterEach(() => {
    if (chatWidget) {
      chatWidget.destroy();
    }
    document.body.removeChild(container);
    jest.clearAllMocks();
  });

  describe('Inicialização', () => {
    test('deve criar widget com configuração padrão', () => {
      chatWidget = new ChatWidget('test-container');

      expect(chatWidget.containerId).toBe('test-container');
      expect(chatWidget.config.position).toBe('bottom-right');
      expect(chatWidget.config.theme).toBe('light');
      expect(chatWidget.config.title).toBe('Assistente Virtual');
      expect(chatWidget.isOpen).toBe(false);
    });

    test('deve criar widget com configuração customizada', () => {
      const customConfig = {
        position: 'bottom-left',
        theme: 'dark',
        title: 'Chatbot Personalizado',
        welcomeMessage: 'Bem-vindo!'
      };

      chatWidget = new ChatWidget('test-container', customConfig);

      expect(chatWidget.config.position).toBe('bottom-left');
      expect(chatWidget.config.theme).toBe('dark');
      expect(chatWidget.config.title).toBe('Chatbot Personalizado');
      expect(chatWidget.config.welcomeMessage).toBe('Bem-vindo!');
    });

    test('deve lançar erro se container não existir', () => {
      expect(() => {
        new ChatWidget('container-inexistente');
      }).toThrow("Elemento com ID 'container-inexistente' não encontrado");
    });

    test('deve criar elementos DOM necessários', () => {
      chatWidget = new ChatWidget('test-container');

      const widget = container.querySelector('.chat-widget');
      const fab = container.querySelector('.chat-widget__fab');
      const chatInterface = container.querySelector('.chat-widget__interface');
      const input = container.querySelector('.chat-widget__input');

      expect(widget).toBeTruthy();
      expect(fab).toBeTruthy();
      expect(chatInterface).toBeTruthy();
      expect(input).toBeTruthy();
    });
  });

  describe('Funcionalidade de Abertura/Fechamento', () => {
    beforeEach(() => {
      chatWidget = new ChatWidget('test-container');
    });

    test('deve abrir widget ao clicar no FAB', () => {
      const fab = container.querySelector('.chat-widget__fab');
      
      fab.click();

      expect(chatWidget.isOpen).toBe(true);
      expect(container.querySelector('.chat-widget--open')).toBeTruthy();
    });

    test('deve fechar widget ao clicar no botão fechar', () => {
      chatWidget.open();
      const closeBtn = container.querySelector('.chat-widget__close-btn');
      
      closeBtn.click();

      expect(chatWidget.isOpen).toBe(false);
      expect(container.querySelector('.chat-widget--open')).toBeFalsy();
    });

    test('deve minimizar widget ao clicar no botão minimizar', () => {
      chatWidget.open();
      const minimizeBtn = container.querySelector('.chat-widget__minimize-btn');
      
      minimizeBtn.click();

      expect(chatWidget.isMinimized).toBe(true);
      expect(container.querySelector('.chat-widget--minimized')).toBeTruthy();
    });

    test('deve alternar estado com toggle()', () => {
      expect(chatWidget.isOpen).toBe(false);
      
      chatWidget.toggle();
      expect(chatWidget.isOpen).toBe(true);
      
      chatWidget.toggle();
      expect(chatWidget.isOpen).toBe(false);
    });
  });

  describe('Gerenciamento de Mensagens', () => {
    beforeEach(() => {
      chatWidget = new ChatWidget('test-container');
      chatWidget.open();
    });

    test('deve adicionar mensagem do usuário', () => {
      const message = {
        type: 'user',
        content: 'Olá, como você está?',
        timestamp: new Date().toISOString()
      };

      chatWidget.addMessage(message);

      const messageElement = container.querySelector('.chat-widget__message--user');
      expect(messageElement).toBeTruthy();
      expect(messageElement.textContent).toContain('Olá, como você está?');
    });

    test('deve adicionar mensagem do bot', () => {
      const message = {
        type: 'bot',
        content: 'Estou bem, obrigado!',
        timestamp: new Date().toISOString()
      };

      chatWidget.addMessage(message);

      const messageElement = container.querySelector('.chat-widget__message--bot');
      expect(messageElement).toBeTruthy();
      expect(messageElement.textContent).toContain('Estou bem, obrigado!');
    });

    test('deve mostrar mensagem de boas-vindas', () => {
      chatWidget.showWelcomeMessage();

      const messageElement = container.querySelector('.chat-widget__message--bot');
      expect(messageElement).toBeTruthy();
      expect(messageElement.textContent).toContain(chatWidget.config.welcomeMessage);
    });
  });

  describe('Input de Mensagem', () => {
    beforeEach(() => {
      chatWidget = new ChatWidget('test-container');
      chatWidget.open();
    });

    test('deve atualizar contador de caracteres', () => {
      const input = container.querySelector('.chat-widget__input');
      const charCount = container.querySelector('.chat-widget__char-count');

      input.value = 'Teste';
      chatWidget.updateCharCount();

      expect(charCount.textContent).toBe('5/4000');
    });

    test('deve mostrar aviso quando próximo do limite', () => {
      const input = container.querySelector('.chat-widget__input');
      const charCount = container.querySelector('.chat-widget__char-count');

      input.value = 'a'.repeat(3600);
      chatWidget.updateCharCount();

      expect(charCount.classList.contains('chat-widget__char-count--warning')).toBe(true);
    });

    test('deve ativar botão enviar quando há texto', () => {
      const input = container.querySelector('.chat-widget__input');
      const sendBtn = container.querySelector('.chat-widget__send-btn');

      input.value = 'Teste';
      const event = new Event('input');
      input.dispatchEvent(event);

      expect(sendBtn.classList.contains('chat-widget__send-btn--active')).toBe(true);
    });

    test('deve enviar mensagem ao pressionar Enter', () => {
      const input = container.querySelector('.chat-widget__input');
      let eventFired = false;

      container.addEventListener('chatMessage', () => {
        eventFired = true;
      });

      input.value = 'Mensagem de teste';
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      input.dispatchEvent(event);

      expect(eventFired).toBe(true);
      expect(input.value).toBe('');
    });

    test('não deve enviar mensagem vazia', () => {
      const input = container.querySelector('.chat-widget__input');
      let eventFired = false;

      container.addEventListener('chatMessage', () => {
        eventFired = true;
      });

      input.value = '   ';
      chatWidget.sendMessage();

      expect(eventFired).toBe(false);
    });
  });

  describe('Responsividade', () => {
    beforeEach(() => {
      chatWidget = new ChatWidget('test-container');
    });

    test('deve adicionar classe mobile em telas pequenas', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 480
      });

      chatWidget.handleResize();

      expect(container.querySelector('.chat-widget--mobile')).toBeTruthy();
    });

    test('deve remover classe mobile em telas grandes', () => {
      // Primeiro adiciona a classe
      chatWidget.container.classList.add('chat-widget--mobile');

      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024
      });

      chatWidget.handleResize();

      expect(container.querySelector('.chat-widget--mobile')).toBeFalsy();
    });
  });

  describe('Indicadores Visuais', () => {
    beforeEach(() => {
      chatWidget = new ChatWidget('test-container');
    });

    test('deve mostrar indicador de digitação', () => {
      chatWidget.showTypingIndicator();

      const indicator = container.querySelector('#typing-indicator');
      expect(indicator.style.display).toBe('flex');
    });

    test('deve esconder indicador de digitação', () => {
      chatWidget.showTypingIndicator();
      chatWidget.hideTypingIndicator();

      const indicator = container.querySelector('#typing-indicator');
      expect(indicator.style.display).toBe('none');
    });

    test('deve mostrar badge com contador', () => {
      chatWidget.showBadge(3);

      const badge = container.querySelector('#chat-badge');
      const count = container.querySelector('#chat-badge-count');

      expect(badge.style.display).toBe('block');
      expect(count.textContent).toBe('3');
    });

    test('deve esconder badge', () => {
      chatWidget.showBadge();
      chatWidget.hideBadge();

      const badge = container.querySelector('#chat-badge');
      expect(badge.style.display).toBe('none');
    });
  });

  describe('Status da Conexão', () => {
    beforeEach(() => {
      chatWidget = new ChatWidget('test-container');
    });

    test('deve atualizar status para online', () => {
      chatWidget.updateStatus('online', 'Conectado');

      const status = container.querySelector('#chat-status');
      expect(status.textContent).toBe('Conectado');
      expect(status.classList.contains('chat-widget__status--online')).toBe(true);
    });

    test('deve atualizar status para offline', () => {
      chatWidget.updateStatus('offline', 'Desconectado');

      const status = container.querySelector('#chat-status');
      expect(status.textContent).toBe('Desconectado');
      expect(status.classList.contains('chat-widget__status--offline')).toBe(true);
    });
  });

  describe('Limpeza', () => {
    test('deve destruir widget corretamente', () => {
      chatWidget = new ChatWidget('test-container');
      
      expect(container.querySelector('.chat-widget')).toBeTruthy();
      
      chatWidget.destroy();
      
      expect(container.querySelector('.chat-widget')).toBeFalsy();
    });
  });
});