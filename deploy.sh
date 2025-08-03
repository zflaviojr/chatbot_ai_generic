#!/bin/bash

# Production deployment script for Chatbot Web MCP
set -e

echo "🚀 Starting production deployment..."

# Configuration
FRONTEND_DIR="frontend"
BACKEND_DIR="backend"
DEPLOY_ENV=${1:-production}

echo "📋 Deployment environment: $DEPLOY_ENV"

# Check if required files exist
if [ ! -f "$BACKEND_DIR/.env.$DEPLOY_ENV" ]; then
    echo "❌ Error: $BACKEND_DIR/.env.$DEPLOY_ENV not found"
    echo "Please create the environment file with required variables"
    exit 1
fi

if [ ! -f "$FRONTEND_DIR/.env.$DEPLOY_ENV" ]; then
    echo "❌ Error: $FRONTEND_DIR/.env.$DEPLOY_ENV not found"
    echo "Please create the environment file with required variables"
    exit 1
fi

# Install dependencies
echo "📦 Installing frontend dependencies..."
cd $FRONTEND_DIR
npm ci --production=false

echo "📦 Installing backend dependencies..."
cd ../$BACKEND_DIR
npm ci --production=false

# Run tests
echo "🧪 Running tests..."
cd ../$FRONTEND_DIR
npm run test

cd ../$BACKEND_DIR
npm run test

# Build frontend
echo "🏗️ Building frontend for $DEPLOY_ENV..."
cd ../$FRONTEND_DIR
npm run build

# Create logs directory for backend
echo "📁 Creating logs directory..."
cd ../$BACKEND_DIR
mkdir -p logs

# Build Docker image
echo "🐳 Building Docker image..."
docker build -t chatbot-backend:latest .

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down || true

# Start services
echo "🚀 Starting services..."
if [ "$DEPLOY_ENV" = "production" ]; then
    docker-compose up -d
else
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
fi

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Health check
echo "🏥 Performing health check..."
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Backend health check passed"
else
    echo "❌ Backend health check failed"
    docker-compose logs backend
    exit 1
fi

if curl -f http://localhost > /dev/null 2>&1; then
    echo "✅ Frontend health check passed"
else
    echo "❌ Frontend health check failed"
    docker-compose logs nginx
    exit 1
fi

echo "🎉 Deployment completed successfully!"
echo "📊 Frontend: http://localhost"
echo "🔧 Backend API: http://localhost:3001"
echo "💓 Health check: http://localhost:3001/health"

# Show running containers
echo "📋 Running containers:"
docker-compose ps