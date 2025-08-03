import { Message } from './Message.js';
import { TypingIndicator } from './TypingIndicator.js';

/**
 * Gerenciador do histórico de mensagens do chat
 */
export class MessageHistory {
  constructor(container) {
    this.container = container;
    this.messages = new Map(); // Map<messageId, Message>
    this.messageOrder = []; // Array para manter ordem das mensagens
    this.typingIndicator = new TypingIndicator();
    this.maxMessages = 100; // Limite de mensagens em memória
    this.autoScroll = true;
    
    this.setupContainer();
    this.setupScrollHandler();
  }

  /**
   * Configura o container de mensagens
   */
  setupContainer() {
    this.container.className = 'chat-messages';
    this.container.innerHTML = '';
    
    // Adiciona o indicador de digitação ao container
    this.container.appendChild(this.typingIndicator.getElement());
  }

  /**
   * Configura o handler de scroll para auto-scroll
   */
  setupScrollHandler() {
    let isScrolling = false;
    
    this.container.addEventListener('scroll', () => {
      if (isScrolling) return;
      
      const { scrollTop, scrollHeight, clientHeight } = this.container;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      
      // Desabilita auto-scroll se usuário scrollar para cima
      this.autoScroll = isAtBottom;
    });
  }

  /**
   * Adiciona uma nova mensagem ao histórico
   */
  addMessage(messageData) {
    const messageId = messageData.id || this.generateMessageId();
    const message = new Message({
      ...messageData,
      id: messageId
    });
    
    // Remove mensagens antigas se exceder o limite
    if (this.messageOrder.length >= this.maxMessages) {
      const oldestId = this.messageOrder.shift();
      const oldestMessage = this.messages.get(oldestId);
      if (oldestMessage) {
        oldestMessage.remove();
        this.messages.delete(oldestId);
      }
    }
    
    // Adiciona a nova mensagem
    this.messages.set(messageId, message);
    this.messageOrder.push(messageId);
    
    // Insere no DOM antes do indicador de digitação
    this.container.insertBefore(
      message.getElement(), 
      this.typingIndicator.getElement()
    );
    
    // Auto-scroll se habilitado
    if (this.autoScroll) {
      this.scrollToBottom();
    }
    
    return messageId;
  }

  /**
   * Atualiza uma mensagem existente
   */
  updateMessage(messageId, updates) {
    const message = this.messages.get(messageId);
    if (!message) {
      console.warn(`Mensagem com ID ${messageId} não encontrada`);
      return false;
    }
    
    if (updates.content !== undefined) {
      message.updateContent(updates.content);
    }
    
    if (updates.status !== undefined) {
      message.updateStatus(updates.status);
    }
    
    return true;
  }

  /**
   * Remove uma mensagem do histórico
   */
  removeMessage(messageId) {
    const message = this.messages.get(messageId);
    if (!message) {
      return false;
    }
    
    message.remove();
    this.messages.delete(messageId);
    
    const index = this.messageOrder.indexOf(messageId);
    if (index > -1) {
      this.messageOrder.splice(index, 1);
    }
    
    return true;
  }

  /**
   * Limpa todo o histórico de mensagens
   */
  clearHistory() {
    this.messages.forEach(message => message.remove());
    this.messages.clear();
    this.messageOrder = [];
    
    // Mantém apenas o indicador de digitação
    this.container.innerHTML = '';
    this.container.appendChild(this.typingIndicator.getElement());
  }

  /**
   * Mostra o indicador de digitação
   */
  showTypingIndicator() {
    this.typingIndicator.show();
    
    if (this.autoScroll) {
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  /**
   * Esconde o indicador de digitação
   */
  hideTypingIndicator() {
    this.typingIndicator.hide();
  }

  /**
   * Faz scroll para o final das mensagens
   */
  scrollToBottom(smooth = true) {
    const scrollOptions = {
      top: this.container.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    };
    
    this.container.scrollTo(scrollOptions);
  }

  /**
   * Força o auto-scroll a ser habilitado
   */
  enableAutoScroll() {
    this.autoScroll = true;
    this.scrollToBottom();
  }

  /**
   * Retorna todas as mensagens em ordem
   */
  getAllMessages() {
    return this.messageOrder.map(id => {
      const message = this.messages.get(id);
      return {
        id: message.id,
        content: message.content,
        type: message.type,
        timestamp: message.timestamp,
        status: message.status
      };
    });
  }

  /**
   * Retorna estatísticas do histórico
   */
  getStats() {
    return {
      totalMessages: this.messages.size,
      userMessages: this.messageOrder.filter(id => 
        this.messages.get(id)?.type === 'user'
      ).length,
      botMessages: this.messageOrder.filter(id => 
        this.messages.get(id)?.type === 'bot'
      ).length,
      isTypingIndicatorVisible: this.typingIndicator.isShowing(),
      autoScrollEnabled: this.autoScroll
    };
  }

  /**
   * Gera um ID único para mensagem
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Exporta o histórico como JSON
   */
  exportHistory() {
    return {
      messages: this.getAllMessages(),
      exportedAt: new Date().toISOString(),
      stats: this.getStats()
    };
  }

  /**
   * Importa histórico de um JSON
   */
  importHistory(historyData) {
    if (!historyData.messages || !Array.isArray(historyData.messages)) {
      throw new Error('Dados de histórico inválidos');
    }
    
    this.clearHistory();
    
    historyData.messages.forEach(messageData => {
      this.addMessage(messageData);
    });
    
    console.log(`Histórico importado: ${historyData.messages.length} mensagens`);
  }
}