/**
 * Simple logger utility for the chatbot backend
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  constructor() {
    this.level = process.env.LOG_LEVEL || 'INFO';
    this.levelValue = LOG_LEVELS[this.level] || LOG_LEVELS.INFO;
  }

  error(message, meta = {}) {
    if (this.levelValue >= LOG_LEVELS.ERROR) {
      console.error(this._formatMessage('ERROR', message, meta));
    }
  }

  warn(message, meta = {}) {
    if (this.levelValue >= LOG_LEVELS.WARN) {
      console.warn(this._formatMessage('WARN', message, meta));
    }
  }

  info(message, meta = {}) {
    if (this.levelValue >= LOG_LEVELS.INFO) {
      console.info(this._formatMessage('INFO', message, meta));
    }
  }

  debug(message, meta = {}) {
    if (this.levelValue >= LOG_LEVELS.DEBUG) {
      console.debug(this._formatMessage('DEBUG', message, meta));
    }
  }

  _formatMessage(level, message, meta) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  }
}

// Export singleton instance
export default new Logger();