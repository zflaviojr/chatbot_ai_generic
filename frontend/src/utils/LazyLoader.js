/**
 * Lazy Loading utility for message history and performance optimization
 * Implements virtual scrolling and progressive loading for better mobile performance
 */
export class LazyLoader {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      itemHeight: options.itemHeight || 60,
      bufferSize: options.bufferSize || 5,
      loadThreshold: options.loadThreshold || 200,
      batchSize: options.batchSize || 20,
      enableVirtualScrolling: options.enableVirtualScrolling !== false,
      ...options
    };

    this.items = [];
    this.visibleItems = [];
    this.startIndex = 0;
    this.endIndex = 0;
    this.scrollTop = 0;
    this.containerHeight = 0;
    this.totalHeight = 0;
    this.isLoading = false;
    this.hasMore = true;

    this.init();
  }

  /**
   * Initialize lazy loader
   */
  init() {
    if (!this.container) return;

    this.setupContainer();
    this.setupScrollListener();
    this.setupResizeObserver();
  }

  /**
   * Setup container for virtual scrolling
   */
  setupContainer() {
    this.container.style.position = 'relative';
    this.container.style.overflow = 'auto';

    // Create virtual scroll wrapper
    this.scrollWrapper = document.createElement('div');
    this.scrollWrapper.className = 'lazy-loader__scroll-wrapper';
    this.scrollWrapper.style.position = 'relative';
    
    // Create content container
    this.contentContainer = document.createElement('div');
    this.contentContainer.className = 'lazy-loader__content';
    this.contentContainer.style.position = 'relative';
    
    this.scrollWrapper.appendChild(this.contentContainer);
    
    // Move existing content to new container
    while (this.container.firstChild) {
      this.contentContainer.appendChild(this.container.firstChild);
    }
    
    this.container.appendChild(this.scrollWrapper);
  }

  /**
   * Setup scroll event listener with throttling
   */
  setupScrollListener() {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          this.handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    this.container.addEventListener('scroll', handleScroll, { passive: true });
  }

  /**
   * Setup resize observer for responsive updates
   */
  setupResizeObserver() {
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          this.containerHeight = entry.contentRect.height;
          this.updateVisibleRange();
        }
      });
      
      this.resizeObserver.observe(this.container);
    }
  }

  /**
   * Handle scroll events
   */
  handleScroll() {
    this.scrollTop = this.container.scrollTop;
    
    if (this.options.enableVirtualScrolling) {
      this.updateVisibleRange();
    }

    // Check if we need to load more content
    const scrollBottom = this.scrollTop + this.containerHeight;
    const shouldLoadMore = scrollBottom >= this.totalHeight - this.options.loadThreshold;

    if (shouldLoadMore && !this.isLoading && this.hasMore) {
      this.loadMore();
    }

    // Emit scroll event
    this.emit('scroll', {
      scrollTop: this.scrollTop,
      scrollBottom,
      containerHeight: this.containerHeight,
      totalHeight: this.totalHeight
    });
  }

  /**
   * Update visible range for virtual scrolling
   */
  updateVisibleRange() {
    if (!this.options.enableVirtualScrolling || this.items.length === 0) return;

    const visibleStart = Math.floor(this.scrollTop / this.options.itemHeight);
    const visibleEnd = Math.ceil((this.scrollTop + this.containerHeight) / this.options.itemHeight);

    this.startIndex = Math.max(0, visibleStart - this.options.bufferSize);
    this.endIndex = Math.min(this.items.length, visibleEnd + this.options.bufferSize);

    this.renderVisibleItems();
  }

  /**
   * Render only visible items
   */
  renderVisibleItems() {
    // Clear current content
    this.contentContainer.innerHTML = '';

    // Create spacer for items before visible range
    if (this.startIndex > 0) {
      const topSpacer = document.createElement('div');
      topSpacer.style.height = `${this.startIndex * this.options.itemHeight}px`;
      this.contentContainer.appendChild(topSpacer);
    }

    // Render visible items
    for (let i = this.startIndex; i < this.endIndex; i++) {
      if (this.items[i]) {
        const element = this.renderItem(this.items[i], i);
        this.contentContainer.appendChild(element);
      }
    }

    // Create spacer for items after visible range
    if (this.endIndex < this.items.length) {
      const bottomSpacer = document.createElement('div');
      bottomSpacer.style.height = `${(this.items.length - this.endIndex) * this.options.itemHeight}px`;
      this.contentContainer.appendChild(bottomSpacer);
    }

    // Update total height
    this.totalHeight = this.items.length * this.options.itemHeight;
    this.scrollWrapper.style.height = `${this.totalHeight}px`;
  }

  /**
   * Render individual item (to be overridden)
   */
  renderItem(item, index) {
    const element = document.createElement('div');
    element.className = 'lazy-loader__item';
    element.style.height = `${this.options.itemHeight}px`;
    element.textContent = item.content || `Item ${index}`;
    return element;
  }

  /**
   * Add items to the loader
   */
  addItems(newItems, prepend = false) {
    if (prepend) {
      this.items = [...newItems, ...this.items];
    } else {
      this.items = [...this.items, ...newItems];
    }

    if (this.options.enableVirtualScrolling) {
      this.updateVisibleRange();
    } else {
      this.renderAllItems();
    }

    this.emit('itemsAdded', { items: newItems, prepend });
  }

  /**
   * Render all items (non-virtual mode)
   */
  renderAllItems() {
    this.contentContainer.innerHTML = '';
    
    this.items.forEach((item, index) => {
      const element = this.renderItem(item, index);
      this.contentContainer.appendChild(element);
    });
  }

  /**
   * Load more items (to be implemented by consumer)
   */
  async loadMore() {
    if (this.isLoading || !this.hasMore) return;

    this.isLoading = true;
    this.showLoadingIndicator();

    try {
      // Emit load more event for consumer to handle
      const event = new CustomEvent('loadMore', {
        detail: {
          currentCount: this.items.length,
          batchSize: this.options.batchSize
        }
      });
      
      this.container.dispatchEvent(event);
    } catch (error) {
      console.error('Error loading more items:', error);
      this.emit('loadError', { error });
    } finally {
      this.isLoading = false;
      this.hideLoadingIndicator();
    }
  }

  /**
   * Show loading indicator
   */
  showLoadingIndicator() {
    if (this.loadingIndicator) return;

    this.loadingIndicator = document.createElement('div');
    this.loadingIndicator.className = 'lazy-loader__loading';
    this.loadingIndicator.innerHTML = `
      <div class="lazy-loader__loading-spinner"></div>
      <span class="lazy-loader__loading-text">Carregando...</span>
    `;
    
    this.container.appendChild(this.loadingIndicator);
  }

  /**
   * Hide loading indicator
   */
  hideLoadingIndicator() {
    if (this.loadingIndicator) {
      this.loadingIndicator.remove();
      this.loadingIndicator = null;
    }
  }

  /**
   * Set loading state
   */
  setLoading(loading) {
    this.isLoading = loading;
    if (loading) {
      this.showLoadingIndicator();
    } else {
      this.hideLoadingIndicator();
    }
  }

  /**
   * Set has more state
   */
  setHasMore(hasMore) {
    this.hasMore = hasMore;
  }

  /**
   * Scroll to specific item
   */
  scrollToItem(index) {
    if (index < 0 || index >= this.items.length) return;

    const targetScrollTop = index * this.options.itemHeight;
    this.container.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth'
    });
  }

  /**
   * Scroll to bottom
   */
  scrollToBottom() {
    this.container.scrollTo({
      top: this.container.scrollHeight,
      behavior: 'smooth'
    });
  }

  /**
   * Clear all items
   */
  clear() {
    this.items = [];
    this.visibleItems = [];
    this.startIndex = 0;
    this.endIndex = 0;
    this.totalHeight = 0;
    this.contentContainer.innerHTML = '';
    
    if (this.options.enableVirtualScrolling) {
      this.scrollWrapper.style.height = '0px';
    }
  }

  /**
   * Get current stats
   */
  getStats() {
    return {
      totalItems: this.items.length,
      visibleItems: this.endIndex - this.startIndex,
      startIndex: this.startIndex,
      endIndex: this.endIndex,
      scrollTop: this.scrollTop,
      containerHeight: this.containerHeight,
      totalHeight: this.totalHeight,
      isLoading: this.isLoading,
      hasMore: this.hasMore
    };
  }

  /**
   * Emit custom event
   */
  emit(eventName, detail = {}) {
    const event = new CustomEvent(`lazyLoader${eventName.charAt(0).toUpperCase() + eventName.slice(1)}`, {
      detail,
      bubbles: true,
      cancelable: true
    });
    this.container.dispatchEvent(event);
  }

  /**
   * Destroy lazy loader
   */
  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    this.hideLoadingIndicator();
    
    // Restore original container structure
    if (this.contentContainer && this.container) {
      while (this.contentContainer.firstChild) {
        this.container.appendChild(this.contentContainer.firstChild);
      }
      
      if (this.scrollWrapper) {
        this.scrollWrapper.remove();
      }
    }
  }
}