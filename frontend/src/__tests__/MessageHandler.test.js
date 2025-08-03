/**
 * @jest-environment jsdom
 */

import { MessageHandler } from '../components/MessageHandler.js';

// Mock do WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    this.CONNECTING = 0;
    this.OPEN = 1;
    this.CLOSING = 2;
    this.CLOSED = 3;
    
    this.eventListeners = {};
    
    // Simula conexão após um tempo
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.dispatchEvent({ type: 'open' });
    }, 10);
  }

  addEventListener(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  removeEventListener(event, callback) {
    if (this.eventListeners[event]) {
      const index = this.eventListeners[event].indexOf(callback);
      if (index > -1) {
        this.eventListeners[event].splice(index, 1);
      }
    }
  }

  dispatchEvent(event) {
    if (this.eventListeners[event.type]) {
      this.eventListeners[event.type].forEach(callback => callback(event));
    }
  }

  send(data) {
    if (this.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket não está aberto');
    }
    // Simula envio bem-sucedido
  }

  close(code = 1000, reason = '') {
    this.readyState = WebSocket.CLOSED;
    this.dispatchEvent({ 
      type: 'close', 
      code, 
      reason, 
      wasClean: code === 1000 
    });
  }
}

// Configura mock global
global.WebSocket = MockWebSocket;
global.WebSocket.CONNECTING = 0;
global.WebSocket.OPEN = 1;
global.WebSocket.CLOSING = 2;
global.WebSocket.CLOSED = 3;

describe('MessageHandler', () => {
  let messageHandler;
  const testUrl = 'ws://localhost:3001/ws';

  beforeEach(() => {
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (messageHandler) {
      messageHandler.destroy();
    }
    jest.useRealTimers();
  });

  describe('Inicialização', () => {
    test('deve criar handler com configuração padrão', () => {
      messageHandler = new MessageHandler(testUrl);

      expect(messageHandler.websocketUrl).toBe(testUrl);
      expect(messageHandler.config.reconnectInterval).toBe(3000);
      expect(messageHandler.config.maxReconnectAttempts).toBe(10);
      expect(messageHandler.config.heartbeatInterval).toBe(30000);
      expect(messageHandler.config.enableLogging).toBe(true);
      expect(messageHandler.isConnected).toBe(false);
      expect(messageHandler.messageQueue).toEqual([]);
    });

    test('deve criar handler com configuração customizada', () => {
      const customConfig = {
        reconnectInterval: 5000,
        maxReconnectAttempts: 5,
        heartbeatInterval: 60000,
        enableLogging: false
      };

      messageHandler = new MessageHandler(testUrl, customConfig);

      expect(messageHandler.config.reconnectInterval).toBe(5000);
      expect(messageHandler.config.maxReconnectAttempts).toBe(5);
      expect(messageHandler.config.heartbeatInterval).toBe(60000);
      expect(messageHandler.config.enableLogging).toBe(false);
    });

    test('deve iniciar conexão automaticamente', () => {
      messageHandler = new MessageHandler(testUrl);

      expect(messageHandler.isConnecting).toBe(true);
      expect(messageHandler.ws).toBeDefined();
    });
  });

  describe('Conexão WebSocket', () => {
    test('deve conectar com sucesso', async () => {
      let connectedEvent = null;
      
      messageHandler = new MessageHandler(testUrl);
      messageHandler.on('connected', (data) => {
        connectedEvent = data;
      });

      // Avança timers para simular conexão
      jest.advanceTimersByTime(20);

      expect(messageHandler.isConnected).toBe(true);
      expect(messageHandler.isConnecting).toBe(false);
      expect(connectedEvent).toBeDefined();
      expect(connectedEvent.reconnectAttempts).toBe(0);
    });

    test('deve tratar desconexão', () => {
      let disconnectedEvent = null;
      
      messageHandler = new MessageHandler(testUrl);
      messageHandler.on('disconnected', (data) => {
        disconnectedEvent = data;
      });

      // Conecta primeiro
      jest.advanceTimersByTime(20);
      expect(messageHandler.isConnected).toBe(true);

      // Simula desconexão
      messageHandler.ws.close(1006, 'Conexão perdida');

      expect(messageHandler.isConnected).toBe(false);
      expect(disconnectedEvent).toBeDefined();
      expect(disconnectedEvent.code).toBe(1006);
    });

    test('deve tentar reconectar após desconexão inesperada', () => {
      let reconnectEvent = null;
      
      messageHandler = new MessageHandler(testUrl);
      messageHandler.on('reconnectScheduled', (data) => {
        reconnectEvent = data;
      });

      // Conecta primeiro
      jest.advanceTimersByTime(20);
      
      // Simula desconexão inesperada
      messageHandler.ws.close(1006, 'Conexão perdida');

      expect(reconnectEvent).toBeDefined();
      expect(reconnectEvent.attempt).toBe(1);
      expect(reconnectEvent.maxAttempts).toBe(10);
    });

    test('deve parar de tentar reconectar após máximo de tentativas', () => {
      let maxAttemptsEvent = null;
      
      messageHandler = new MessageHandler(testUrl, { maxReconnectAttempts: 2 });
      messageHandler.on('maxReconnectAttemptsReached', (data) => {
        maxAttemptsEvent = data;
      });

      // Simula múltiplas desconexões
      for (let i = 0; i < 3; i++) {
        jest.advanceTimersByTime(20);
        if (messageHandler.ws) {
          messageHandler.ws.close(1006, 'Conexão perdida');
        }
        jest.advanceTimersByTime(5000);
      }

      expect(maxAttemptsEvent).toBeDefined();
      expect(maxAttemptsEvent.attempts).toBe(2);
    });
  });

  describe('Envio de Mensagens', () => {
    beforeEach(() => {
      messageHandler = new MessageHandler(testUrl);
      jest.advanceTimersByTime(20); // Conecta
    });

    test('deve enviar mensagem quando conectado', () => {
      const sendSpy = jest.spyOn(messageHandler.ws, 'send');
      
      const messageId = messageHandler.sendMessage('test', { data: 'teste' });

      expect(messageId).toBeDefined();
      expect(sendSpy).toHaveBeenCalled();
      
      const sentMessage = JSON.parse(sendSpy.mock.calls[0][0]);
      expect(sentMessage.type).toBe('test');
      expect(sentMessage.data).toBe('teste');
      expect(sentMessage.messageId).toBe(messageId);
    });

    test('deve adicionar mensagem à fila quando desconectado', () => {
      // Desconecta
      messageHandler.ws.close(1000);
      
      const messageId = messageHandler.sendMessage('test', { data: 'teste' });

      expect(messageHandler.messageQueue).toHaveLength(1);
      expect(messageHandler.messageQueue[0].type).toBe('test');
      expect(messageHandler.messageQueue[0].messageId).toBe(messageId);
    });

    test('deve processar fila ao reconectar', () => {
      // Desconecta e adiciona mensagens à fila
      messageHandler.ws.close(1000);
      messageHandler.sendMessage('test1');
      messageHandler.sendMessage('test2');
      
      expect(messageHandler.messageQueue).toHaveLength(2);

      // Simula reconexão
      messageHandler.ws = new MockWebSocket(testUrl);
      jest.advanceTimersByTime(20);

      expect(messageHandler.messageQueue).toHaveLength(0);
    });

    test('deve enviar mensagem de chat', () => {
      const sendSpy = jest.spyOn(messageHandler, 'sendMessage');
      
      messageHandler.sendChatMessage('Olá!', 'session123');

      expect(sendSpy).toHaveBeenCalledWith('chat', {
        content: 'Olá!',
        sessionId: 'session123'
      });
    });

    test('deve iniciar sessão', () => {
      const sendSpy = jest.spyOn(messageHandler, 'sendMessage');
      
      messageHandler.startSession();

      expect(sendSpy).toHaveBeenCalledWith('session_start');
    });

    test('deve encerrar sessão', () => {
      const sendSpy = jest.spyOn(messageHandler, 'sendMessage');
      
      messageHandler.endSession('session123');

      expect(sendSpy).toHaveBeenCalledWith('session_end', { sessionId: 'session123' });
    });
  });

  describe('Processamento de Mensagens', () => {
    beforeEach(() => {
      messageHandler = new MessageHandler(testUrl);
      jest.advanceTimersByTime(20); // Conecta
    });

    test('deve processar resposta de chat', () => {
      let chatResponse = null;
      
      messageHandler.on('chatResponse', (data) => {
        chatResponse = data;
      });

      const messageData = {
        type: 'chat_response',
        messageId: 'msg123',
        content: 'Resposta do bot'
      };

      messageHandler.ws.dispatchEvent({
        type: 'message',
        data: JSON.stringify(messageData)
      });

      expect(chatResponse).toBeDefined();
      expect(chatResponse.content).toBe('Resposta do bot');
      expect(chatResponse.messageId).toBe('msg123');
    });

    test('deve processar erro de chat', () => {
      let chatError = null;
      
      messageHandler.on('chatError', (data) => {
        chatError = data;
      });

      const errorData = {
        type: 'chat_error',
        messageId: 'msg123',
        message: 'Erro no processamento'
      };

      messageHandler.ws.dispatchEvent({
        type: 'message',
        data: JSON.stringify(errorData)
      });

      expect(chatError).toBeDefined();
      expect(chatError.message).toBe('Erro no processamento');
    });

    test('deve processar indicador de digitação', () => {
      let typingData = null;
      
      messageHandler.on('typing', (data) => {
        typingData = data;
      });

      const typingMessage = {
        type: 'typing',
        isTyping: true
      };

      messageHandler.ws.dispatchEvent({
        type: 'message',
        data: JSON.stringify(typingMessage)
      });

      expect(typingData).toBeDefined();
      expect(typingData.isTyping).toBe(true);
    });

    test('deve processar mensagem de sistema', () => {
      let systemMessage = null;
      
      messageHandler.on('systemMessage', (data) => {
        systemMessage = data;
      });

      const sysMessage = {
        type: 'system',
        message: 'Sistema atualizado'
      };

      messageHandler.ws.dispatchEvent({
        type: 'message',
        data: JSON.stringify(sysMessage)
      });

      expect(systemMessage).toBeDefined();
      expect(systemMessage.message).toBe('Sistema atualizado');
    });

    test('deve tratar mensagem com formato inválido', () => {
      let messageError = null;
      
      messageHandler.on('messageError', (data) => {
        messageError = data;
      });

      messageHandler.ws.dispatchEvent({
        type: 'message',
        data: 'json inválido'
      });

      expect(messageError).toBeDefined();
      expect(messageError.error).toBeDefined();
      expect(messageError.rawData).toBe('json inválido');
    });
  });

  describe('Heartbeat', () => {
    beforeEach(() => {
      messageHandler = new MessageHandler(testUrl, { heartbeatInterval: 1000 });
      jest.advanceTimersByTime(20); // Conecta
    });

    test('deve enviar ping periodicamente', () => {
      const pingSpy = jest.spyOn(messageHandler, 'ping');
      
      // Avança tempo para trigger do heartbeat
      jest.advanceTimersByTime(1000);

      expect(pingSpy).toHaveBeenCalled();
    });

    test('deve parar heartbeat ao desconectar', () => {
      const pingSpy = jest.spyOn(messageHandler, 'ping');
      
      // Desconecta
      messageHandler.ws.close(1000);
      
      // Avança tempo
      jest.advanceTimersByTime(2000);

      expect(pingSpy).not.toHaveBeenCalled();
    });
  });

  describe('Timeout de Mensagens', () => {
    beforeEach(() => {
      messageHandler = new MessageHandler(testUrl, { messageTimeout: 1000 });
      jest.advanceTimersByTime(20); // Conecta
    });

    test('deve adicionar timeout para mensagens de chat', () => {
      messageHandler.sendChatMessage('Teste');
      
      expect(messageHandler.messageTimeouts.size).toBe(1);
    });

    test('deve remover timeout ao receber resposta', () => {
      const messageId = messageHandler.sendChatMessage('Teste');
      
      // Simula resposta
      messageHandler.ws.dispatchEvent({
        type: 'message',
        data: JSON.stringify({
          type: 'chat_response',
          messageId: messageId,
          content: 'Resposta'
        })
      });

      expect(messageHandler.messageTimeouts.size).toBe(0);
    });

    test('deve emitir evento de timeout', () => {
      let timeoutEvent = null;
      
      messageHandler.on('messageTimeout', (data) => {
        timeoutEvent = data;
      });

      const messageId = messageHandler.sendChatMessage('Teste');
      
      // Avança tempo para trigger do timeout
      jest.advanceTimersByTime(1500);

      expect(timeoutEvent).toBeDefined();
      expect(timeoutEvent.messageId).toBe(messageId);
    });
  });

  describe('Sistema de Eventos', () => {
    beforeEach(() => {
      messageHandler = new MessageHandler(testUrl);
    });

    test('deve adicionar e remover event listeners', () => {
      const callback = jest.fn();
      
      messageHandler.on('test', callback);
      messageHandler.emit('test', { data: 'teste' });
      
      expect(callback).toHaveBeenCalledWith({ data: 'teste' });
      
      messageHandler.off('test', callback);
      messageHandler.emit('test', { data: 'teste2' });
      
      expect(callback).toHaveBeenCalledTimes(1);
    });

    test('deve tratar erro em event listener', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const errorCallback = () => { throw new Error('Erro no callback'); };
      
      messageHandler.on('test', errorCallback);
      messageHandler.emit('test', {});
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[MessageHandler]',
        'Erro no event listener:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Utilitários', () => {
    beforeEach(() => {
      messageHandler = new MessageHandler(testUrl);
      jest.advanceTimersByTime(20); // Conecta
    });

    test('deve gerar IDs únicos para mensagens', () => {
      const id1 = messageHandler.generateMessageId();
      const id2 = messageHandler.generateMessageId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^msg_\d+_\d+$/);
      expect(id2).toMatch(/^msg_\d+_\d+$/);
    });

    test('deve retornar estatísticas corretas', () => {
      messageHandler.sendMessage('test');
      
      const stats = messageHandler.getStats();
      
      expect(stats.isConnected).toBe(true);
      expect(stats.isConnecting).toBe(false);
      expect(stats.reconnectAttempts).toBe(0);
      expect(stats.queuedMessages).toBe(0);
      expect(stats.lastConnectTime).toBeDefined();
    });

    test('deve forçar reconexão', () => {
      const closeSpy = jest.spyOn(messageHandler.ws, 'close');
      
      messageHandler.forceReconnect();
      
      expect(closeSpy).toHaveBeenCalledWith(1000, 'Reconexão forçada');
      expect(messageHandler.reconnectAttempts).toBe(0);
    });

    test('deve desconectar permanentemente', () => {
      const closeSpy = jest.spyOn(messageHandler.ws, 'close');
      
      messageHandler.disconnect();
      
      expect(closeSpy).toHaveBeenCalledWith(1000, 'Desconexão intencional');
      expect(messageHandler.config.maxReconnectAttempts).toBe(0);
      expect(messageHandler.isConnected).toBe(false);
    });
  });

  describe('Limpeza', () => {
    test('deve destruir handler corretamente', () => {
      messageHandler = new MessageHandler(testUrl);
      jest.advanceTimersByTime(20); // Conecta
      
      const closeSpy = jest.spyOn(messageHandler.ws, 'close');
      
      messageHandler.destroy();
      
      expect(closeSpy).toHaveBeenCalled();
      expect(messageHandler.eventListeners.size).toBe(0);
      expect(messageHandler.messageQueue).toEqual([]);
      expect(messageHandler.pendingMessages.size).toBe(0);
    });
  });
});