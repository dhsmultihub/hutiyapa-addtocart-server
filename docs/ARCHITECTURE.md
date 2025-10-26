# 🏗️ Add-to-Cart Service Architecture

## Overview

The Add-to-Cart Service is a microservice designed to handle shopping cart operations, inventory management, pricing calculations, and checkout preparation. It's built using NestJS framework with a focus on scalability, reliability, and maintainability.

## System Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Application]
        MOBILE[Mobile App]
        API_CLIENT[API Client]
    end
    
    subgraph "API Gateway"
        NGINX[Nginx Load Balancer]
        RATE_LIMIT[Rate Limiting]
        AUTH[Authentication]
    end
    
    subgraph "Add-to-Cart Service"
        CART[Cart Management]
        CHECKOUT[Checkout Process]
        ORDER[Order Management]
        PRICING[Pricing Engine]
        SESSION[Session Management]
        MONITORING[Monitoring & Health]
    end
    
    subgraph "External Services"
        PRODUCT[Product Service]
        AUTH_SVC[Auth Service]
        PAYMENT[Payment Service]
        NOTIFICATION[Notification Service]
    end
    
    subgraph "Data Layer"
        POSTGRES[(PostgreSQL)]
        REDIS[(Redis Cache)]
    end
    
    subgraph "Infrastructure"
        K8S[Kubernetes]
        PROMETHEUS[Prometheus]
        GRAFANA[Grafana]
        ELK[ELK Stack]
    end
    
    WEB --> NGINX
    MOBILE --> NGINX
    API_CLIENT --> NGINX
    
    NGINX --> RATE_LIMIT
    RATE_LIMIT --> AUTH
    AUTH --> CART
    
    CART --> CHECKOUT
    CHECKOUT --> ORDER
    CART --> PRICING
    CART --> SESSION
    
    CART --> PRODUCT
    CHECKOUT --> PAYMENT
    ORDER --> NOTIFICATION
    
    CART --> POSTGRES
    CART --> REDIS
    CHECKOUT --> POSTGRES
    ORDER --> POSTGRES
    PRICING --> REDIS
    
    MONITORING --> PROMETHEUS
    PROMETHEUS --> GRAFANA
    CART --> ELK
```

## Service Components

### 1. Cart Management
- **Purpose**: Core cart operations (create, read, update, delete)
- **Features**: Item management, quantity updates, cart merging
- **Data**: Cart entities, cart items, user sessions

### 2. Checkout Process
- **Purpose**: Handle checkout workflow and order creation
- **Features**: Session management, payment processing, order creation
- **Data**: Checkout sessions, payment intents, order data

### 3. Order Management
- **Purpose**: Manage order lifecycle and status tracking
- **Features**: Order CRUD, status updates, order history
- **Data**: Orders, order items, order statuses

### 4. Pricing Engine
- **Purpose**: Calculate pricing with discounts and taxes
- **Features**: Dynamic pricing, discount application, tax calculation
- **Data**: Pricing rules, discounts, tax rates

### 5. Session Management
- **Purpose**: Handle user sessions and cart persistence
- **Features**: Session creation, device sync, cart backup
- **Data**: User sessions, device information, cart snapshots

### 6. Monitoring & Health
- **Purpose**: System monitoring and observability
- **Features**: Health checks, metrics collection, alerting
- **Data**: Health status, performance metrics, alerts

## Data Architecture

### Database Schema

```mermaid
erDiagram
    Cart ||--o{ CartItem : contains
    Cart ||--o{ CheckoutSession : has
    CheckoutSession ||--|| Order : creates
    Order ||--o{ OrderItem : contains
    User ||--o{ Cart : owns
    User ||--o{ Session : has
    Session ||--o{ Cart : manages
    
    Cart {
        string id PK
        string userId FK
        string sessionId FK
        datetime createdAt
        datetime updatedAt
    }
    
    CartItem {
        string id PK
        string cartId FK
        string productId
        string variantId
        int quantity
        decimal price
        datetime createdAt
        datetime updatedAt
    }
    
    CheckoutSession {
        string id PK
        string cartId FK
        string userId FK
        string status
        json shippingAddress
        json billingAddress
        datetime expiresAt
        datetime createdAt
    }
    
    Order {
        string id PK
        string orderNumber
        string userId FK
        string status
        decimal total
        json shippingAddress
        json billingAddress
        datetime createdAt
        datetime updatedAt
    }
    
    OrderItem {
        string id PK
        string orderId FK
        string productId
        string variantId
        int quantity
        decimal unitPrice
        decimal totalPrice
    }
    
    User {
        string id PK
        string email
        string firstName
        string lastName
        datetime createdAt
    }
    
    Session {
        string id PK
        string userId FK
        string token
        json deviceInfo
        datetime expiresAt
        datetime createdAt
    }
```

### Caching Strategy

```mermaid
graph LR
    subgraph "Cache Layers"
        L1[L1: In-Memory Cache]
        L2[L2: Redis Cache]
        L3[L3: Database Cache]
    end
    
    subgraph "Cache Types"
        CART_CACHE[Cart Data]
        PRICING_CACHE[Pricing Data]
        SESSION_CACHE[Session Data]
        PRODUCT_CACHE[Product Data]
    end
    
    L1 --> L2
    L2 --> L3
    
    CART_CACHE --> L1
    PRICING_CACHE --> L2
    SESSION_CACHE --> L2
    PRODUCT_CACHE --> L2
```

## API Design

### RESTful API Structure

```
/api/v1/
├── cart/                    # Cart management
│   ├── POST /               # Create cart
│   ├── GET /{id}            # Get cart
│   ├── PATCH /{id}          # Update cart
│   ├── DELETE /{id}         # Delete cart
│   ├── POST /{id}/items     # Add item
│   ├── PATCH /{id}/items/{itemId}  # Update item
│   ├── DELETE /{id}/items/{itemId} # Remove item
│   └── GET /{id}/totals     # Get totals
├── checkout/                # Checkout process
│   ├── POST /session        # Create session
│   ├── GET /session/{id}    # Get session
│   └── POST /process        # Process checkout
├── orders/                  # Order management
│   ├── GET /                # List orders
│   ├── GET /{id}            # Get order
│   ├── PATCH /{id}          # Update order
│   └── DELETE /{id}         # Cancel order
├── pricing/                 # Pricing engine
│   ├── POST /calculate      # Calculate pricing
│   ├── GET /discounts       # Get discounts
│   └── GET /tax-rates       # Get tax rates
├── session/                 # Session management
│   ├── POST /               # Create session
│   ├── GET /{id}            # Get session
│   ├── PATCH /{id}          # Update session
│   └── DELETE /{id}         # Delete session
└── health/                  # Health monitoring
    ├── GET /                # Health status
    ├── GET /detailed        # Detailed health
    └── GET /metrics         # Metrics
```

## Security Architecture

### Authentication & Authorization

```mermaid
sequenceDiagram
    participant Client
    participant API Gateway
    participant Auth Service
    participant Cart Service
    participant Database
    
    Client->>API Gateway: Request with JWT
    API Gateway->>Auth Service: Validate JWT
    Auth Service-->>API Gateway: User info
    API Gateway->>Cart Service: Authorized request
    Cart Service->>Database: Query with user context
    Database-->>Cart Service: Data
    Cart Service-->>API Gateway: Response
    API Gateway-->>Client: Response
```

### Security Layers

1. **API Gateway Security**
   - Rate limiting
   - Request validation
   - CORS configuration
   - SSL/TLS termination

2. **Application Security**
   - JWT token validation
   - Input sanitization
   - SQL injection prevention
   - XSS protection

3. **Data Security**
   - Encryption at rest
   - Encryption in transit
   - Access control
   - Audit logging

## Scalability Design

### Horizontal Scaling

```mermaid
graph TB
    subgraph "Load Balancer"
        LB[Load Balancer]
    end
    
    subgraph "Service Instances"
        S1[Service Instance 1]
        S2[Service Instance 2]
        S3[Service Instance 3]
        SN[Service Instance N]
    end
    
    subgraph "Database Cluster"
        DB1[Primary DB]
        DB2[Read Replica 1]
        DB3[Read Replica 2]
    end
    
    subgraph "Cache Cluster"
        R1[Redis Master]
        R2[Redis Replica 1]
        R3[Redis Replica 2]
    end
    
    LB --> S1
    LB --> S2
    LB --> S3
    LB --> SN
    
    S1 --> DB1
    S2 --> DB2
    S3 --> DB3
    
    S1 --> R1
    S2 --> R2
    S3 --> R3
```

### Auto-scaling Strategy

1. **CPU-based Scaling**: Scale based on CPU utilization
2. **Memory-based Scaling**: Scale based on memory usage
3. **Request-based Scaling**: Scale based on request rate
4. **Custom Metrics**: Scale based on business metrics

## Monitoring & Observability

### Monitoring Stack

```mermaid
graph TB
    subgraph "Application"
        APP[Add-to-Cart Service]
    end
    
    subgraph "Metrics Collection"
        PROMETHEUS[Prometheus]
        GRAFANA[Grafana]
    end
    
    subgraph "Logging"
        FLUENTD[Fluentd]
        ELASTICSEARCH[Elasticsearch]
        KIBANA[Kibana]
    end
    
    subgraph "Tracing"
        JAEGER[Jaeger]
        ZIPKIN[Zipkin]
    end
    
    subgraph "Alerting"
        ALERTMANAGER[AlertManager]
        SLACK[Slack]
        EMAIL[Email]
    end
    
    APP --> PROMETHEUS
    APP --> FLUENTD
    APP --> JAEGER
    
    PROMETHEUS --> GRAFANA
    PROMETHEUS --> ALERTMANAGER
    
    FLUENTD --> ELASTICSEARCH
    ELASTICSEARCH --> KIBANA
    
    ALERTMANAGER --> SLACK
    ALERTMANAGER --> EMAIL
```

### Key Metrics

1. **Business Metrics**
   - Cart creation rate
   - Cart abandonment rate
   - Checkout conversion rate
   - Average cart value

2. **Technical Metrics**
   - Request rate (RPS)
   - Response time (latency)
   - Error rate
   - CPU/Memory usage

3. **Infrastructure Metrics**
   - Database connections
   - Cache hit rate
   - Network throughput
   - Disk I/O

## Performance Optimization

### Database Optimization

1. **Indexing Strategy**
   ```sql
   -- Primary indexes
   CREATE INDEX idx_cart_user_id ON cart(user_id);
   CREATE INDEX idx_cart_session_id ON cart(session_id);
   CREATE INDEX idx_cart_item_cart_id ON cart_item(cart_id);
   
   -- Composite indexes
   CREATE INDEX idx_cart_user_created ON cart(user_id, created_at);
   CREATE INDEX idx_order_user_status ON "order"(user_id, status);
   ```

2. **Query Optimization**
   - Use prepared statements
   - Implement connection pooling
   - Optimize N+1 queries
   - Use database views for complex queries

### Caching Strategy

1. **Multi-level Caching**
   - L1: In-memory cache (application level)
   - L2: Redis cache (distributed cache)
   - L3: Database cache (query result cache)

2. **Cache Invalidation**
   - Time-based expiration
   - Event-based invalidation
   - Manual cache clearing

### Performance Patterns

1. **Async Processing**
   - Background jobs for heavy operations
   - Event-driven architecture
   - Message queues for decoupling

2. **Connection Pooling**
   - Database connection pooling
   - HTTP connection pooling
   - Redis connection pooling

## Error Handling & Resilience

### Error Handling Strategy

```mermaid
graph TB
    subgraph "Error Types"
        VALIDATION[Validation Errors]
        BUSINESS[Business Logic Errors]
        EXTERNAL[External Service Errors]
        SYSTEM[System Errors]
    end
    
    subgraph "Error Handling"
        TRY_CATCH[Try-Catch Blocks]
        GLOBAL_FILTER[Global Exception Filter]
        RETRY[Retry Logic]
        CIRCUIT_BREAKER[Circuit Breaker]
    end
    
    subgraph "Error Response"
        LOGGING[Error Logging]
        METRICS[Error Metrics]
        ALERTING[Error Alerting]
        USER_RESPONSE[User Response]
    end
    
    VALIDATION --> TRY_CATCH
    BUSINESS --> TRY_CATCH
    EXTERNAL --> RETRY
    SYSTEM --> CIRCUIT_BREAKER
    
    TRY_CATCH --> LOGGING
    RETRY --> METRICS
    CIRCUIT_BREAKER --> ALERTING
    
    LOGGING --> USER_RESPONSE
    METRICS --> USER_RESPONSE
    ALERTING --> USER_RESPONSE
```

### Resilience Patterns

1. **Circuit Breaker**: Prevent cascade failures
2. **Retry Logic**: Handle transient failures
3. **Timeout**: Prevent hanging requests
4. **Bulkhead**: Isolate critical resources
5. **Graceful Degradation**: Maintain service availability

## Deployment Architecture

### Container Strategy

```mermaid
graph TB
    subgraph "Kubernetes Cluster"
        subgraph "Namespace: addtocart"
            DEPLOYMENT[Deployment]
            SERVICE[Service]
            INGRESS[Ingress]
            HPA[HPA]
            PDB[PodDisruptionBudget]
        end
        
        subgraph "Namespace: monitoring"
            PROMETHEUS[Prometheus]
            GRAFANA[Grafana]
            ALERTMANAGER[AlertManager]
        end
        
        subgraph "Namespace: logging"
            FLUENTD[Fluentd]
            ELASTICSEARCH[Elasticsearch]
            KIBANA[Kibana]
        end
    end
    
    subgraph "External Services"
        RDS[RDS PostgreSQL]
        ELASTICACHE[ElastiCache Redis]
        S3[S3 Storage]
    end
    
    DEPLOYMENT --> SERVICE
    SERVICE --> INGRESS
    HPA --> DEPLOYMENT
    PDB --> DEPLOYMENT
    
    DEPLOYMENT --> RDS
    DEPLOYMENT --> ELASTICACHE
    DEPLOYMENT --> S3
```

### CI/CD Pipeline

```mermaid
graph LR
    subgraph "Source Control"
        GIT[Git Repository]
    end
    
    subgraph "CI/CD Pipeline"
        BUILD[Build & Test]
        SECURITY[Security Scan]
        PACKAGE[Package]
        DEPLOY[Deploy]
    end
    
    subgraph "Environments"
        DEV[Development]
        STAGING[Staging]
        PROD[Production]
    end
    
    GIT --> BUILD
    BUILD --> SECURITY
    SECURITY --> PACKAGE
    PACKAGE --> DEPLOY
    
    DEPLOY --> DEV
    DEPLOY --> STAGING
    DEPLOY --> PROD
```

## Technology Stack

### Core Technologies
- **Framework**: NestJS (Node.js)
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **Message Queue**: Redis Pub/Sub
- **Container**: Docker
- **Orchestration**: Kubernetes

### Monitoring & Observability
- **Metrics**: Prometheus + Grafana
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **Tracing**: Jaeger
- **Alerting**: AlertManager

### Infrastructure
- **Cloud**: AWS/GCP/Azure
- **CDN**: CloudFront/CloudFlare
- **Load Balancer**: Nginx/HAProxy
- **SSL**: Let's Encrypt

## Design Principles

### 1. Microservices Architecture
- Single responsibility principle
- Loose coupling
- High cohesion
- Independent deployment

### 2. Domain-Driven Design
- Clear domain boundaries
- Rich domain models
- Ubiquitous language
- Bounded contexts

### 3. Event-Driven Architecture
- Asynchronous communication
- Event sourcing
- CQRS pattern
- Saga pattern

### 4. API-First Design
- RESTful APIs
- OpenAPI specification
- Versioning strategy
- Documentation-driven development

### 5. Security by Design
- Defense in depth
- Zero trust architecture
- Security automation
- Continuous security testing

## Future Considerations

### Scalability Improvements
1. **Database Sharding**: Horizontal database scaling
2. **Event Streaming**: Apache Kafka for event processing
3. **CQRS**: Command Query Responsibility Segregation
4. **Event Sourcing**: Event-driven data storage

### Technology Evolution
1. **GraphQL**: Alternative to REST APIs
2. **gRPC**: High-performance RPC framework
3. **Service Mesh**: Istio for service communication
4. **Serverless**: Function-as-a-Service integration

### Performance Enhancements
1. **CDN Integration**: Global content delivery
2. **Edge Computing**: Reduce latency
3. **Machine Learning**: Predictive caching
4. **Real-time Analytics**: Stream processing
