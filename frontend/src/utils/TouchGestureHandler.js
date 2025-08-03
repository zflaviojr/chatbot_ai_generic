/**
 * Touch Gesture Handler for mobile interactions
 * Provides swipe, pinch, and other touch gestures for the chat widget
 */
export class TouchGestureHandler {
  constructor(element, options = {}) {
    this.element = element;
    this.options = {
      swipeThreshold: options.swipeThreshold || 50,
      swipeTimeout: options.swipeTimeout || 300,
      enableSwipeToClose: options.enableSwipeToClose !== false,
      enablePullToRefresh: options.enablePullToRefresh || false,
      ...options
    };

    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchStartTime = 0;
    this.isTracking = false;
    this.lastTouchY = 0;
    
    this.init();
  }

  /**
   * Initialize touch event listeners
   */
  init() {
    if (!this.element) return;

    // Use passive listeners for better performance
    this.element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
    this.element.addEventListener('touchcancel', this.handleTouchCancel.bind(this), { passive: true });
  }

  /**
   * Handle touch start
   */
  handleTouchStart(e) {
    const touch = e.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchStartTime = Date.now();
    this.lastTouchY = touch.clientY;
    this.isTracking = true;

    // Emit touch start event
    this.emit('touchStart', {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: this.touchStartTime
    });
  }

  /**
   * Handle touch move
   */
  handleTouchMove(e) {
    if (!this.isTracking) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    const currentY = touch.clientY;

    // Check for swipe gestures
    if (this.options.enableSwipeToClose) {
      const isSwipeDown = deltaY > this.options.swipeThreshold && Math.abs(deltaX) < this.options.swipeThreshold;
      const isSwipeRight = deltaX > this.options.swipeThreshold && Math.abs(deltaY) < this.options.swipeThreshold;

      if (isSwipeDown || isSwipeRight) {
        this.emit('swipeToClose', {
          direction: isSwipeDown ? 'down' : 'right',
          deltaX,
          deltaY
        });
      }
    }

    // Pull to refresh (only at top of scrollable content)
    if (this.options.enablePullToRefresh && this.isAtTop() && deltaY > 0) {
      e.preventDefault();
      this.emit('pullToRefresh', {
        distance: deltaY,
        threshold: this.options.swipeThreshold * 2
      });
    }

    // Emit general move event
    this.emit('touchMove', {
      x: touch.clientX,
      y: touch.clientY,
      deltaX,
      deltaY,
      velocity: this.calculateVelocity(currentY)
    });

    this.lastTouchY = currentY;
  }

  /**
   * Handle touch end
   */
  handleTouchEnd(e) {
    if (!this.isTracking) return;

    const touchEndTime = Date.now();
    const duration = touchEndTime - this.touchStartTime;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;

    // Determine gesture type
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const velocity = distance / duration;

    if (duration < this.options.swipeTimeout && distance > this.options.swipeThreshold) {
      // Fast swipe
      const direction = this.getSwipeDirection(deltaX, deltaY);
      this.emit('swipe', {
        direction,
        distance,
        velocity,
        deltaX,
        deltaY,
        duration
      });
    } else if (distance < 10 && duration < 300) {
      // Tap
      this.emit('tap', {
        x: touch.clientX,
        y: touch.clientY,
        duration
      });
    }

    this.emit('touchEnd', {
      x: touch.clientX,
      y: touch.clientY,
      deltaX,
      deltaY,
      duration,
      velocity
    });

    this.resetTracking();
  }

  /**
   * Handle touch cancel
   */
  handleTouchCancel() {
    this.emit('touchCancel');
    this.resetTracking();
  }

  /**
   * Calculate velocity
   */
  calculateVelocity(currentY) {
    const timeDelta = 16; // Assume 60fps
    return (currentY - this.lastTouchY) / timeDelta;
  }

  /**
   * Get swipe direction
   */
  getSwipeDirection(deltaX, deltaY) {
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (absDeltaX > absDeltaY) {
      return deltaX > 0 ? 'right' : 'left';
    } else {
      return deltaY > 0 ? 'down' : 'up';
    }
  }

  /**
   * Check if element is at top (for pull to refresh)
   */
  isAtTop() {
    const scrollableElement = this.element.querySelector('.chat-interface__messages') || 
                             this.element.querySelector('.chat-widget__messages');
    return scrollableElement ? scrollableElement.scrollTop === 0 : true;
  }

  /**
   * Reset tracking state
   */
  resetTracking() {
    this.isTracking = false;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchStartTime = 0;
    this.lastTouchY = 0;
  }

  /**
   * Emit custom event
   */
  emit(eventName, detail = {}) {
    const event = new CustomEvent(`gesture${eventName.charAt(0).toUpperCase() + eventName.slice(1)}`, {
      detail,
      bubbles: true,
      cancelable: true
    });
    this.element.dispatchEvent(event);
  }

  /**
   * Destroy gesture handler
   */
  destroy() {
    if (!this.element) return;

    this.element.removeEventListener('touchstart', this.handleTouchStart);
    this.element.removeEventListener('touchmove', this.handleTouchMove);
    this.element.removeEventListener('touchend', this.handleTouchEnd);
    this.element.removeEventListener('touchcancel', this.handleTouchCancel);
  }
}