/**
 * Componente para exibir mensagens individuais do chat
 */
export class Message {
  constructor(messageData) {
    this.id = messageData.id;
    this.content = messageData.content;
    this.type = messageData.type; // 'user' ou 'bot'
    this.timestamp = messageData.timestamp || new Date();
    this.status = messageData.status || 'sent'; // 'sending', 'sent', 'error'
    
    this.element = this.createElement();
  }

  /**
   * Cria o elemento DOM da mensagem
   */
  createElement() {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message chat-message--${this.type}`;
    messageDiv.setAttribute('data-message-id', this.id);
    
    // Container da mensagem
    const messageContainer = document.createElement('div');
    messageContainer.className = 'chat-message__container';
    
    // Avatar (apenas para mensagens do bot)
    if (this.type === 'bot') {
      const avatar = document.createElement('div');
      avatar.className = 'chat-message__avatar';
      avatar.innerHTML = '🤖';
      messageContainer.appendChild(avatar);
    }
    
    // Conteúdo da mensagem
    const messageContent = document.createElement('div');
    messageContent.className = 'chat-message__content';
    
    // Bubble da mensagem
    const messageBubble = document.createElement('div');
    messageBubble.className = 'chat-message__bubble';
    messageBubble.textContent = this.content;
    
    // Timestamp e status
    const messageInfo = document.createElement('div');
    messageInfo.className = 'chat-message__info';
    
    const timestamp = document.createElement('span');
    timestamp.className = 'chat-message__timestamp';
    timestamp.textContent = this.formatTimestamp();
    
    messageInfo.appendChild(timestamp);
    
    // Status indicator para mensagens do usuário
    if (this.type === 'user') {
      const statusIcon = document.createElement('span');
      statusIcon.className = `chat-message__status chat-message__status--${this.status}`;
      statusIcon.innerHTML = this.getStatusIcon();
      messageInfo.appendChild(statusIcon);
    }
    
    messageContent.appendChild(messageBubble);
    messageContent.appendChild(messageInfo);
    messageContainer.appendChild(messageContent);
    messageDiv.appendChild(messageContainer);
    
    return messageDiv;
  }

  /**
   * Formata o timestamp da mensagem
   */
  formatTimestamp() {
    const now = new Date();
    const messageTime = new Date(this.timestamp);
    
    // Se for hoje, mostra apenas a hora
    if (messageTime.toDateString() === now.toDateString()) {
      return messageTime.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
    
    // Se for ontem ou mais antigo, mostra data e hora
    return messageTime.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Retorna o ícone de status da mensagem
   */
  getStatusIcon() {
    switch (this.status) {
      case 'sending':
        return '⏳';
      case 'sent':
        return '✓';
      case 'error':
        return '❌';
      default:
        return '';
    }
  }

  /**
   * Atualiza o status da mensagem
   */
  updateStatus(newStatus) {
    this.status = newStatus;
    const statusElement = this.element.querySelector('.chat-message__status');
    if (statusElement) {
      statusElement.className = `chat-message__status chat-message__status--${newStatus}`;
      statusElement.innerHTML = this.getStatusIcon();
    }
  }

  /**
   * Atualiza o conteúdo da mensagem
   */
  updateContent(newContent) {
    this.content = newContent;
    const bubbleElement = this.element.querySelector('.chat-message__bubble');
    if (bubbleElement) {
      bubbleElement.textContent = newContent;
    }
  }

  /**
   * Remove a mensagem do DOM
   */
  remove() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }

  /**
   * Retorna o elemento DOM da mensagem
   */
  getElement() {
    return this.element;
  }
}