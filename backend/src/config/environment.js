import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment-specific configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const envFile = join(__dirname, '..', '..', `.env.${NODE_ENV}`);
const fallbackEnvFile = join(__dirname, '..', '..', '.env');

console.log('🔧 Carregando configuração de ambiente...');
console.log('🔧 NODE_ENV:', NODE_ENV);
console.log('🔧 Arquivo .env:', envFile);

// Try to load environment-specific file first, then fallback to .env
dotenv.config({ path: envFile });
dotenv.config({ path: fallbackEnvFile });

console.log('🔧 OPENAI_API_KEY carregada:', process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.substring(0, 7)}...` : 'NÃO ENCONTRADA');

// Validate required environment variables
const requiredVars = [
  'PORT',
  'NODE_ENV',
  'CORS_ORIGIN'
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

// Configuration object
export const config = {
  // Server configuration
  server: {
    port: parseInt(process.env.PORT, 10) || 3001,
    env: NODE_ENV,
    isProduction: NODE_ENV === 'production',
    isDevelopment: NODE_ENV === 'development',
    trustProxy: process.env.TRUST_PROXY === 'true'
  },
  
  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  
  // AI Provider configuration
  ai: {
    provider: process.env.AI_PROVIDER || 'openrouter',
    model: process.env.AI_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
    maxTokens: parseInt(process.env.AI_MAX_TOKENS, 10) || 1000,
    temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
    systemPrompt: process.env.AI_SYSTEM_PROMPT || 'Você é um assistente virtual útil e amigável.',
    timeout: parseInt(process.env.AI_TIMEOUT, 10) || 30000
  },

  // OpenAI configuration (legacy compatibility)
  mcp: {
    apiKey: process.env.OPENAI_API_KEY || '',
    modelName: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS, 10) || 1000,
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
    systemPrompt: process.env.OPENAI_SYSTEM_PROMPT || 'Você é um assistente virtual útil e amigável.',
    timeout: parseInt(process.env.OPENAI_TIMEOUT, 10) || 30000
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug'),
    file: process.env.LOG_FILE || `logs/${NODE_ENV}.log`,
    maxFiles: parseInt(process.env.LOG_MAX_FILES, 10) || 5,
    maxSize: process.env.LOG_MAX_SIZE || '10m'
  },
  
  // Rate limiting configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    skipSuccessfulRequests: NODE_ENV === 'production'
  },
  
  // Security configuration
  security: {
    helmetEnabled: process.env.HELMET_ENABLED === 'true' || NODE_ENV === 'production',
    contentSecurityPolicy: NODE_ENV === 'production'
  },
  
  // WebSocket configuration
  websocket: {
    path: '/ws',
    clientTracking: true,
    maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS, 10) || 100,
    heartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL, 10) || 30000
  }
};

// Validate OpenAI configuration in production
if (config.server.isProduction && !config.mcp.apiKey) {
  console.warn('⚠️ Warning: OPENAI_API_KEY not configured for production');
}

export default config;