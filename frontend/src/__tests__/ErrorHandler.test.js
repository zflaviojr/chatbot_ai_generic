/**
 * @jest-environment jsdom
 */

import { ErrorHandler } from '../components/ErrorHandler.js';

describe('ErrorHandler', () => {
  let errorHandler;
  let mockFetch;

  beforeEach(() => {
    // Mock de fetch para testes de conectividade
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    // Mock de navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });

    // Configuração de teste
    const config = {
      enableLogging: false,
      enableUserNotifications: true,
      enableRetry: true,
      maxRetryAttempts: 2,
      retryDelay: 100,
      offlineDetection: true
    };

    errorHandler = new ErrorHandler(config);
  });

  afterEach(() => {
    if (errorHandler) {
      errorHandler.destroy();
    }
    
    // Limpa DOM
    document.querySelectorAll('.chatbot-notification-banner').forEach(banner => {
      banner.remove();
    });
  });

  describe('Inicialização', () => {
    test('deve inicializar com configuração correta', () => {
      expect(errorHandler.config.enableUserNotifications).toBe(true);
      expect(errorHandler.config.enableRetry).toBe(true);
      expect(errorHandler.config.maxRetryAttempts).toBe(2);
      expect(errorHandler.config.retryDelay).toBe(100);
      expect(errorHandler.isOnline).toBe(true);
    });

    test('deve configurar handlers globais de erro', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      
      new ErrorHandler();
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
      
      addEventListenerSpy.mockRestore();
    });
  });

  describe('Tratamento de Erros Globais', () => {
    test('deve capturar erro JavaScript global', () => {
      const errorInfo = {
        type: 'javascript',
        message: 'Erro de teste',
        filename: 'test.js',
        lineno: 10,
        colno: 5
      };

      errorHandler.handleGlobalError(errorInfo);

      expect(errorHandler.errorHistory).toHaveLength(1);
      expect(errorHandler.errorHistory[0]).toMatchObject({
        category: 'global',
        severity: 'high',
        type: 'javascript',
        message: 'Erro de teste'
      });
    });

    test('deve capturar erro de recurso', () => {
      const errorInfo = {
        type: 'resource',
        element: 'IMG',
        source: 'test.jpg',
        message: 'Falha ao carregar recurso: IMG'
      };

      errorHandler.handleResourceError(errorInfo);

      expect(errorHandler.errorHistory).toHaveLength(1);
      expect(errorHandler.errorHistory[0]).toMatchObject({
        category: 'resource',
        severity: 'medium',
        retryable: true
      });
    });

    test('deve capturar promise rejeitada', () => {
      const errorInfo = {
        type: 'promise',
        reason: new Error('Promise rejeitada'),
        message: 'Promise rejeitada'
      };

      errorHandler.handlePromiseRejection(errorInfo);

      expect(errorHandler.errorHistory).toHaveLength(1);
      expect(errorHandler.errorHistory[0]).toMatchObject({
        category: 'promise',
        severity: 'medium'
      });
    });
  });

  describe('Tratamento de Erros de Conexão', () => {
    test('deve tratar erro de conexão WebSocket', () => {
      const errorInfo = {
        message: 'Conexão perdida',
        retryCallback: jest.fn()
      };

      errorHandler.handleConnectionError(errorInfo);

      expect(errorHandler.errorHistory).toHaveLength(1);
      expect(errorHandler.errorHistory[0]).toMatchObject({
        category: 'connection',
        severity: 'high',
        retryable: true
      });
    });

    test('deve tratar erro de mensagem', () => {
      const errorInfo = {
        messageId: 'msg-123',
        message: 'Erro ao enviar mensagem'
      };

      errorHandler.handleMessageError(errorInfo);

      expect(errorHandler.errorHistory).toHaveLength(1);
      expect(errorHandler.errorHistory[0]).toMatchObject({
        category: 'message',
        severity: 'medium',
        retryable: true
      });
    });
  });

  describe('Detecção de Rede', () => {
    test('deve detectar mudança para offline', () => {
      const offlineHandler = jest.fn();
      errorHandler.on('offline', offlineHandler);

      errorHandler.handleNetworkChange(false);

      expect(errorHandler.isOnline).toBe(false);
      expect(offlineHandler).toHaveBeenCalled();
      
      // Verifica se banner de offline foi criado
      const offlineBanner = document.getElementById('offline-banner');
      expect(offlineBanner).toBeTruthy();
    });

    test('deve detectar mudança para online', () => {
      const onlineHandler = jest.fn();
      errorHandler.on('online', onlineHandler);

      // Primeiro vai offline
      errorHandler.handleNetworkChange(false);
      
      // Depois volta online
      errorHandler.handleNetworkChange(true);

      expect(errorHandler.isOnline).toBe(true);
      expect(onlineHandler).toHaveBeenCalled();
      
      // Verifica se banner de offline foi removido
      const offlineBanner = document.getElementById('offline-banner');
      expect(offlineBanner).toBeFalsy();
    });

    test('deve verificar conectividade', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await errorHandler.checkConnectivity();

      expect(mockFetch).toHaveBeenCalledWith('/health', {
        method: 'HEAD',
        cache: 'no-cache',
        timeout: 5000
      });
    });

    test('deve tratar falha na verificação de conectividade', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      const networkChangeHandler = jest.fn();
      errorHandler.on('networkChange', networkChangeHandler);

      await errorHandler.checkConnectivity();

      expect(networkChangeHandler).toHaveBeenCalledWith({
        isOnline: false,
        wasOnline: true
      });
    });
  });

  describe('Sistema de Retry', () => {
    test('deve agendar retry para erro recuperável', (done) => {
      const retryCallback = jest.fn().mockResolvedValue();
      const error = {
        id: 'error-123',
        retryable: true
      };

      errorHandler.scheduleRetry(error, retryCallback);

      // Verifica se foi adicionado à fila
      expect(errorHandler.retryQueue.has(error.id)).toBe(true);

      // Aguarda execução do retry
      setTimeout(() => {
        expect(retryCallback).toHaveBeenCalled();
        expect(errorHandler.retryQueue.has(error.id)).toBe(false);
        done();
      }, 150);
    });

    test('deve parar retry após máximo de tentativas', (done) => {
      const retryCallback = jest.fn().mockRejectedValue(new Error('Retry failed'));
      const error = {
        id: 'error-456',
        retryable: true
      };

      errorHandler.scheduleRetry(error, retryCallback);

      // Aguarda todas as tentativas
      setTimeout(() => {
        expect(retryCallback).toHaveBeenCalledTimes(2); // maxRetryAttempts = 2
        expect(errorHandler.retryQueue.has(error.id)).toBe(false);
        done();
      }, 500);
    });

    test('deve processar fila de retry quando volta online', () => {
      const retryCallback1 = jest.fn();
      const retryCallback2 = jest.fn();

      // Adiciona itens à fila
      errorHandler.retryQueue.set('error-1', { callback: retryCallback1 });
      errorHandler.retryQueue.set('error-2', { callback: retryCallback2 });

      errorHandler.processRetryQueue();

      // Aguarda execução
      setTimeout(() => {
        expect(retryCallback1).toHaveBeenCalled();
        expect(retryCallback2).toHaveBeenCalled();
      }, 1100);
    });
  });

  describe('Notificações de Usuário', () => {
    test('deve criar banner de notificação', () => {
      const options = {
        id: 'test-banner',
        type: 'error',
        message: 'Mensagem de teste',
        duration: 0
      };

      errorHandler.createNotificationBanner(options);

      const banner = document.getElementById('test-banner');
      expect(banner).toBeTruthy();
      expect(banner.className).toContain('chatbot-notification-banner--error');
      expect(banner.textContent).toContain('Mensagem de teste');
    });

    test('deve remover banner de notificação', () => {
      const options = {
        id: 'test-banner-remove',
        type: 'info',
        message: 'Teste remoção'
      };

      errorHandler.createNotificationBanner(options);
      expect(document.getElementById('test-banner-remove')).toBeTruthy();

      errorHandler.removeNotificationBanner('test-banner-remove');
      expect(document.getElementById('test-banner-remove')).toBeFalsy();
    });

    test('deve criar banner com ações', () => {
      const actionCallback = jest.fn();
      const options = {
        id: 'test-banner-actions',
        type: 'warning',
        message: 'Teste com ações',
        actions: [
          {
            text: 'Tentar novamente',
            action: actionCallback
          }
        ]
      };

      errorHandler.createNotificationBanner(options);

      const banner = document.getElementById('test-banner-actions');
      const actionButton = banner.querySelector('[data-action="Tentar novamente"]');
      
      expect(actionButton).toBeTruthy();
      
      // Simula clique na ação
      actionButton.click();
      expect(actionCallback).toHaveBeenCalled();
    });

    test('deve remover banner automaticamente após duração', (done) => {
      const options = {
        id: 'test-banner-duration',
        type: 'success',
        message: 'Teste duração',
        duration: 100
      };

      errorHandler.createNotificationBanner(options);
      expect(document.getElementById('test-banner-duration')).toBeTruthy();

      setTimeout(() => {
        expect(document.getElementById('test-banner-duration')).toBeFalsy();
        done();
      }, 150);
    });
  });

  describe('Modo Offline', () => {
    test('deve habilitar modo offline', () => {
      // Cria botão de envio para teste
      const sendButton = document.createElement('button');
      sendButton.className = 'chat-interface__send-btn';
      document.body.appendChild(sendButton);

      errorHandler.enableOfflineMode();

      expect(document.body.classList.contains('chatbot-offline')).toBe(true);
      expect(sendButton.disabled).toBe(true);
      expect(sendButton.title).toBe('Indisponível offline');

      sendButton.remove();
    });

    test('deve desabilitar modo offline', () => {
      // Primeiro habilita
      document.body.classList.add('chatbot-offline');
      
      const sendButton = document.createElement('button');
      sendButton.className = 'chat-interface__send-btn';
      sendButton.disabled = true;
      document.body.appendChild(sendButton);

      errorHandler.disableOfflineMode();

      expect(document.body.classList.contains('chatbot-offline')).toBe(false);
      expect(sendButton.disabled).toBe(false);
      expect(sendButton.title).toBe('');

      sendButton.remove();
    });
  });

  describe('Utilitários', () => {
    test('deve gerar ID único para erro', () => {
      const id1 = errorHandler.generateErrorId();
      const id2 = errorHandler.generateErrorId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^error_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^error_\d+_[a-z0-9]+$/);
    });

    test('deve obter mensagem amigável para erro', () => {
      const connectionError = { category: 'connection' };
      const messageError = { category: 'message' };
      const unknownError = { category: 'unknown' };

      expect(errorHandler.getUserFriendlyMessage(connectionError))
        .toBe('Problema de conexão com o servidor');
      expect(errorHandler.getUserFriendlyMessage(messageError))
        .toBe('Erro ao processar mensagem');
      expect(errorHandler.getUserFriendlyMessage(unknownError))
        .toBe('Ocorreu um erro inesperado');
    });

    test('deve obter ícone para tipo de notificação', () => {
      expect(errorHandler.getNotificationIcon('error')).toBe('⚠️');
      expect(errorHandler.getNotificationIcon('warning')).toBe('⚡');
      expect(errorHandler.getNotificationIcon('success')).toBe('✅');
      expect(errorHandler.getNotificationIcon('info')).toBe('ℹ️');
      expect(errorHandler.getNotificationIcon('unknown')).toBe('ℹ️');
    });

    test('deve retornar estatísticas de erro', () => {
      // Adiciona alguns erros
      errorHandler.handleGlobalError({ message: 'Erro 1' });
      errorHandler.handleConnectionError({ message: 'Erro 2' });
      errorHandler.handleMessageError({ message: 'Erro 3' });

      const stats = errorHandler.getErrorStats();

      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByCategory.global).toBe(1);
      expect(stats.errorsByCategory.connection).toBe(1);
      expect(stats.errorsByCategory.message).toBe(1);
      expect(stats.errorsBySeverity.high).toBe(2);
      expect(stats.errorsBySeverity.medium).toBe(1);
      expect(stats.isOnline).toBe(true);
    });

    test('deve limpar histórico de erros', () => {
      errorHandler.handleGlobalError({ message: 'Erro teste' });
      expect(errorHandler.errorHistory).toHaveLength(1);

      errorHandler.clearErrorHistory();
      expect(errorHandler.errorHistory).toHaveLength(0);
    });
  });

  describe('Sistema de Eventos', () => {
    test('deve emitir e escutar eventos', () => {
      const eventHandler = jest.fn();
      
      errorHandler.on('testEvent', eventHandler);
      errorHandler.emit('testEvent', { data: 'test' });

      expect(eventHandler).toHaveBeenCalledWith({ data: 'test' });
    });

    test('deve remover event listener', () => {
      const eventHandler = jest.fn();
      
      errorHandler.on('testEvent', eventHandler);
      errorHandler.off('testEvent', eventHandler);
      errorHandler.emit('testEvent', { data: 'test' });

      expect(eventHandler).not.toHaveBeenCalled();
    });

    test('deve tratar erro em event listener', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const faultyHandler = jest.fn(() => {
        throw new Error('Handler error');
      });
      
      errorHandler.on('testEvent', faultyHandler);
      errorHandler.emit('testEvent', { data: 'test' });

      expect(consoleSpy).toHaveBeenCalledWith('Erro no event listener:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('Destruição', () => {
    test('deve destruir corretamente', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      
      // Adiciona alguns dados
      errorHandler.handleGlobalError({ message: 'Erro teste' });
      errorHandler.retryQueue.set('test', { callback: jest.fn() });
      
      // Cria banner de teste
      errorHandler.createNotificationBanner({
        id: 'test-destroy',
        type: 'info',
        message: 'Teste destruição'
      });

      errorHandler.destroy();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('error', errorHandler.handleGlobalError);
      expect(errorHandler.errorHistory).toHaveLength(0);
      expect(errorHandler.retryQueue.size).toBe(0);
      expect(errorHandler.eventListeners.size).toBe(0);
      expect(document.getElementById('test-destroy')).toBeFalsy();
      
      removeEventListenerSpy.mockRestore();
    });
  });
});