# Production Deployment Guide

This guide covers the production deployment of the Chatbot Web MCP application.

## Prerequisites

- Node.js 18+ 
- Docker and Docker Compose
- Git

## Environment Configuration

### 1. Backend Environment Variables

Copy and configure the production environment file:

```bash
cp backend/.env.example backend/.env.production
```

Required variables:
- `MCP_SERVER_URL`: Your MCP server endpoint
- `MCP_API_KEY`: API key for MCP authentication
- `CORS_ORIGIN`: Your frontend domain (e.g., https://yourdomain.com)

### 2. Frontend Environment Variables

Configure the frontend production environment:

```bash
# Edit frontend/.env.production
VITE_API_BASE_URL=https://your-api-domain.com
VITE_WS_URL=wss://your-api-domain.com/ws
```

## Build Process

### 1. Install Dependencies

```bash
# Frontend
cd frontend
npm ci

# Backend
cd ../backend
npm ci
```

### 2. Run Tests

```bash
# Frontend tests
cd frontend
npm run test

# Backend tests
cd ../backend
npm run test
```

### 3. Build Frontend

```bash
cd frontend
npm run build
```

### 4. Verify Build

```bash
cd ..
node scripts/verify-build.js
```

## Deployment Options

### Option 1: Docker Compose (Recommended)

1. **Build and start services:**
   ```bash
   # Using PowerShell (Windows)
   .\deploy.ps1 production
   
   # Using Bash (Linux/Mac)
   ./deploy.sh production
   ```

2. **Manual Docker Compose:**
   ```bash
   docker-compose up -d
   ```

### Option 2: Manual Deployment

1. **Build Docker image:**
   ```bash
   cd backend
   docker build -t chatbot-backend .
   ```

2. **Run backend container:**
   ```bash
   docker run -d \
     --name chatbot-backend \
     -p 3001:3001 \
     --env-file .env.production \
     chatbot-backend
   ```

3. **Serve frontend:**
   ```bash
   # Using nginx, apache, or any static file server
   # Point document root to frontend/dist
   ```

## Production Optimizations

### Frontend Optimizations

- **Code Splitting**: Automatic vendor and utility chunks
- **Asset Optimization**: Minified CSS/JS with content hashing
- **Bundle Analysis**: Run `npm run analyze` to check bundle size
- **Legacy Browser Support**: Automatic polyfills via Vite Legacy plugin

### Backend Optimizations

- **Environment-based Configuration**: Separate configs for dev/prod
- **Docker Multi-stage Build**: Optimized production image
- **Health Checks**: Built-in health monitoring endpoints
- **Graceful Shutdown**: Proper cleanup on termination signals

### Nginx Configuration

The included `nginx.conf` provides:
- Static file serving with caching
- API proxy with rate limiting
- WebSocket proxy support
- Security headers
- Gzip compression

## Monitoring and Health Checks

### Health Check Endpoints

- **Backend Health**: `GET /health`
- **Configuration**: `GET /config` (non-sensitive info only)

### Docker Health Checks

Both Docker and Docker Compose configurations include health checks:

```bash
# Check container health
docker ps
docker-compose ps
```

### Logs

```bash
# View logs
docker-compose logs backend
docker-compose logs nginx

# Follow logs
docker-compose logs -f backend
```

## Security Considerations

### Production Security Features

- **CORS Configuration**: Restricted to specific origins
- **Rate Limiting**: API and WebSocket rate limits
- **Security Headers**: CSP, XSS protection, etc.
- **Non-root Container**: Backend runs as non-privileged user
- **Environment Isolation**: Sensitive data in environment variables

### SSL/TLS Setup

For production, configure SSL certificates:

1. **Update nginx.conf** for HTTPS:
   ```nginx
   server {
       listen 443 ssl http2;
       ssl_certificate /etc/nginx/ssl/cert.pem;
       ssl_certificate_key /etc/nginx/ssl/key.pem;
       # ... rest of configuration
   }
   ```

2. **Mount SSL certificates**:
   ```yaml
   # In docker-compose.yml
   volumes:
     - ./ssl:/etc/nginx/ssl:ro
   ```

## Scaling and Performance

### Horizontal Scaling

To scale the backend:

```bash
docker-compose up -d --scale backend=3
```

### Load Balancing

Update nginx.conf upstream configuration:

```nginx
upstream backend {
    server backend_1:3001;
    server backend_2:3001;
    server backend_3:3001;
}
```

### Database Considerations

For production with persistent data:
- Add Redis for session storage
- Configure database for chat history
- Implement connection pooling

## Troubleshooting

### Common Issues

1. **Build Failures**:
   ```bash
   # Clean and rebuild
   cd frontend && npm run clean && npm run build
   ```

2. **Container Won't Start**:
   ```bash
   # Check logs
   docker-compose logs backend
   
   # Check environment variables
   docker-compose config
   ```

3. **WebSocket Connection Issues**:
   - Verify nginx WebSocket proxy configuration
   - Check CORS settings
   - Ensure proper SSL termination for WSS

4. **MCP Connection Failures**:
   - Verify MCP_SERVER_URL and MCP_API_KEY
   - Check network connectivity
   - Review backend logs for detailed errors

### Performance Issues

1. **High Memory Usage**:
   - Monitor with `docker stats`
   - Check for memory leaks in logs
   - Consider increasing container limits

2. **Slow Response Times**:
   - Enable nginx access logs
   - Monitor MCP response times
   - Check rate limiting settings

## Maintenance

### Updates

1. **Application Updates**:
   ```bash
   git pull
   ./deploy.ps1 production
   ```

2. **Dependency Updates**:
   ```bash
   npm audit fix
   npm update
   ```

### Backup

Important files to backup:
- Environment configuration files
- SSL certificates
- Application logs
- Any persistent data volumes

### Log Rotation

Configure log rotation for production:

```bash
# Add to crontab
0 0 * * * docker-compose exec backend npm run logs:clean
```

## Support

For deployment issues:
1. Check the troubleshooting section above
2. Review application logs
3. Verify environment configuration
4. Test health check endpoints