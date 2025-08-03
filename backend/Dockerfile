# Multi-stage build for production optimization
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S chatbot -u 1001

# Set working directory
WORKDIR /app

# Copy dependencies from builder stage
COPY --from=builder --chown=chatbot:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=chatbot:nodejs src ./src
COPY --chown=chatbot:nodejs package*.json ./

# Create logs directory
RUN mkdir -p logs && chown chatbot:nodejs logs

# Switch to non-root user
USER chatbot

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/server.js"]