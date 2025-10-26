# 🔧 Add-to-Cart Service Troubleshooting Guide

## Overview

This guide provides comprehensive troubleshooting information for the Add-to-Cart Service, covering common issues, diagnostic procedures, and resolution steps.

## Quick Diagnostics

### Health Check Commands
```bash
# Basic health check
curl http://localhost:8000/api/v1/health

# Detailed health information
curl http://localhost:8000/api/v1/health/detailed

# System metrics
curl http://localhost:8000/api/v1/health/metrics

# Database connectivity
curl http://localhost:8000/api/v1/health/database

# Redis connectivity
curl http://localhost:8000/api/v1/health/redis
```

### Log Analysis
```bash
# View application logs
kubectl logs deployment/addtocart-service -f

# Filter error logs
kubectl logs deployment/addtocart-service | grep ERROR

# View logs from specific time
kubectl logs deployment/addtocart-service --since=1h

# View logs from all pods
kubectl logs -l app=addtocart-service --all-containers=true
```

## Common Issues & Solutions

### 1. Database Connection Issues

#### Symptoms
- Service fails to start
- Database timeout errors
- Connection pool exhaustion
- "Database connection failed" errors

#### Diagnosis
```bash
# Check database connectivity
kubectl exec -it deployment/addtocart-service -- npx prisma db pull

# Check connection pool status
kubectl exec -it deployment/addtocart-service -- npx prisma studio

# Test database connection
kubectl exec -it deployment/addtocart-service -- node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$connect().then(() => console.log('Connected')).catch(console.error);
"
```

#### Solutions
1. **Check Database URL**
   ```bash
   # Verify environment variables
   kubectl get secret addtocart-secrets -o yaml
   echo $DATABASE_URL
   ```

2. **Check Database Status**
   ```bash
   # PostgreSQL status
   kubectl exec -it postgres-pod -- pg_isready
   
   # Check database exists
   kubectl exec -it postgres-pod -- psql -U username -d addtocart -c "SELECT 1;"
   ```

3. **Connection Pool Configuration**
   ```typescript
   // Update database configuration
   const databaseUrl = process.env.DATABASE_URL + "?connection_limit=20&pool_timeout=20";
   ```

4. **Network Connectivity**
   ```bash
   # Test network connectivity
   kubectl exec -it deployment/addtocart-service -- nslookup postgres-service
   kubectl exec -it deployment/addtocart-service -- telnet postgres-service 5432
   ```

### 2. Redis Connection Issues

#### Symptoms
- Cache operations failing
- "Redis connection failed" errors
- High response times
- Cache miss rate increase

#### Diagnosis
```bash
# Check Redis connectivity
kubectl exec -it deployment/addtocart-service -- redis-cli ping

# Check Redis memory usage
kubectl exec -it deployment/addtocart-service -- redis-cli info memory

# Check Redis configuration
kubectl exec -it deployment/addtocart-service -- redis-cli config get "*"
```

#### Solutions
1. **Redis Service Status**
   ```bash
   # Check Redis pod status
   kubectl get pods -l app=redis
   
   # Check Redis logs
   kubectl logs -l app=redis
   ```

2. **Memory Issues**
   ```bash
   # Check Redis memory usage
   kubectl exec -it redis-pod -- redis-cli info memory | grep used_memory
   
   # Clear Redis cache if needed
   kubectl exec -it redis-pod -- redis-cli flushall
   ```

3. **Configuration Issues**
   ```bash
   # Check Redis configuration
   kubectl exec -it redis-pod -- redis-cli config get maxmemory
   kubectl exec -it redis-pod -- redis-cli config get maxmemory-policy
   ```

### 3. High Memory Usage

#### Symptoms
- Pod eviction due to memory limits
- Out of memory errors
- Slow response times
- Memory leaks

#### Diagnosis
```bash
# Check memory usage
kubectl top pods -l app=addtocart-service

# Check memory limits
kubectl describe pod addtocart-service-pod

# Check memory usage in container
kubectl exec -it deployment/addtocart-service -- free -h
kubectl exec -it deployment/addtocart-service -- ps aux
```

#### Solutions
1. **Increase Memory Limits**
   ```yaml
   resources:
     requests:
       memory: "512Mi"
     limits:
       memory: "1Gi"
   ```

2. **Memory Optimization**
   ```typescript
   // Implement memory optimization
   - Use streaming for large datasets
   - Implement pagination
   - Clear unused variables
   - Use connection pooling
   ```

3. **Garbage Collection Tuning**
   ```bash
   # Set Node.js memory options
   NODE_OPTIONS="--max-old-space-size=1024"
   ```

### 4. Performance Issues

#### Symptoms
- High response times
- Timeout errors
- Slow database queries
- High CPU usage

#### Diagnosis
```bash
# Check response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8000/api/v1/health

# Check CPU usage
kubectl top pods -l app=addtocart-service

# Check slow queries
kubectl logs deployment/addtocart-service | grep "slow query"
```

#### Solutions
1. **Database Optimization**
   ```sql
   -- Check slow queries
   SELECT query, mean_time, calls 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC 
   LIMIT 10;
   
   -- Add missing indexes
   CREATE INDEX idx_cart_user_id ON cart(user_id);
   CREATE INDEX idx_cart_session_id ON cart(session_id);
   ```

2. **Caching Strategy**
   ```typescript
   // Implement caching for expensive operations
   const cachedResult = await redis.get(cacheKey);
   if (cachedResult) {
     return JSON.parse(cachedResult);
   }
   ```

3. **Connection Pooling**
   ```typescript
   // Optimize database connections
   const prisma = new PrismaClient({
     datasources: {
       db: {
         url: process.env.DATABASE_URL + "?connection_limit=20"
       }
     }
   });
   ```

### 5. Authentication Issues

#### Symptoms
- 401 Unauthorized errors
- JWT token validation failures
- Authentication service unavailable
- Token expiration issues

#### Diagnosis
```bash
# Check JWT token
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/v1/health

# Check authentication service
curl http://localhost:8000/api/v1/health/external

# Verify JWT secret
kubectl get secret addtocart-secrets -o jsonpath='{.data.JWT_SECRET}' | base64 -d
```

#### Solutions
1. **JWT Configuration**
   ```bash
   # Verify JWT secret
   kubectl get secret addtocart-secrets -o yaml
   
   # Update JWT secret if needed
   kubectl create secret generic addtocart-secrets --from-literal=JWT_SECRET=new-secret
   ```

2. **Authentication Service**
   ```bash
   # Check auth service connectivity
   kubectl exec -it deployment/addtocart-service -- curl http://auth-service:3002/health
   ```

### 6. External Service Issues

#### Symptoms
- External service timeouts
- Service unavailable errors
- Circuit breaker activation
- High error rates

#### Diagnosis
```bash
# Check external service health
curl http://localhost:8000/api/v1/health/external

# Test service connectivity
kubectl exec -it deployment/addtocart-service -- curl http://product-service:3001/health
kubectl exec -it deployment/addtocart-service -- curl http://auth-service:3002/health
kubectl exec -it deployment/addtocart-service -- curl http://payment-service:3003/health
```

#### Solutions
1. **Service Discovery**
   ```bash
   # Check service endpoints
   kubectl get endpoints
   kubectl get services
   ```

2. **Circuit Breaker Configuration**
   ```typescript
   // Implement circuit breaker
   const circuitBreaker = new CircuitBreaker(externalServiceCall, {
     timeout: 3000,
     errorThresholdPercentage: 50,
     resetTimeout: 30000
   });
   ```

### 7. Load Balancing Issues

#### Symptoms
- Uneven traffic distribution
- Some pods receiving more traffic
- Load balancer health check failures
- Session affinity issues

#### Diagnosis
```bash
# Check pod distribution
kubectl get pods -l app=addtocart-service -o wide

# Check service endpoints
kubectl get endpoints addtocart-service

# Check load balancer configuration
kubectl describe service addtocart-service
```

#### Solutions
1. **Service Configuration**
   ```yaml
   apiVersion: v1
   kind: Service
   metadata:
     name: addtocart-service
   spec:
     selector:
       app: addtocart-service
     ports:
     - port: 80
       targetPort: 8000
     type: ClusterIP
   ```

2. **Load Balancer Health Checks**
   ```yaml
   # Configure health checks
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

## Monitoring & Alerting

### Key Metrics to Monitor

1. **Application Metrics**
   - Request rate (RPS)
   - Response time (latency)
   - Error rate
   - Memory usage
   - CPU usage

2. **Business Metrics**
   - Cart creation rate
   - Cart abandonment rate
   - Checkout conversion rate
   - Average cart value

3. **Infrastructure Metrics**
   - Database connections
   - Cache hit rate
   - Network throughput
   - Disk I/O

### Alerting Rules

```yaml
# Prometheus alerting rules
groups:
- name: addtocart-service
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      
  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High response time detected"
      
  - alert: HighMemoryUsage
    expr: container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.8
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High memory usage detected"
```

### Log Analysis

```bash
# Common log analysis commands
kubectl logs deployment/addtocart-service | grep ERROR | tail -100
kubectl logs deployment/addtocart-service | grep "slow query" | tail -50
kubectl logs deployment/addtocart-service | grep "timeout" | tail -50
kubectl logs deployment/addtocart-service | grep "connection" | tail -50
```

## Performance Tuning

### Database Optimization

1. **Query Optimization**
   ```sql
   -- Analyze slow queries
   EXPLAIN ANALYZE SELECT * FROM cart WHERE user_id = 'user-123';
   
   -- Add missing indexes
   CREATE INDEX CONCURRENTLY idx_cart_user_created ON cart(user_id, created_at);
   
   -- Update table statistics
   ANALYZE cart;
   ```

2. **Connection Pooling**
   ```typescript
   // Optimize connection pool
   const prisma = new PrismaClient({
     datasources: {
       db: {
         url: process.env.DATABASE_URL + "?connection_limit=20&pool_timeout=20"
       }
     }
   });
   ```

### Caching Optimization

1. **Redis Configuration**
   ```bash
   # Optimize Redis memory
   redis-cli config set maxmemory 2gb
   redis-cli config set maxmemory-policy allkeys-lru
   
   # Enable persistence
   redis-cli config set save "900 1 300 10 60 10000"
   ```

2. **Cache Strategy**
   ```typescript
   // Implement cache warming
   const warmCache = async () => {
     const popularProducts = await getPopularProducts();
     await redis.setex('popular_products', 3600, JSON.stringify(popularProducts));
   };
   ```

### Application Optimization

1. **Memory Management**
   ```typescript
   // Implement streaming for large datasets
   const stream = new ReadableStream({
     start(controller) {
       // Stream data instead of loading all at once
     }
   });
   ```

2. **Async Processing**
   ```typescript
   // Use background jobs for heavy operations
   const job = await queue.add('process-cart', { cartId }, {
     delay: 1000,
     attempts: 3
   });
   ```

## Disaster Recovery

### Backup Procedures

1. **Database Backup**
   ```bash
   # Create database backup
   pg_dump -h localhost -U username -d addtocart > backup_$(date +%Y%m%d_%H%M%S).sql
   
   # Restore from backup
   psql -h localhost -U username -d addtocart < backup_20240101_120000.sql
   ```

2. **Redis Backup**
   ```bash
   # Create Redis backup
   redis-cli BGSAVE
   cp /var/lib/redis/dump.rdb /backup/redis_$(date +%Y%m%d_%H%M%S).rdb
   ```

### Recovery Procedures

1. **Service Recovery**
   ```bash
   # Restart service
   kubectl rollout restart deployment/addtocart-service
   
   # Check service status
   kubectl rollout status deployment/addtocart-service
   ```

2. **Data Recovery**
   ```bash
   # Restore from backup
   kubectl exec -it postgres-pod -- psql -U username -d addtocart < backup.sql
   kubectl exec -it redis-pod -- redis-cli --rdb /backup/redis.rdb
   ```

## Security Issues

### Common Security Problems

1. **Authentication Bypass**
   - Check JWT token validation
   - Verify authentication middleware
   - Review access control lists

2. **SQL Injection**
   - Use parameterized queries
   - Validate input data
   - Implement input sanitization

3. **Rate Limiting Bypass**
   - Check rate limiting configuration
   - Verify IP-based limits
   - Review user-based limits

### Security Monitoring

```bash
# Check for security issues
kubectl logs deployment/addtocart-service | grep "security"
kubectl logs deployment/addtocart-service | grep "unauthorized"
kubectl logs deployment/addtocart-service | grep "forbidden"
```

## Support & Escalation

### Internal Support
- **Level 1**: Basic troubleshooting and monitoring
- **Level 2**: Advanced debugging and performance issues
- **Level 3**: Architecture and security issues

### External Support
- **Database**: PostgreSQL support
- **Infrastructure**: Cloud provider support
- **Security**: Security team escalation

### Emergency Contacts
- **On-call Engineer**: +1-555-ONCALL
- **Security Team**: security@company.com
- **Infrastructure Team**: infra@company.com

## FAQ

### Q: Why is my service slow?
A: Check CPU usage, memory usage, database queries, and external service dependencies.

### Q: How do I increase the memory limit?
A: Update the resource limits in the Kubernetes deployment configuration.

### Q: Why am I getting database connection errors?
A: Check database connectivity, connection pool configuration, and network policies.

### Q: How do I clear the Redis cache?
A: Use `redis-cli flushall` or restart the Redis service.

### Q: Why are external service calls failing?
A: Check service discovery, network connectivity, and circuit breaker status.

### Q: How do I enable debug logging?
A: Set the `LOG_LEVEL` environment variable to `debug`.

### Q: How do I check service health?
A: Use the health check endpoints: `/api/v1/health`, `/api/v1/health/detailed`.

### Q: Why is my pod being evicted?
A: Check resource limits, memory usage, and node capacity.

### Q: How do I scale the service?
A: Use `kubectl scale deployment addtocart-service --replicas=5` or configure HPA.

### Q: How do I update the service?
A: Use `kubectl set image deployment/addtocart-service addtocart-service=image:tag`.
