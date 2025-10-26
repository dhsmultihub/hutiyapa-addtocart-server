const http = require('http');

// Test endpoints one by one
const endpoints = [
    { method: 'GET', path: '/api/v1/health', description: 'Health Check' },
    { method: 'GET', path: '/api/v1/health/ready', description: 'Readiness Probe' },
    { method: 'GET', path: '/api/v1/health/live', description: 'Liveness Probe' },
    { method: 'GET', path: '/api/v1/health/detailed', description: 'Detailed Health' },
    { method: 'GET', path: '/api/v1/cart', description: 'Get Cart (requires auth)' },
    { method: 'POST', path: '/api/v1/cart', description: 'Create Cart (requires auth)' },
    { method: 'GET', path: '/api/v1/orders', description: 'Get Orders (requires auth)' },
    { method: 'GET', path: '/api/v1/pricing/discounts', description: 'Get Discounts' },
    { method: 'GET', path: '/api/v1/session', description: 'Get Session (requires auth)' },
];

function testEndpoint(method, path, description) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 8000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-token'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                console.log(`\n${description}:`);
                console.log(`  Status: ${res.statusCode}`);
                console.log(`  Path: ${path}`);
                if (data) {
                    try {
                        const jsonData = JSON.parse(data);
                        console.log(`  Response: ${JSON.stringify(jsonData, null, 2)}`);
                    } catch (e) {
                        console.log(`  Response: ${data}`);
                    }
                }
                resolve({ status: res.statusCode, data });
            });
        });

        req.on('error', (error) => {
            console.log(`\n${description}:`);
            console.log(`  Error: ${error.message}`);
            resolve({ status: 'ERROR', error: error.message });
        });

        if (method === 'POST') {
            req.write(JSON.stringify({
                userId: 'test-user-123',
                sessionId: 'test-session-456'
            }));
        }

        req.end();
    });
}

async function runTests() {
    console.log('🧪 Testing Add-to-Cart Service Endpoints');
    console.log('==========================================');

    for (const endpoint of endpoints) {
        await testEndpoint(endpoint.method, endpoint.path, endpoint.description);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between tests
    }

    console.log('\n✅ Endpoint testing completed!');
}

runTests().catch(console.error);
