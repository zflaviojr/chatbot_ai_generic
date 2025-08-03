/**
 * @jest-environment jsdom
 */

import { MessageHistory } from '../components/MessageHistory.js';

describe('MessageHistory', () => {
  let container;
  let messageHistory;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.height = '300px';
    container.style.overflow = 'auto';
    document.body.appendChild(container);
    
    messageHistory = new MessageHistory(container);
  });

  afterEach(() => {
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  });

  describe('Inicialização', () => {
    test('deve inicializar com configuração correta', () => {
      expect(messageHistory.container).toBe(container);
      expect(messageHistory.messages.size).toBe(0);
      expect(messageHistory.messageOrder.length).toBe(0);
      expect(messageHistory.maxMessages).toBe(100);
      expect(messageHistory.autoScroll).toBe(true);
    });

    test('deve configurar container corretamente', () => {
      expect(container.classList.contains('chat-messages')).toBe(true);
      expect(container.querySelector('.chat-typing-indicator')).toBeTruthy();
    });
  });

  describe('Adição de Mensagens', () => {
    test('deve adicionar mensagem corretamente', () => {
      const messageData = {
        content: 'Teste de mensagem',
        type: 'user'
      };

      const messageId = messageHistory.addMessage(messageData);

      expect(messageId).toBeTruthy();
      expect(messageHistory.messages.has(messageId)).toBe(true);
      expect(messageHistory.messageOrder.includes(messageId)).toBe(true);
      expect(messageHistory.messages.size).toBe(1);
    });

    test('deve gerar ID único se não fornecido', () => {
      const messageData = {
        content: 'Teste',
        type: 'user'
      };

      const messageId = messageHistory.addMessage(messageData);
      expect(messageId).toMatch(/^msg_\d+_[a-z0-9]+$/);
    });

    test('deve usar ID fornecido', () => {
      const messageData = {
        id: 'custom-id',
        content: 'Teste',
        type: 'user'
      };

      const messageId = messageHistory.addMessage(messageData);
      expect(messageId).toBe('custom-id');
    });

    test('deve inserir mensagem no DOM antes do indicador de digitação', () => {
      const messageData = {
        content: 'Teste',
        type: 'user'
      };

      messageHistory.addMessage(messageData);

      const messages = container.querySelectorAll('.chat-message');
      const typingIndicator = container.querySelector('.chat-typing-indicator');
      
      expect(messages.length).toBe(1);
      expect(messages[0].nextSibling).toBe(typingIndicator);
    });

    test('deve remover mensagens antigas quando exceder limite', () => {
      messageHistory.maxMessages = 2;

      // Adiciona 3 mensagens
      const id1 = messageHistory.addMessage({ content: 'Msg 1', type: 'user' });
      const id2 = messageHistory.addMessage({ content: 'Msg 2', type: 'user' });
      const id3 = messageHistory.addMessage({ content: 'Msg 3', type: 'user' });

      expect(messageHistory.messages.size).toBe(2);
      expect(messageHistory.messages.has(id1)).toBe(false);
      expect(messageHistory.messages.has(id2)).toBe(true);
      expect(messageHistory.messages.has(id3)).toBe(true);
    });
  });

  describe('Atualização de Mensagens', () => {
    let messageId;

    beforeEach(() => {
      messageId = messageHistory.addMessage({
        content: 'Mensagem original',
        type: 'user',
        status: 'sending'
      });
    });

    test('deve atualizar conteúdo da mensagem', () => {
      const result = messageHistory.updateMessage(messageId, {
        content: 'Conteúdo atualizado'
      });

      expect(result).toBe(true);
      const message = messageHistory.messages.get(messageId);
      expect(message.content).toBe('Conteúdo atualizado');
    });

    test('deve atualizar status da mensagem', () => {
      const result = messageHistory.updateMessage(messageId, {
        status: 'sent'
      });

      expect(result).toBe(true);
      const message = messageHistory.messages.get(messageId);
      expect(message.status).toBe('sent');
    });

    test('deve retornar false para mensagem inexistente', () => {
      const result = messageHistory.updateMessage('id-inexistente', {
        content: 'Teste'
      });

      expect(result).toBe(false);
    });
  });

  describe('Remoção de Mensagens', () => {
    let messageId;

    beforeEach(() => {
      messageId = messageHistory.addMessage({
        content: 'Mensagem para remover',
        type: 'user'
      });
    });

    test('deve remover mensagem corretamente', () => {
      const result = messageHistory.removeMessage(messageId);

      expect(result).toBe(true);
      expect(messageHistory.messages.has(messageId)).toBe(false);
      expect(messageHistory.messageOrder.includes(messageId)).toBe(false);
    });

    test('deve retornar false para mensagem inexistente', () => {
      const result = messageHistory.removeMessage('id-inexistente');
      expect(result).toBe(false);
    });
  });

  describe('Limpeza do Histórico', () => {
    beforeEach(() => {
      messageHistory.addMessage({ content: 'Msg 1', type: 'user' });
      messageHistory.addMessage({ content: 'Msg 2', type: 'bot' });
    });

    test('deve limpar todas as mensagens', () => {
      messageHistory.clearHistory();

      expect(messageHistory.messages.size).toBe(0);
      expect(messageHistory.messageOrder.length).toBe(0);
      expect(container.querySelectorAll('.chat-message').length).toBe(0);
    });

    test('deve manter indicador de digitação após limpeza', () => {
      messageHistory.clearHistory();

      const typingIndicator = container.querySelector('.chat-typing-indicator');
      expect(typingIndicator).toBeTruthy();
    });
  });

  describe('Indicador de Digitação', () => {
    test('deve mostrar indicador de digitação', () => {
      messageHistory.showTypingIndicator();

      expect(messageHistory.typingIndicator.isShowing()).toBe(true);
    });

    test('deve esconder indicador de digitação', () => {
      messageHistory.showTypingIndicator();
      messageHistory.hideTypingIndicator();

      expect(messageHistory.typingIndicator.isShowing()).toBe(false);
    });
  });

  describe('Scroll Automático', () => {
    test('deve fazer scroll para o final quando auto-scroll habilitado', () => {
      const scrollSpy = jest.spyOn(container, 'scrollTo');
      
      messageHistory.scrollToBottom();

      expect(scrollSpy).toHaveBeenCalledWith({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    });

    test('deve fazer scroll sem animação quando especificado', () => {
      const scrollSpy = jest.spyOn(container, 'scrollTo');
      
      messageHistory.scrollToBottom(false);

      expect(scrollSpy).toHaveBeenCalledWith({
        top: container.scrollHeight,
        behavior: 'auto'
      });
    });

    test('deve habilitar auto-scroll forçadamente', () => {
      messageHistory.autoScroll = false;
      
      messageHistory.enableAutoScroll();

      expect(messageHistory.autoScroll).toBe(true);
    });
  });

  describe('Recuperação de Dados', () => {
    beforeEach(() => {
      messageHistory.addMessage({ content: 'Msg 1', type: 'user' });
      messageHistory.addMessage({ content: 'Msg 2', type: 'bot' });
    });

    test('deve retornar todas as mensagens em ordem', () => {
      const messages = messageHistory.getAllMessages();

      expect(messages.length).toBe(2);
      expect(messages[0].content).toBe('Msg 1');
      expect(messages[1].content).toBe('Msg 2');
    });

    test('deve retornar estatísticas corretas', () => {
      const stats = messageHistory.getStats();

      expect(stats.totalMessages).toBe(2);
      expect(stats.userMessages).toBe(1);
      expect(stats.botMessages).toBe(1);
      expect(stats.autoScrollEnabled).toBe(true);
    });
  });

  describe('Exportação e Importação', () => {
    beforeEach(() => {
      messageHistory.addMessage({ content: 'Msg 1', type: 'user' });
      messageHistory.addMessage({ content: 'Msg 2', type: 'bot' });
    });

    test('deve exportar histórico corretamente', () => {
      const exported = messageHistory.exportHistory();

      expect(exported.messages).toBeDefined();
      expect(exported.messages.length).toBe(2);
      expect(exported.exportedAt).toBeDefined();
      expect(exported.stats).toBeDefined();
    });

    test('deve importar histórico corretamente', () => {
      const exportedData = messageHistory.exportHistory();
      messageHistory.clearHistory();
      
      messageHistory.importHistory(exportedData);

      expect(messageHistory.messages.size).toBe(2);
      expect(messageHistory.getAllMessages().length).toBe(2);
    });

    test('deve lançar erro para dados de importação inválidos', () => {
      expect(() => {
        messageHistory.importHistory({ invalid: 'data' });
      }).toThrow('Dados de histórico inválidos');
    });
  });

  describe('Geração de ID', () => {
    test('deve gerar IDs únicos', () => {
      const id1 = messageHistory.generateMessageId();
      const id2 = messageHistory.generateMessageId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^msg_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^msg_\d+_[a-z0-9]+$/);
    });
  });
});