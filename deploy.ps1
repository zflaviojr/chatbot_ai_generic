# Production deployment script for Chatbot Web MCP (PowerShell)
param(
    [string]$DeployEnv = "production"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting production deployment..." -ForegroundColor Green

# Configuration
$FrontendDir = "frontend"
$BackendDir = "backend"

Write-Host "📋 Deployment environment: $DeployEnv" -ForegroundColor Cyan

# Check if required files exist
if (-not (Test-Path "$BackendDir\.env.$DeployEnv")) {
    Write-Host "❌ Error: $BackendDir\.env.$DeployEnv not found" -ForegroundColor Red
    Write-Host "Please create the environment file with required variables" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path "$FrontendDir\.env.$DeployEnv")) {
    Write-Host "❌ Error: $FrontendDir\.env.$DeployEnv not found" -ForegroundColor Red
    Write-Host "Please create the environment file with required variables" -ForegroundColor Yellow
    exit 1
}

# Install dependencies
Write-Host "📦 Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location $FrontendDir
npm ci --production=false

Write-Host "📦 Installing backend dependencies..." -ForegroundColor Yellow
Set-Location "..\$BackendDir"
npm ci --production=false

# Run tests
Write-Host "🧪 Running tests..." -ForegroundColor Yellow
Set-Location "..\$FrontendDir"
npm run test

Set-Location "..\$BackendDir"
npm run test

# Build frontend
Write-Host "🏗️ Building frontend for $DeployEnv..." -ForegroundColor Yellow
Set-Location "..\$FrontendDir"
npm run build

# Create logs directory for backend
Write-Host "📁 Creating logs directory..." -ForegroundColor Yellow
Set-Location "..\$BackendDir"
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs"
}

# Build Docker image
Write-Host "🐳 Building Docker image..." -ForegroundColor Yellow
docker build -t chatbot-backend:latest .

# Stop existing containers
Write-Host "🛑 Stopping existing containers..." -ForegroundColor Yellow
Set-Location ".."
docker-compose down 2>$null

# Start services
Write-Host "🚀 Starting services..." -ForegroundColor Yellow
if ($DeployEnv -eq "production") {
    docker-compose up -d
} else {
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
}

# Wait for services to be ready
Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Health check
Write-Host "🏥 Performing health check..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Backend health check passed" -ForegroundColor Green
    } else {
        throw "Health check returned status code: $($response.StatusCode)"
    }
} catch {
    Write-Host "❌ Backend health check failed" -ForegroundColor Red
    docker-compose logs backend
    exit 1
}

try {
    $response = Invoke-WebRequest -Uri "http://localhost" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Frontend health check passed" -ForegroundColor Green
    } else {
        throw "Health check returned status code: $($response.StatusCode)"
    }
} catch {
    Write-Host "❌ Frontend health check failed" -ForegroundColor Red
    docker-compose logs nginx
    exit 1
}

Write-Host "🎉 Deployment completed successfully!" -ForegroundColor Green
Write-Host "📊 Frontend: http://localhost" -ForegroundColor Cyan
Write-Host "🔧 Backend API: http://localhost:3001" -ForegroundColor Cyan
Write-Host "💓 Health check: http://localhost:3001/health" -ForegroundColor Cyan

# Show running containers
Write-Host "📋 Running containers:" -ForegroundColor Yellow
docker-compose ps