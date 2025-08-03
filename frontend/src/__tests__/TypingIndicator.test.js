/**
 * @jest-environment jsdom
 */

import { TypingIndicator } from '../components/TypingIndicator.js';

describe('TypingIndicator', () => {
  let typingIndicator;

  beforeEach(() => {
    typingIndicator = new TypingIndicator();
  });

  describe('Inicialização', () => {
    test('deve criar indicador com estado inicial correto', () => {
      expect(typingIndicator.isVisible).toBe(false);
      expect(typingIndicator.element).toBeTruthy();
    });

    test('deve criar elemento DOM com estrutura correta', () => {
      const element = typingIndicator.getElement();

      expect(element.classList.contains('chat-typing-indicator')).toBe(true);
      expect(element.style.display).toBe('none');
      
      const avatar = element.querySelector('.chat-message__avatar');
      expect(avatar).toBeTruthy();
      expect(avatar.innerHTML).toBe('🤖');

      const dots = element.querySelectorAll('.chat-typing-indicator__dot');
      expect(dots.length).toBe(3);
    });

    test('deve aplicar delay de animação nos dots', () => {
      const element = typingIndicator.getElement();
      const dots = element.querySelectorAll('.chat-typing-indicator__dot');

      expect(dots[0].style.animationDelay).toBe('0s');
      expect(dots[1].style.animationDelay).toBe('0.2s');
      expect(dots[2].style.animationDelay).toBe('0.4s');
    });
  });

  describe('Exibição', () => {
    test('deve mostrar indicador corretamente', () => {
      typingIndicator.show();

      expect(typingIndicator.isVisible).toBe(true);
      expect(typingIndicator.element.style.display).toBe('block');
    });

    test('deve adicionar classe de visibilidade após delay', (done) => {
      typingIndicator.show();

      setTimeout(() => {
        expect(typingIndicator.element.classList.contains('chat-typing-indicator--visible')).toBe(true);
        done();
      }, 20);
    });

    test('não deve mostrar novamente se já visível', () => {
      typingIndicator.show();
      const displayBefore = typingIndicator.element.style.display;
      
      typingIndicator.show();
      const displayAfter = typingIndicator.element.style.display;

      expect(displayBefore).toBe(displayAfter);
      expect(typingIndicator.isVisible).toBe(true);
    });
  });

  describe('Ocultação', () => {
    beforeEach(() => {
      typingIndicator.show();
    });

    test('deve esconder indicador corretamente', () => {
      typingIndicator.hide();

      expect(typingIndicator.isVisible).toBe(false);
      expect(typingIndicator.element.classList.contains('chat-typing-indicator--visible')).toBe(false);
    });

    test('deve remover do DOM após animação', (done) => {
      typingIndicator.hide();

      setTimeout(() => {
        expect(typingIndicator.element.style.display).toBe('none');
        done();
      }, 350);
    });

    test('não deve esconder novamente se já oculto', () => {
      typingIndicator.hide();
      typingIndicator.hide();

      expect(typingIndicator.isVisible).toBe(false);
    });
  });

  describe('Estado de Visibilidade', () => {
    test('deve retornar estado correto com isShowing()', () => {
      expect(typingIndicator.isShowing()).toBe(false);

      typingIndicator.show();
      expect(typingIndicator.isShowing()).toBe(true);

      typingIndicator.hide();
      expect(typingIndicator.isShowing()).toBe(false);
    });
  });

  describe('Elemento DOM', () => {
    test('deve retornar elemento DOM correto', () => {
      const element = typingIndicator.getElement();

      expect(element).toBe(typingIndicator.element);
      expect(element.nodeType).toBe(Node.ELEMENT_NODE);
    });
  });

  describe('Ciclo Completo', () => {
    test('deve funcionar corretamente em múltiplos ciclos show/hide', () => {
      // Primeiro ciclo
      typingIndicator.show();
      expect(typingIndicator.isShowing()).toBe(true);
      
      typingIndicator.hide();
      expect(typingIndicator.isShowing()).toBe(false);

      // Segundo ciclo
      typingIndicator.show();
      expect(typingIndicator.isShowing()).toBe(true);
      
      typingIndicator.hide();
      expect(typingIndicator.isShowing()).toBe(false);
    });
  });
});