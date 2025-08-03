/**
 * @jest-environment jsdom
 */

import { ChatInterface } from '../components/ChatInterface.js';

// Mocks
global.ResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn()
}));

Object.defineProperty(window, 'visualViewport', {
  writable: true,
  configurable: true,
  value: {
    addEventListener: jest.fn(),
    height: 768
  }
});

describe('ChatInterface', () => {
  let container;
  let chatInterface;

  beforeEach(() => {
    // Cria container de teste
    container = document.createElement('div');
    container.style.width = '320px';
    container.style.height = '480px';
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

    // Mock do requestAnimationFrame
    global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 0));
  });

  afterEach(() => {
    if (chatInterface) {
      chatInterface.destroy();
    }
    document.body.removeChild(container);
    jest.clearAllMocks();
  });

  describe('Inicialização', () => {
    test('deve criar interface com configuração padrão', () => {
      chatInterface = new ChatInterface(container);

      expect(chatInterface.config.title).toBe('Assistente Virtual');
      expect(chatInterface.config.placeholder).toBe('Digite sua mensagem...');
      expect(chatInterface.config.maxMessageLength).toBe(4000);
      expect(chatInterface.config.autoScroll).toBe(true);
      expect(chatInterface.messages).toEqual([]);
    });

    test('deve criar interface com configuração customizada', () => {
      const customConfig = {
        title: 'Chat Personalizado',
        placeholder: 'Escreva aqui...',
        maxMessageLength: 2000,
        autoScroll: false,
        showTimestamps: false
      };

      chatInterface = new ChatInterface(container, customConfig);

      expect(chatInterface.config.title).toBe('Chat Personalizado');
      expect(chatInterface.config.placeholder).toBe('Escreva aqui...');
      expect(chatInterface.config.maxMessageLength).toBe(2000);
      expect(chatInterface.config.autoScroll).toBe(false);
      expect(chatInterface.config.showTimestamps).toBe(false);
    });

    test('deve criar elementos DOM necessários', () => {
      chatInterface = new ChatInterface(container);

      expect(container.querySelector('.chat-interface')).toBeTruthy();
      expect(container.querySelector('.chat-interface__header')).toBeTruthy();
      expect(container.querySelector('.chat-interface__messages')).toBeTruthy();
      expect(container.querySelector('.chat-interface__input')).toBeTruthy();
      expect(container.querySelector('.chat-interface__send-btn')).toBeTruthy();
    });

    test('deve configurar ResizeObserver', () => {
      chatInterface = new ChatInterface(container);

      expect(ResizeObserver).toHaveBeenCalled();
      expect(chatInterface.resizeObserver.observe).toHaveBeenCalledWith(container);
    });
  });

  describe('Gerenciamento de Mensagens', () => {
    beforeEach(() => {
      chatInterface = new ChatInterface(container);
    });

    test('deve adicionar mensagem do usuário', () => {
      const message = {
        type: 'user',
        content: 'Olá, como você está?',
        timestamp: new Date().toISOString()
      };

      const messageId = chatInterface.addMessage(message);

      expect(messageId).toBeDefined();
      expect(chatInterface.messages).toHaveLength(1);
      expect(chatInterface.messages[0].content).toBe('Olá, como você está?');
      expect(chatInterface.messages[0].type).toBe('user');

      const messageElement = container.querySelector('.chat-interface__message--user');
      expect(messageElement).toBeTruthy();
    });

    test('deve adicionar mensagem do bot', () => {
      const message = {
        type: 'bot',
        content: 'Estou bem, obrigado por perguntar!',
        timestamp: new Date().toISOString()
      };

      chatInterface.addMessage(message);

      expect(chatInterface.messages).toHaveLength(1);
      expect(chatInterface.messages[0].type).toBe('bot');

      const messageElement = container.querySelector('.chat-interface__message--bot');
      expect(messageElement).toBeTruthy();
    });

    test('deve gerar ID único para cada mensagem', () => {
      const message1 = { type: 'user', content: 'Primeira mensagem' };
      const message2 = { type: 'user', content: 'Segunda mensagem' };

      const id1 = chatInterface.addMessage(message1);
      const id2 = chatInterface.addMessage(message2);

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^msg_\d+_\d+$/);
      expect(id2).toMatch(/^msg_\d+_\d+$/);
    });

    test('deve emitir evento ao adicionar mensagem', () => {
      let eventFired = false;
      let eventDetail = null;

      container.addEventListener('messageAdded', (e) => {
        eventFired = true;
        eventDetail = e.detail;
      });

      const message = { type: 'user', content: 'Teste' };
      chatInterface.addMessage(message);

      expect(eventFired).toBe(true);
      expect(eventDetail.content).toBe('Teste');
      expect(eventDetail.type).toBe('user');
    });

    test('deve atualizar status da mensagem', () => {
      const message = { type: 'user', content: 'Teste', status: 'sending' };
      const messageId = chatInterface.addMessage(message);

      chatInterface.updateMessageStatus(messageId, 'sent');

      const updatedMessage = chatInterface.messages.find(m => m.id === messageId);
      expect(updatedMessage.status).toBe('sent');
    });

    test('deve limpar todas as mensagens', () => {
      chatInterface.addMessage({ type: 'user', content: 'Mensagem 1' });
      chatInterface.addMessage({ type: 'bot', content: 'Mensagem 2' });

      expect(chatInterface.messages).toHaveLength(2);

      let eventFired = false;
      container.addEventListener('messagesCleared', () => {
        eventFired = true;
      });

      chatInterface.clearMessages();

      expect(chatInterface.messages).toHaveLength(0);
      expect(container.querySelector('.chat-interface__message')).toBeFalsy();
      expect(eventFired).toBe(true);
    });
  });

  describe('Input de Mensagem', () => {
    beforeEach(() => {
      chatInterface = new ChatInterface(container);
    });

    test('deve atualizar contador de caracteres', () => {
      const input = container.querySelector('.chat-interface__input');
      const charCount = container.querySelector('.chat-interface__char-count');

      input.value = 'Teste de mensagem';
      chatInterface.updateCharCount();

      expect(charCount.textContent).toBe('17/4000');
    });

    test('deve mostrar aviso quando próximo do limite', () => {
      const input = container.querySelector('.chat-interface__input');
      const charCount = container.querySelector('.chat-interface__char-count');

      input.value = 'a'.repeat(3700); // 92.5% do limite
      chatInterface.updateCharCount();

      expect(charCount.classList.contains('chat-interface__char-count--warning')).toBe(true);
    });

    test('deve mostrar erro quando no limite', () => {
      const input = container.querySelector('.chat-interface__input');
      const charCount = container.querySelector('.chat-interface__char-count');

      input.value = 'a'.repeat(4000);
      chatInterface.updateCharCount();

      expect(charCount.classList.contains('chat-interface__char-count--error')).toBe(true);
    });

    test('deve ativar botão enviar quando há conteúdo válido', () => {
      const input = container.querySelector('.chat-interface__input');
      const sendBtn = container.querySelector('.chat-interface__send-btn');

      input.value = 'Mensagem válida';
      chatInterface.updateSendButton();

      expect(sendBtn.disabled).toBe(false);
      expect(sendBtn.classList.contains('chat-interface__send-btn--active')).toBe(true);
    });

    test('deve desativar botão enviar para conteúdo inválido', () => {
      const input = container.querySelector('.chat-interface__input');
      const sendBtn = container.querySelector('.chat-interface__send-btn');

      // Mensagem muito longa
      input.value = 'a'.repeat(4001);
      chatInterface.updateSendButton();

      expect(sendBtn.disabled).toBe(true);
      expect(sendBtn.classList.contains('chat-interface__send-btn--active')).toBe(false);
    });

    test('deve enviar mensagem ao clicar no botão', () => {
      const input = container.querySelector('.chat-interface__input');
      const sendBtn = container.querySelector('.chat-interface__send-btn');

      let eventFired = false;
      let eventDetail = null;

      container.addEventListener('messageSent', (e) => {
        eventFired = true;
        eventDetail = e.detail;
      });

      input.value = 'Mensagem de teste';
      chatInterface.sendMessage();

      expect(eventFired).toBe(true);
      expect(eventDetail.content).toBe('Mensagem de teste');
      expect(input.value).toBe('');
      expect(chatInterface.messages).toHaveLength(1);
    });

    test('deve enviar mensagem ao pressionar Enter', () => {
      const input = container.querySelector('.chat-interface__input');

      let eventFired = false;
      container.addEventListener('messageSent', () => {
        eventFired = true;
      });

      input.value = 'Mensagem com Enter';
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      input.dispatchEvent(event);

      expect(eventFired).toBe(true);
    });

    test('não deve enviar mensagem com Shift+Enter', () => {
      const input = container.querySelector('.chat-interface__input');

      let eventFired = false;
      container.addEventListener('messageSent', () => {
        eventFired = true;
      });

      input.value = 'Mensagem com Shift+Enter';
      const event = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true });
      input.dispatchEvent(event);

      expect(eventFired).toBe(false);
    });

    test('não deve enviar mensagem vazia', () => {
      const input = container.querySelector('.chat-interface__input');

      let eventFired = false;
      container.addEventListener('messageSent', () => {
        eventFired = true;
      });

      input.value = '   ';
      chatInterface.sendMessage();

      expect(eventFired).toBe(false);
      expect(chatInterface.messages).toHaveLength(0);
    });

    test('deve emitir evento de digitação', () => {
      const input = container.querySelector('.chat-interface__input');

      let eventFired = false;
      let eventDetail = null;

      container.addEventListener('userTyping', (e) => {
        eventFired = true;
        eventDetail = e.detail;
      });

      input.value = 'Digitando...';
      const event = new Event('input');
      input.dispatchEvent(event);

      expect(eventFired).toBe(true);
      expect(eventDetail.content).toBe('Digitando...');
      expect(eventDetail.length).toBe(11);
    });
  });

  describe('Indicador de Digitação', () => {
    beforeEach(() => {
      chatInterface = new ChatInterface(container);
    });

    test('deve mostrar indicador de digitação', () => {
      const indicator = container.querySelector('.chat-interface__typing');

      chatInterface.showTypingIndicator();

      expect(chatInterface.isTyping).toBe(true);
      expect(indicator.style.display).toBe('flex');
    });

    test('deve esconder indicador de digitação', () => {
      const indicator = container.querySelector('.chat-interface__typing');

      chatInterface.showTypingIndicator();
      chatInterface.hideTypingIndicator();

      expect(chatInterface.isTyping).toBe(false);
      expect(indicator.style.display).toBe('none');
    });

    test('não deve mostrar indicador se desabilitado na config', () => {
      chatInterface.destroy();
      chatInterface = new ChatInterface(container, { showTypingIndicator: false });

      const indicator = container.querySelector('.chat-interface__typing');

      chatInterface.showTypingIndicator();

      expect(indicator.style.display).toBe('none');
    });
  });

  describe('Controles da Interface', () => {
    beforeEach(() => {
      chatInterface = new ChatInterface(container);
    });

    test('deve minimizar interface', () => {
      let eventFired = false;
      container.addEventListener('interfaceMinimized', () => {
        eventFired = true;
      });

      chatInterface.minimize();

      expect(chatInterface.isMinimized).toBe(true);
      expect(container.classList.contains('chat-interface--minimized')).toBe(true);
      expect(eventFired).toBe(true);
    });

    test('deve restaurar interface', () => {
      chatInterface.minimize();

      let eventFired = false;
      container.addEventListener('interfaceRestored', () => {
        eventFired = true;
      });

      chatInterface.restore();

      expect(chatInterface.isMinimized).toBe(false);
      expect(container.classList.contains('chat-interface--minimized')).toBe(false);
      expect(eventFired).toBe(true);
    });

    test('deve fechar interface', () => {
      let eventFired = false;
      container.addEventListener('interfaceClosed', () => {
        eventFired = true;
      });

      chatInterface.close();

      expect(eventFired).toBe(true);
    });

    test('deve focar no input', () => {
      const input = container.querySelector('.chat-interface__input');
      const focusSpy = jest.spyOn(input, 'focus');

      chatInterface.focusInput();

      expect(focusSpy).toHaveBeenCalled();
    });
  });

  describe('Status da Conexão', () => {
    beforeEach(() => {
      chatInterface = new ChatInterface(container);
    });

    test('deve atualizar status para online', () => {
      const status = container.querySelector('.chat-interface__status');

      chatInterface.updateConnectionStatus('online', 'Conectado');

      expect(status.textContent).toBe('Conectado');
      expect(status.classList.contains('chat-interface__status--online')).toBe(true);
    });

    test('deve atualizar status para offline', () => {
      const status = container.querySelector('.chat-interface__status');

      chatInterface.updateConnectionStatus('offline', 'Desconectado');

      expect(status.textContent).toBe('Desconectado');
      expect(status.classList.contains('chat-interface__status--offline')).toBe(true);
    });

    test('deve usar status como mensagem se não fornecida', () => {
      const status = container.querySelector('.chat-interface__status');

      chatInterface.updateConnectionStatus('connecting');

      expect(status.textContent).toBe('connecting');
      expect(status.classList.contains('chat-interface__status--connecting')).toBe(true);
    });
  });

  describe('Formatação de Conteúdo', () => {
    beforeEach(() => {
      chatInterface = new ChatInterface(container, { enableMarkdown: true });
    });

    test('deve formatar markdown básico', () => {
      const content = '**negrito** e *itálico* e `código`';
      const formatted = chatInterface.formatMessageContent(content);

      expect(formatted).toContain('<strong>negrito</strong>');
      expect(formatted).toContain('<em>itálico</em>');
      expect(formatted).toContain('<code>código</code>');
    });

    test('deve converter quebras de linha', () => {
      const content = 'Linha 1\nLinha 2';
      const formatted = chatInterface.formatMessageContent(content);

      expect(formatted).toBe('Linha 1<br>Linha 2');
    });

    test('não deve formatar markdown se desabilitado', () => {
      chatInterface.destroy();
      chatInterface = new ChatInterface(container, { enableMarkdown: false });

      const content = '**negrito** e *itálico*';
      const formatted = chatInterface.formatMessageContent(content);

      expect(formatted).toBe('**negrito** e *itálico*');
    });
  });

  describe('Estatísticas', () => {
    beforeEach(() => {
      chatInterface = new ChatInterface(container);
    });

    test('deve retornar estatísticas corretas', () => {
      chatInterface.addMessage({ type: 'user', content: 'Teste 1' });
      chatInterface.addMessage({ type: 'bot', content: 'Teste 2' });
      chatInterface.showTypingIndicator();

      const stats = chatInterface.getStats();

      expect(stats.messageCount).toBe(2);
      expect(stats.isTyping).toBe(true);
      expect(stats.isMinimized).toBe(false);
      expect(stats.autoScroll).toBe(true);
    });
  });

  describe('Limpeza', () => {
    test('deve destruir interface corretamente', () => {
      chatInterface = new ChatInterface(container);

      expect(container.querySelector('.chat-interface')).toBeTruthy();
      expect(chatInterface.resizeObserver.disconnect).not.toHaveBeenCalled();

      chatInterface.destroy();

      expect(container.innerHTML).toBe('');
      expect(chatInterface.resizeObserver.disconnect).toHaveBeenCalled();
    });
  });
});