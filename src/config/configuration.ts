export default () => ({
  // Server configuration
  port: parseInt(process.env['PORT'] || '3000', 10),
  nodeEnv: process.env['NODE_ENV'] || 'development',

  // Database configuration
  database: {
    url: process.env['DATABASE_URL'],
  },

  // Redis configuration
  redis: {
    url: process.env['REDIS_URL'] || 'redis://localhost:6379',
  },

  // JWT configuration
  jwt: {
    secret: process.env['JWT_SECRET'] || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env['JWT_EXPIRES_IN'] || '7d',
  },

  // External services
  services: {
    product: {
      url: process.env['PRODUCT_SERVICE_URL'] || 'http://localhost:3001',
    },
    auth: {
      url: process.env['AUTH_SERVICE_URL'] || 'http://localhost:3002',
    },
    order: {
      url: process.env['ORDER_SERVICE_URL'] || 'http://localhost:3003',
    },
  },

  // Session configuration
  session: {
    expiryHours: parseInt(process.env['SESSION_EXPIRY_HOURS'] || '24', 10),
    cartExpiryHours: parseInt(process.env['CART_EXPIRY_HOURS'] || '72', 10),
  },

  // CORS configuration
  cors: {
    origin: process.env['CORS_ORIGIN'] || '*',
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000', 10), // 15 minutes
    max: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100', 10), // limit each IP to 100 requests per windowMs
  },

  // Product service integration
  productService: {
    baseUrl: process.env['PRODUCT_SERVICE_URL'] || 'http://localhost:3002',
    apiKey: process.env['PRODUCT_SERVICE_API_KEY'] || '',
    timeout: parseInt(process.env['PRODUCT_SERVICE_TIMEOUT'] || '5000', 10),
    retryAttempts: parseInt(process.env['PRODUCT_SERVICE_RETRY_ATTEMPTS'] || '3', 10),
    cacheTtl: parseInt(process.env['PRODUCT_CACHE_TTL'] || '300', 10),
  },
});
