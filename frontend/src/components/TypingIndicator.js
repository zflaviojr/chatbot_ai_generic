/**
 * Componente para indicador de digitação do bot
 */
export class TypingIndicator {
  constructor() {
    this.isVisible = false;
    this.element = this.createElement();
  }

  /**
   * Cria o elemento DOM do indicador de digitação
   */
  createElement() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-typing-indicator';
    typingDiv.style.display = 'none';
    
    // Container da mensagem de digitação
    const messageContainer = document.createElement('div');
    messageContainer.className = 'chat-message__container';
    
    // Avatar do bot
    const avatar = document.createElement('div');
    avatar.className = 'chat-message__avatar';
    avatar.innerHTML = '🤖';
    
    // Conteúdo do indicador
    const messageContent = document.createElement('div');
    messageContent.className = 'chat-message__content';
    
    // Bubble com animação de digitação
    const typingBubble = document.createElement('div');
    typingBubble.className = 'chat-typing-indicator__bubble';
    
    // Dots animados
    const dotsContainer = document.createElement('div');
    dotsContainer.className = 'chat-typing-indicator__dots';
    
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('span');
      dot.className = 'chat-typing-indicator__dot';
      dot.style.animationDelay = `${i * 0.2}s`;
      dotsContainer.appendChild(dot);
    }
    
    typingBubble.appendChild(dotsContainer);
    messageContent.appendChild(typingBubble);
    messageContainer.appendChild(avatar);
    messageContainer.appendChild(messageContent);
    typingDiv.appendChild(messageContainer);
    
    return typingDiv;
  }

  /**
   * Mostra o indicador de digitação
   */
  show() {
    if (!this.isVisible) {
      this.isVisible = true;
      this.element.style.display = 'block';
      
      // Adiciona classe para animação de entrada
      setTimeout(() => {
        this.element.classList.add('chat-typing-indicator--visible');
      }, 10);
    }
  }

  /**
   * Esconde o indicador de digitação
   */
  hide() {
    if (this.isVisible) {
      this.isVisible = false;
      this.element.classList.remove('chat-typing-indicator--visible');
      
      // Remove do DOM após animação
      setTimeout(() => {
        this.element.style.display = 'none';
      }, 300);
    }
  }

  /**
   * Verifica se o indicador está visível
   */
  isShowing() {
    return this.isVisible;
  }

  /**
   * Retorna o elemento DOM do indicador
   */
  getElement() {
    return this.element;
  }
}