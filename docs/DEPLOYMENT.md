# 🚀 Add-to-Cart Service Deployment Guide

## Overview

This guide covers deploying the Add-to-Cart Service to various environments, from local development to production. The service is designed to be cloud-native and can be deployed using Docker, Kubernetes, or traditional server deployments.

## Prerequisites

- Node.js 18+ and npm/pnpm
- Docker and Docker Compose
- PostgreSQL database
- Redis cache
- Environment variables configured

## Environment Setup

### 1. Environment Variables

Create a `.env` file in the project root:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/addtocart"
DATABASE_HOST="localhost"
DATABASE_PORT="5432"
DATABASE_NAME="addtocart"
DATABASE_USER="username"
DATABASE_PASSWORD="password"

# Redis
REDIS_URL="redis://localhost:6379"
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""

# JWT
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="24h"

# External Services
PRODUCT_SERVICE_URL="http://localhost:3001"
AUTH_SERVICE_URL="http://localhost:3002"
PAYMENT_SERVICE_URL="http://localhost:3003"

# Application
NODE_ENV="development"
PORT="8000"
API_PREFIX="api/v1"

# Monitoring
PROMETHEUS_ENABLED="true"
GRAFANA_ENABLED="true"
LOG_LEVEL="info"

# Email (for notifications)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"

# Webhooks
WEBHOOK_SECRET="your-webhook-secret"
```

### 2. Database Setup

#### Using Docker Compose
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: addtocart
      POSTGRES_USER: username
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

#### Manual Setup
```bash
# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Create database
sudo -u postgres createdb addtocart
sudo -u postgres psql -c "CREATE USER addtocart_user WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE addtocart TO addtocart_user;"

# Install Redis
sudo apt-get install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

## Local Development

### 1. Install Dependencies
```bash
npm install
# or
pnpm install
```

### 2. Database Migration
```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed database (optional)
npx prisma db seed
```

### 3. Start Development Server
```bash
# Development mode with hot reload
npm run start:dev

# Production mode
npm run start:prod
```

### 4. Verify Installation
```bash
# Health check
curl http://localhost:8000/api/v1/health

# API documentation
open http://localhost:8000/api/docs
```

## Docker Deployment

### 1. Dockerfile
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001
USER nestjs

EXPOSE 8000

CMD ["npm", "run", "start:prod"]
```

### 2. Docker Compose
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://username:password@postgres:5432/addtocart
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - ./logs:/app/logs

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: addtocart
      POSTGRES_USER: username
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app

volumes:
  postgres_data:
  redis_data:
```

### 3. Build and Deploy
```bash
# Build image
docker build -t addtocart-service .

# Run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f app

# Scale service
docker-compose up -d --scale app=3
```

## Kubernetes Deployment

### 1. Namespace
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: addtocart
```

### 2. ConfigMap
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: addtocart-config
  namespace: addtocart
data:
  NODE_ENV: "production"
  PORT: "8000"
  API_PREFIX: "api/v1"
  LOG_LEVEL: "info"
```

### 3. Secret
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: addtocart-secrets
  namespace: addtocart
type: Opaque
data:
  DATABASE_URL: <base64-encoded-database-url>
  REDIS_URL: <base64-encoded-redis-url>
  JWT_SECRET: <base64-encoded-jwt-secret>
```

### 4. Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: addtocart-service
  namespace: addtocart
spec:
  replicas: 3
  selector:
    matchLabels:
      app: addtocart-service
  template:
    metadata:
      labels:
        app: addtocart-service
    spec:
      containers:
      - name: addtocart-service
        image: addtocart-service:latest
        ports:
        - containerPort: 8000
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: addtocart-config
              key: NODE_ENV
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: addtocart-secrets
              key: DATABASE_URL
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/v1/health/live
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/v1/health/ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 5. Service
```yaml
apiVersion: v1
kind: Service
metadata:
  name: addtocart-service
  namespace: addtocart
spec:
  selector:
    app: addtocart-service
  ports:
  - port: 80
    targetPort: 8000
  type: ClusterIP
```

### 6. Ingress
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: addtocart-ingress
  namespace: addtocart
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - api.addtocart.com
    secretName: addtocart-tls
  rules:
  - host: api.addtocart.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: addtocart-service
            port:
              number: 80
```

### 7. Horizontal Pod Autoscaler
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: addtocart-hpa
  namespace: addtocart
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: addtocart-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Cloud Deployment

### AWS EKS
```bash
# Create EKS cluster
eksctl create cluster --name addtocart-cluster --region us-west-2 --nodegroup-name workers --node-type t3.medium --nodes 3

# Deploy to EKS
kubectl apply -f k8s/

# Get service URL
kubectl get service addtocart-service
```

### Google GKE
```bash
# Create GKE cluster
gcloud container clusters create addtocart-cluster --zone us-central1-a --num-nodes 3

# Deploy to GKE
kubectl apply -f k8s/

# Get service URL
kubectl get service addtocart-service
```

### Azure AKS
```bash
# Create AKS cluster
az aks create --resource-group addtocart-rg --name addtocart-cluster --node-count 3 --enable-addons monitoring

# Deploy to AKS
kubectl apply -f k8s/

# Get service URL
kubectl get service addtocart-service
```

## Production Considerations

### 1. Database Optimization
```sql
-- Create indexes for better performance
CREATE INDEX idx_cart_user_id ON cart(user_id);
CREATE INDEX idx_cart_session_id ON cart(session_id);
CREATE INDEX idx_cart_item_cart_id ON cart_item(cart_id);
CREATE INDEX idx_cart_item_product_id ON cart_item(product_id);
CREATE INDEX idx_order_user_id ON "order"(user_id);
CREATE INDEX idx_order_status ON "order"(status);
CREATE INDEX idx_order_created_at ON "order"(created_at);
```

### 2. Redis Configuration
```bash
# Redis configuration for production
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### 3. Nginx Configuration
```nginx
upstream addtocart_backend {
    server app:8000;
    keepalive 32;
}

server {
    listen 80;
    server_name api.addtocart.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.addtocart.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    location / {
        proxy_pass http://addtocart_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. Monitoring Setup
```yaml
# Prometheus configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
    scrape_configs:
    - job_name: 'addtocart-service'
      static_configs:
      - targets: ['addtocart-service:8000']
      metrics_path: '/api/v1/metrics'
```

### 5. Logging Configuration
```yaml
# Fluentd configuration for log aggregation
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluentd-config
data:
  fluent.conf: |
    <source>
      @type tail
      path /var/log/containers/*addtocart*.log
      pos_file /var/log/fluentd-containers.log.pos
      tag kubernetes.*
      format json
    </source>
    <match kubernetes.**>
      @type elasticsearch
      host elasticsearch.logging.svc.cluster.local
      port 9200
      index_name addtocart-logs
    </match>
```

## CI/CD Pipeline

### GitHub Actions
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run tests
      run: npm test
      
    - name: Build Docker image
      run: docker build -t addtocart-service:${{ github.sha }} .
      
    - name: Deploy to Kubernetes
      run: |
        echo "${{ secrets.KUBE_CONFIG }}" | base64 -d > kubeconfig
        export KUBECONFIG=kubeconfig
        kubectl set image deployment/addtocart-service addtocart-service=addtocart-service:${{ github.sha }}
        kubectl rollout status deployment/addtocart-service
```

### GitLab CI
```yaml
stages:
  - test
  - build
  - deploy

test:
  stage: test
  script:
    - npm ci
    - npm test
    - npm run test:e2e

build:
  stage: build
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA

deploy:
  stage: deploy
  script:
    - kubectl set image deployment/addtocart-service addtocart-service=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - kubectl rollout status deployment/addtocart-service
  only:
    - main
```

## Backup and Recovery

### Database Backup
```bash
# Create backup
pg_dump -h localhost -U username -d addtocart > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
psql -h localhost -U username -d addtocart < backup_20240101_120000.sql
```

### Redis Backup
```bash
# Create Redis backup
redis-cli BGSAVE

# Copy backup file
cp /var/lib/redis/dump.rdb /backup/redis_$(date +%Y%m%d_%H%M%S).rdb
```

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   ```bash
   # Check database connectivity
   kubectl exec -it deployment/addtocart-service -- npx prisma db pull
   ```

2. **Redis Connection Issues**
   ```bash
   # Test Redis connection
   kubectl exec -it deployment/addtocart-service -- redis-cli ping
   ```

3. **Memory Issues**
   ```bash
   # Check memory usage
   kubectl top pods -l app=addtocart-service
   ```

4. **Performance Issues**
   ```bash
   # Check logs for slow queries
   kubectl logs deployment/addtocart-service | grep "slow query"
   ```

### Health Checks
```bash
# Check service health
curl http://localhost:8000/api/v1/health

# Check detailed health
curl http://localhost:8000/api/v1/health/detailed

# Check metrics
curl http://localhost:8000/api/v1/metrics
```

## Security Considerations

1. **Environment Variables**: Never commit secrets to version control
2. **Network Security**: Use TLS/SSL for all communications
3. **Access Control**: Implement proper authentication and authorization
4. **Rate Limiting**: Configure appropriate rate limits
5. **Monitoring**: Set up security monitoring and alerting
6. **Updates**: Keep dependencies and base images updated

## Performance Tuning

1. **Database**: Optimize queries and add appropriate indexes
2. **Caching**: Configure Redis for optimal performance
3. **Connection Pooling**: Tune database connection pools
4. **Load Balancing**: Use proper load balancing strategies
5. **Monitoring**: Monitor performance metrics and optimize accordingly
