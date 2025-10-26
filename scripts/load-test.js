const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');

class LoadTester {
    constructor(config) {
        this.config = {
            baseUrl: 'http://localhost:8000',
            concurrentUsers: 100,
            requestsPerUser: 10,
            rampUpTime: 30, // seconds
            testDuration: 300, // seconds
            ...config
        };

        this.results = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            responseTimes: [],
            errors: [],
            startTime: null,
            endTime: null
        };
    }

    async runLoadTest() {
        console.log('🚀 Starting Load Test...');
        console.log(`Configuration:`, this.config);

        this.results.startTime = performance.now();

        const promises = [];
        const rampUpDelay = (this.config.rampUpTime * 1000) / this.config.concurrentUsers;

        for (let i = 0; i < this.config.concurrentUsers; i++) {
            const delay = i * rampUpDelay;
            promises.push(this.simulateUser(i, delay));
        }

        await Promise.all(promises);

        this.results.endTime = performance.now();
        this.generateReport();
    }

    async simulateUser(userId, delay) {
        await this.sleep(delay);

        const userResults = {
            userId,
            requests: [],
            errors: []
        };

        for (let i = 0; i < this.config.requestsPerUser; i++) {
            try {
                const requestResult = await this.executeUserWorkflow(userId, i);
                userResults.requests.push(requestResult);
                this.results.totalRequests++;

                if (requestResult.success) {
                    this.results.successfulRequests++;
                } else {
                    this.results.failedRequests++;
                }

                this.results.responseTimes.push(requestResult.responseTime);

            } catch (error) {
                this.results.failedRequests++;
                this.results.errors.push({
                    userId,
                    request: i,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }

            // Random delay between requests (100-500ms)
            await this.sleep(Math.random() * 400 + 100);
        }

        return userResults;
    }

    async executeUserWorkflow(userId, requestId) {
        const startTime = performance.now();
        const sessionId = `session-${userId}-${requestId}`;

        try {
            // 1. Create cart
            const cart = await this.makeRequest('POST', '/api/v1/cart', {
                userId: `user-${userId}`,
                sessionId: sessionId
            });

            if (!cart.success) {
                return { success: false, responseTime: performance.now() - startTime, error: 'Cart creation failed' };
            }

            const cartId = cart.data.id;

            // 2. Add items to cart (1-3 items)
            const itemCount = Math.floor(Math.random() * 3) + 1;
            for (let i = 0; i < itemCount; i++) {
                const addItemResult = await this.makeRequest('POST', `/api/v1/cart/${cartId}/items`, {
                    productId: `product-${userId}-${requestId}-${i}`,
                    variantId: `variant-${userId}-${requestId}-${i}`,
                    quantity: Math.floor(Math.random() * 5) + 1,
                    price: Math.random() * 100 + 10
                });

                if (!addItemResult.success) {
                    return { success: false, responseTime: performance.now() - startTime, error: 'Add item failed' };
                }
            }

            // 3. Get cart totals
            const totalsResult = await this.makeRequest('GET', `/api/v1/cart/${cartId}/totals`);

            if (!totalsResult.success) {
                return { success: false, responseTime: performance.now() - startTime, error: 'Get totals failed' };
            }

            // 4. Update item (50% chance)
            if (Math.random() > 0.5) {
                const updateResult = await this.makeRequest('PATCH', `/api/v1/cart/${cartId}/items/${cart.data.items[0]?.id}`, {
                    quantity: Math.floor(Math.random() * 5) + 1
                });

                if (!updateResult.success) {
                    return { success: false, responseTime: performance.now() - startTime, error: 'Update item failed' };
                }
            }

            // 5. Create checkout session (30% chance)
            if (Math.random() > 0.7) {
                const checkoutResult = await this.makeRequest('POST', '/api/v1/checkout/session', {
                    cartId: cartId,
                    userId: `user-${userId}`
                });

                if (!checkoutResult.success) {
                    return { success: false, responseTime: performance.now() - startTime, error: 'Checkout session failed' };
                }
            }

            const responseTime = performance.now() - startTime;
            return { success: true, responseTime, cartId };

        } catch (error) {
            return { success: false, responseTime: performance.now() - startTime, error: error.message };
        }
    }

    async makeRequest(method, path, data = null) {
        return new Promise((resolve) => {
            const url = new URL(this.config.baseUrl + path);
            const options = {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname + url.search,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'LoadTester/1.0'
                }
            };

            const req = (url.protocol === 'https:' ? https : http).request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        const parsedData = JSON.parse(responseData);
                        resolve({
                            success: res.statusCode >= 200 && res.statusCode < 300,
                            statusCode: res.statusCode,
                            data: parsedData
                        });
                    } catch (error) {
                        resolve({
                            success: false,
                            statusCode: res.statusCode,
                            data: responseData,
                            error: 'JSON parse error'
                        });
                    }
                });
            });

            req.on('error', (error) => {
                resolve({
                    success: false,
                    error: error.message
                });
            });

            req.setTimeout(10000, () => {
                req.destroy();
                resolve({
                    success: false,
                    error: 'Request timeout'
                });
            });

            if (data) {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }

    generateReport() {
        const duration = (this.results.endTime - this.results.startTime) / 1000;
        const successRate = (this.results.successfulRequests / this.results.totalRequests) * 100;
        const avgResponseTime = this.results.responseTimes.reduce((a, b) => a + b, 0) / this.results.responseTimes.length;
        const minResponseTime = Math.min(...this.results.responseTimes);
        const maxResponseTime = Math.max(...this.results.responseTimes);

        // Calculate percentiles
        const sortedResponseTimes = this.results.responseTimes.sort((a, b) => a - b);
        const p50 = sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.5)];
        const p90 = sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.9)];
        const p95 = sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.95)];
        const p99 = sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.99)];

        const requestsPerSecond = this.results.totalRequests / duration;

        console.log('\n📊 Load Test Results');
        console.log('==================');
        console.log(`Duration: ${duration.toFixed(2)}s`);
        console.log(`Total Requests: ${this.results.totalRequests}`);
        console.log(`Successful Requests: ${this.results.successfulRequests}`);
        console.log(`Failed Requests: ${this.results.failedRequests}`);
        console.log(`Success Rate: ${successRate.toFixed(2)}%`);
        console.log(`Requests/Second: ${requestsPerSecond.toFixed(2)}`);
        console.log(`\nResponse Times:`);
        console.log(`  Average: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`  Min: ${minResponseTime.toFixed(2)}ms`);
        console.log(`  Max: ${maxResponseTime.toFixed(2)}ms`);
        console.log(`  P50: ${p50.toFixed(2)}ms`);
        console.log(`  P90: ${p90.toFixed(2)}ms`);
        console.log(`  P95: ${p95.toFixed(2)}ms`);
        console.log(`  P99: ${p99.toFixed(2)}ms`);

        if (this.results.errors.length > 0) {
            console.log(`\nErrors (${this.results.errors.length}):`);
            const errorSummary = {};
            this.results.errors.forEach(error => {
                errorSummary[error.error] = (errorSummary[error.error] || 0) + 1;
            });

            Object.entries(errorSummary).forEach(([error, count]) => {
                console.log(`  ${error}: ${count}`);
            });
        }

        // Performance recommendations
        console.log('\n🎯 Performance Recommendations:');
        if (successRate < 95) {
            console.log('⚠️  Success rate is below 95%. Consider optimizing error handling.');
        }
        if (p95 > 2000) {
            console.log('⚠️  P95 response time is above 2s. Consider performance optimization.');
        }
        if (requestsPerSecond < 100) {
            console.log('⚠️  Throughput is below 100 req/s. Consider scaling or optimization.');
        }
        if (successRate >= 95 && p95 < 1000 && requestsPerSecond >= 100) {
            console.log('✅ Performance looks good!');
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Test configurations
const testConfigs = {
    light: {
        concurrentUsers: 10,
        requestsPerUser: 5,
        rampUpTime: 5,
        testDuration: 60
    },
    medium: {
        concurrentUsers: 50,
        requestsPerUser: 10,
        rampUpTime: 15,
        testDuration: 180
    },
    heavy: {
        concurrentUsers: 100,
        requestsPerUser: 20,
        rampUpTime: 30,
        testDuration: 300
    },
    stress: {
        concurrentUsers: 200,
        requestsPerUser: 30,
        rampUpTime: 60,
        testDuration: 600
    }
};

// Run load test
async function runLoadTest() {
    const testType = process.argv[2] || 'medium';
    const config = testConfigs[testType];

    if (!config) {
        console.error('Invalid test type. Available: light, medium, heavy, stress');
        process.exit(1);
    }

    console.log(`Running ${testType} load test...`);

    const loadTester = new LoadTester({
        ...config,
        baseUrl: process.env.BASE_URL || 'http://localhost:8000'
    });

    try {
        await loadTester.runLoadTest();
    } catch (error) {
        console.error('Load test failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    runLoadTest();
}

module.exports = { LoadTester };
