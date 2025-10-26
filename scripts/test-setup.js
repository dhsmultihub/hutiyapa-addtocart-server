const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class TestSetup {
    constructor() {
        this.projectRoot = process.cwd();
        this.testEnv = {
            NODE_ENV: 'test',
            DATABASE_URL: 'postgresql://test:test@localhost:5432/addtocart_test',
            REDIS_URL: 'redis://localhost:6379/1',
            JWT_SECRET: 'test-jwt-secret',
            PORT: '8001'
        };
    }

    async setupTestEnvironment() {
        console.log('🧪 Setting up test environment...');

        try {
            await this.checkPrerequisites();
            await this.setupTestDatabase();
            await this.setupTestRedis();
            await this.installDependencies();
            await this.runMigrations();
            await this.seedTestData();
            await this.setupTestConfig();

            console.log('✅ Test environment setup completed successfully!');
            console.log('\n📋 Test Commands:');
            console.log('  npm run test          # Run unit tests');
            console.log('  npm run test:e2e      # Run e2e tests');
            console.log('  npm run test:load    # Run load tests');
            console.log('  npm run test:coverage # Run tests with coverage');

        } catch (error) {
            console.error('❌ Test environment setup failed:', error.message);
            process.exit(1);
        }
    }

    async checkPrerequisites() {
        console.log('🔍 Checking prerequisites...');

        const requiredCommands = ['node', 'npm', 'docker', 'docker-compose'];

        for (const cmd of requiredCommands) {
            try {
                execSync(`which ${cmd}`, { stdio: 'ignore' });
                console.log(`  ✅ ${cmd} is available`);
            } catch (error) {
                throw new Error(`${cmd} is not installed or not in PATH`);
            }
        }
    }

    async setupTestDatabase() {
        console.log('🗄️  Setting up test database...');

        try {
            // Check if PostgreSQL is running
            execSync('pg_isready -h localhost -p 5432', { stdio: 'ignore' });
            console.log('  ✅ PostgreSQL is running');
        } catch (error) {
            console.log('  ⚠️  PostgreSQL not running, starting with Docker...');

            // Start PostgreSQL with Docker
            execSync('docker run -d --name postgres-test -e POSTGRES_DB=addtocart_test -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -p 5432:5432 postgres:15', { stdio: 'inherit' });

            // Wait for PostgreSQL to be ready
            await this.waitForService('localhost', 5432, 30);
            console.log('  ✅ PostgreSQL is ready');
        }

        // Create test database if it doesn't exist
        try {
            execSync(`psql -h localhost -U test -d postgres -c "CREATE DATABASE addtocart_test;"`, { stdio: 'ignore' });
            console.log('  ✅ Test database created');
        } catch (error) {
            // Database might already exist, which is fine
            console.log('  ℹ️  Test database already exists');
        }
    }

    async setupTestRedis() {
        console.log('🔴 Setting up test Redis...');

        try {
            // Check if Redis is running
            execSync('redis-cli ping', { stdio: 'ignore' });
            console.log('  ✅ Redis is running');
        } catch (error) {
            console.log('  ⚠️  Redis not running, starting with Docker...');

            // Start Redis with Docker
            execSync('docker run -d --name redis-test -p 6379:6379 redis:7-alpine', { stdio: 'inherit' });

            // Wait for Redis to be ready
            await this.waitForService('localhost', 6379, 10);
            console.log('  ✅ Redis is ready');
        }
    }

    async installDependencies() {
        console.log('📦 Installing dependencies...');

        try {
            execSync('npm install', { stdio: 'inherit' });
            console.log('  ✅ Dependencies installed');
        } catch (error) {
            throw new Error('Failed to install dependencies');
        }
    }

    async runMigrations() {
        console.log('🔄 Running database migrations...');

        try {
            // Set test environment variables
            const env = { ...process.env, ...this.testEnv };

            execSync('npx prisma generate', {
                stdio: 'inherit',
                env: env
            });

            execSync('npx prisma migrate deploy', {
                stdio: 'inherit',
                env: env
            });

            console.log('  ✅ Database migrations completed');
        } catch (error) {
            throw new Error('Failed to run database migrations');
        }
    }

    async seedTestData() {
        console.log('🌱 Seeding test data...');

        try {
            // Create test data
            const testData = {
                users: [
                    { id: 'user-1', email: 'test1@example.com', firstName: 'John', lastName: 'Doe' },
                    { id: 'user-2', email: 'test2@example.com', firstName: 'Jane', lastName: 'Smith' }
                ],
                products: [
                    { id: 'product-1', name: 'Test Product 1', price: 29.99, stock: 100 },
                    { id: 'product-2', name: 'Test Product 2', price: 49.99, stock: 50 }
                ],
                carts: [
                    { id: 'cart-1', userId: 'user-1', sessionId: 'session-1' },
                    { id: 'cart-2', userId: 'user-2', sessionId: 'session-2' }
                ]
            };

            // Write test data to file
            fs.writeFileSync(
                path.join(this.projectRoot, 'test', 'fixtures', 'test-data.json'),
                JSON.stringify(testData, null, 2)
            );

            console.log('  ✅ Test data seeded');
        } catch (error) {
            console.log('  ⚠️  Test data seeding failed, but tests can still run');
        }
    }

    async setupTestConfig() {
        console.log('⚙️  Setting up test configuration...');

        // Create test environment file
        const testEnvContent = Object.entries(this.testEnv)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        fs.writeFileSync(
            path.join(this.projectRoot, '.env.test'),
            testEnvContent
        );

        // Create test configuration
        const testConfig = {
            test: {
                database: {
                    url: this.testEnv.DATABASE_URL,
                    pool: {
                        min: 2,
                        max: 10
                    }
                },
                redis: {
                    url: this.testEnv.REDIS_URL,
                    db: 1
                },
                jwt: {
                    secret: this.testEnv.JWT_SECRET,
                    expiresIn: '1h'
                }
            }
        };

        fs.writeFileSync(
            path.join(this.projectRoot, 'test', 'config', 'test-config.json'),
            JSON.stringify(testConfig, null, 2)
        );

        console.log('  ✅ Test configuration created');
    }

    async waitForService(host, port, timeoutSeconds) {
        const startTime = Date.now();
        const timeout = timeoutSeconds * 1000;

        while (Date.now() - startTime < timeout) {
            try {
                const net = require('net');
                const socket = new net.Socket();

                await new Promise((resolve, reject) => {
                    socket.setTimeout(1000);
                    socket.on('connect', () => {
                        socket.destroy();
                        resolve();
                    });
                    socket.on('error', reject);
                    socket.on('timeout', () => reject(new Error('Connection timeout')));
                    socket.connect(port, host);
                });

                return;
            } catch (error) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        throw new Error(`Service at ${host}:${port} not ready after ${timeoutSeconds} seconds`);
    }

    async cleanup() {
        console.log('🧹 Cleaning up test environment...');

        try {
            // Stop Docker containers
            try {
                execSync('docker stop postgres-test redis-test', { stdio: 'ignore' });
                execSync('docker rm postgres-test redis-test', { stdio: 'ignore' });
                console.log('  ✅ Docker containers stopped');
            } catch (error) {
                // Containers might not exist, which is fine
            }

            // Remove test files
            const testFiles = ['.env.test', 'test/config/test-config.json'];
            testFiles.forEach(file => {
                const filePath = path.join(this.projectRoot, file);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            });

            console.log('  ✅ Test environment cleaned up');
        } catch (error) {
            console.log('  ⚠️  Cleanup failed, but this is not critical');
        }
    }
}

// CLI interface
if (require.main === module) {
    const setup = new TestSetup();

    const command = process.argv[2];

    switch (command) {
        case 'setup':
            setup.setupTestEnvironment();
            break;
        case 'cleanup':
            setup.cleanup();
            break;
        case 'reset':
            setup.cleanup().then(() => setup.setupTestEnvironment());
            break;
        default:
            console.log('Usage: node test-setup.js [setup|cleanup|reset]');
            console.log('  setup  - Set up test environment');
            console.log('  cleanup - Clean up test environment');
            console.log('  reset  - Reset test environment');
            process.exit(1);
    }
}

module.exports = TestSetup;
