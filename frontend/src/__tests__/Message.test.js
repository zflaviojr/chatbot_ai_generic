/**
 * @jest-environment jsdom
 */

import { Message } from '../components/Message.js';

describe('Message', () => {
  let messageData;

  beforeEach(() => {
    messageData = {
      id: 'test-msg-1',
      content: 'Mensagem de teste',
      type: 'user',
      timestamp: new Date('2024-01-01T12:00:00Z'),
      status: 'sent'
    };
  });

  describe('Criação de Mensagem', () => {
    test('deve criar mensagem do usuário corretamente', () => {
      const message = new Message(messageData);

      expect(message.id).toBe('test-msg-1');
      expect(message.content).toBe('Mensagem de teste');
      expect(message.type).toBe('user');
      expect(message.status).toBe('sent');
    });

    test('deve criar mensagem do bot corretamente', () => {
      messageData.type = 'bot';
      const message = new Message(messageData);

      expect(message.type).toBe('bot');
      expect(message.element.classList.contains('chat-message--bot')).toBe(true);
    });

    test('deve usar timestamp padrão se não fornecido', () => {
      delete messageData.timestamp;
      const message = new Message(messageData);

      expect(message.timestamp).toBeInstanceOf(Date);
    });

    test('deve usar status padrão se não fornecido', () => {
      delete messageData.status;
      const message = new Message(messageData);

      expect(message.status).toBe('sent');
    });
  });

  describe('Elemento DOM', () => {
    test('deve criar elemento DOM com classes corretas', () => {
      const message = new Message(messageData);
      const element = message.getElement();

      expect(element.classList.contains('chat-message')).toBe(true);
      expect(element.classList.contains('chat-message--user')).toBe(true);
      expect(element.getAttribute('data-message-id')).toBe('test-msg-1');
    });

    test('deve incluir avatar apenas para mensagens do bot', () => {
      // Mensagem do usuário - sem avatar
      const userMessage = new Message(messageData);
      const userElement = userMessage.getElement();
      expect(userElement.querySelector('.chat-message__avatar')).toBeFalsy();

      // Mensagem do bot - com avatar
      messageData.type = 'bot';
      const botMessage = new Message(messageData);
      const botElement = botMessage.getElement();
      expect(botElement.querySelector('.chat-message__avatar')).toBeTruthy();
    });

    test('deve exibir conteúdo da mensagem', () => {
      const message = new Message(messageData);
      const element = message.getElement();
      const bubble = element.querySelector('.chat-message__bubble');

      expect(bubble.textContent).toBe('Mensagem de teste');
    });

    test('deve incluir timestamp formatado', () => {
      const message = new Message(messageData);
      const element = message.getElement();
      const timestamp = element.querySelector('.chat-message__timestamp');

      expect(timestamp).toBeTruthy();
      expect(timestamp.textContent).toBeTruthy();
    });

    test('deve incluir indicador de status para mensagens do usuário', () => {
      const message = new Message(messageData);
      const element = message.getElement();
      const status = element.querySelector('.chat-message__status');

      expect(status).toBeTruthy();
      expect(status.classList.contains('chat-message__status--sent')).toBe(true);
    });
  });

  describe('Formatação de Timestamp', () => {
    test('deve formatar timestamp de hoje apenas com hora', () => {
      const now = new Date();
      messageData.timestamp = now;
      const message = new Message(messageData);

      const formattedTime = message.formatTimestamp();
      expect(formattedTime).toMatch(/^\d{2}:\d{2}$/);
    });

    test('deve formatar timestamp antigo com data e hora', () => {
      const oldDate = new Date('2023-01-01T12:00:00Z');
      messageData.timestamp = oldDate;
      const message = new Message(messageData);

      const formattedTime = message.formatTimestamp();
      expect(formattedTime).toMatch(/\d{2}\/\d{2}/);
    });
  });

  describe('Ícones de Status', () => {
    test('deve retornar ícone correto para cada status', () => {
      // Test sending status
      const sendingMessage = new Message({...messageData, status: 'sending'});
      expect(sendingMessage.getStatusIcon()).toBe('⏳');

      // Test sent status
      const sentMessage = new Message({...messageData, status: 'sent'});
      expect(sentMessage.getStatusIcon()).toBe('✓');

      // Test error status
      const errorMessage = new Message({...messageData, status: 'error'});
      expect(errorMessage.getStatusIcon()).toBe('❌');

      // Test unknown status
      const unknownMessage = new Message({...messageData, status: 'unknown'});
      expect(unknownMessage.getStatusIcon()).toBe('');
    });
  });

  describe('Atualização de Mensagem', () => {
    test('deve atualizar status da mensagem', () => {
      const message = new Message(messageData);
      const element = message.getElement();

      message.updateStatus('error');

      expect(message.status).toBe('error');
      const statusElement = element.querySelector('.chat-message__status');
      expect(statusElement.classList.contains('chat-message__status--error')).toBe(true);
      expect(statusElement.innerHTML).toBe('❌');
    });

    test('deve atualizar conteúdo da mensagem', () => {
      const message = new Message(messageData);
      const element = message.getElement();

      message.updateContent('Novo conteúdo');

      expect(message.content).toBe('Novo conteúdo');
      const bubble = element.querySelector('.chat-message__bubble');
      expect(bubble.textContent).toBe('Novo conteúdo');
    });
  });

  describe('Remoção de Mensagem', () => {
    test('deve remover elemento do DOM', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const message = new Message(messageData);
      const element = message.getElement();
      container.appendChild(element);

      expect(container.contains(element)).toBe(true);

      message.remove();

      expect(container.contains(element)).toBe(false);

      document.body.removeChild(container);
    });

    test('deve lidar com remoção quando elemento não está no DOM', () => {
      const message = new Message(messageData);

      // Não deve lançar erro
      expect(() => message.remove()).not.toThrow();
    });
  });
});