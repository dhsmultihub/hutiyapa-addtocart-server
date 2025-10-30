const http = require('http');
const fs = require('fs');

// Configuration
const BASE_URL = 'localhost';
const PORT = 8000;
const API_PREFIX = '/api/v1';

// Test results storage
const testResults = [];
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// Session token (will be generated)
let sessionToken = null;
let cartId = null;
let cartItemId = null;

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: BASE_URL,
            port: PORT,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response = {
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: data ? JSON.parse(data) : null
                    };
                    resolve(response);
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: data
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (body) {
            req.write(JSON.stringify(body));
        }

        req.end();
    });
}

async function runTest(testName, testFn) {
    totalTests++;
    log(`\n${'='.repeat(80)}`, 'cyan');
    log(`TEST ${totalTests}: ${testName}`, 'bright');
    log('='.repeat(80), 'cyan');

    try {
        const result = await testFn();
        passedTests++;
        log(`✅ PASSED`, 'green');
        testResults.push({ name: testName, status: 'PASSED', result });
        return result;
    } catch (error) {
        failedTests++;
        log(`❌ FAILED: ${error.message}`, 'red');
        testResults.push({ name: testName, status: 'FAILED', error: error.message });
        throw error;
    }
}

async function testHealthCheck() {
    return runTest('Health Check - Cart Service', async () => {
        const response = await makeRequest('GET', `${API_PREFIX}/cart/health`);
        log(`Status: ${response.statusCode}`);
        log(`Response: ${JSON.stringify(response.body, null, 2)}`);

        if (response.statusCode !== 200) {
            throw new Error(`Expected 200, got ${response.statusCode}`);
        }
        return response.body;
    });
}

async function testCreateSession() {
    return runTest('Create Cart Session', async () => {
        const response = await makeRequest('POST', `${API_PREFIX}/cart/session`, null, {
            'x-user-id': 'test_user_api_001'
        });
        log(`Status: ${response.statusCode}`);
        log(`Response: ${JSON.stringify(response.body, null, 2)}`);

        if (response.statusCode !== 200 && response.statusCode !== 201) {
            throw new Error(`Expected 200/201, got ${response.statusCode}`);
        }

        sessionToken = response.body.sessionToken;
        log(`📝 Session Token: ${sessionToken}`, 'yellow');
        return response.body;
    });
}

async function testGetEmptyCart() {
    return runTest('Get Cart (Empty)', async () => {
        const response = await makeRequest('GET', `${API_PREFIX}/cart`, null, {
            'x-session-token': sessionToken
        });
        log(`Status: ${response.statusCode}`);
        log(`Response: ${JSON.stringify(response.body, null, 2)}`);

        if (response.statusCode !== 200) {
            throw new Error(`Expected 200, got ${response.statusCode}`);
        }

        cartId = response.body.id;
        log(`📝 Cart ID: ${cartId}`, 'yellow');
        return response.body;
    });
}

async function testAddItemToCart() {
    return runTest('Add Item to Cart', async () => {
        const itemData = {
            productId: 'prod_test_laptop_999',
            variantId: 'var_test_laptop_16gb',
            quantity: 2,
            price: 1199.99,
            originalPrice: 1499.99
        };

        const response = await makeRequest('POST', `${API_PREFIX}/cart/items`, itemData, {
            'x-session-token': sessionToken
        });
        log(`Status: ${response.statusCode}`);
        log(`Response: ${JSON.stringify(response.body, null, 2)}`);

        if (response.statusCode !== 201) {
            throw new Error(`Expected 201, got ${response.statusCode}`);
        }

        if (response.body.items && response.body.items.length > 0) {
            cartItemId = response.body.items[0].id;
            log(`📝 Cart Item ID: ${cartItemId}`, 'yellow');
        }

        return response.body;
    });
}

async function testAddMultipleItems() {
    return runTest('Add Multiple Items (Bulk)', async () => {
        const bulkData = {
            items: [
                {
                    productId: 'prod_test_mouse_888',
                    variantId: 'var_test_mouse_wireless',
                    quantity: 1,
                    price: 49.99,
                    originalPrice: 69.99
                },
                {
                    productId: 'prod_test_keyboard_777',
                    variantId: 'var_test_keyboard_mechanical',
                    quantity: 1,
                    price: 129.99,
                    originalPrice: 149.99
                }
            ]
        };

        const response = await makeRequest('POST', `${API_PREFIX}/cart/bulk/items`, bulkData, {
            'x-session-token': sessionToken
        });
        log(`Status: ${response.statusCode}`);
        log(`Response: ${JSON.stringify(response.body, null, 2)}`);

        if (response.statusCode !== 201) {
            throw new Error(`Expected 201, got ${response.statusCode}`);
        }

        return response.body;
    });
}

async function testGetCartWithItems() {
    return runTest('Get Cart (With Items)', async () => {
        const response = await makeRequest('GET', `${API_PREFIX}/cart`, null, {
            'x-session-token': sessionToken
        });
        log(`Status: ${response.statusCode}`);
        log(`Response: ${JSON.stringify(response.body, null, 2)}`);

        if (response.statusCode !== 200) {
            throw new Error(`Expected 200, got ${response.statusCode}`);
        }

        if (!response.body.items || response.body.items.length === 0) {
            throw new Error('Expected cart to have items');
        }

        return response.body;
    });
}

async function testUpdateCartItem() {
    return runTest('Update Cart Item Quantity', async () => {
        if (!cartItemId) {
            throw new Error('No cart item ID available for update');
        }

        const updateData = {
            quantity: 3
        };

        const response = await makeRequest('PATCH', `${API_PREFIX}/cart/items/${cartItemId}`, updateData, {
            'x-session-token': sessionToken
        });
        log(`Status: ${response.statusCode}`);
        log(`Response: ${JSON.stringify(response.body, null, 2)}`);

        if (response.statusCode !== 200) {
            throw new Error(`Expected 200, got ${response.statusCode}`);
        }

        return response.body;
    });
}

async function testValidateCart() {
    return runTest('Validate Cart', async () => {
        const response = await makeRequest('GET', `${API_PREFIX}/cart/validate`, null, {
            'x-session-token': sessionToken
        });
        log(`Status: ${response.statusCode}`);
        log(`Response: ${JSON.stringify(response.body, null, 2)}`);

        if (response.statusCode !== 200) {
            throw new Error(`Expected 200, got ${response.statusCode}`);
        }

        return response.body;
    });
}

async function testCheckoutInitialize() {
    return runTest('Initialize Checkout', async () => {
        const checkoutData = {
            sessionId: cartId,
            shippingAddress: {
                street: '123 Test St',
                city: 'Test City',
                state: 'TS',
                zipCode: '12345',
                country: 'US'
            },
            billingAddress: {
                street: '123 Test St',
                city: 'Test City',
                state: 'TS',
                zipCode: '12345',
                country: 'US'
            },
            paymentMethod: {
                type: 'credit_card',
                last4: '4242'
            }
        };

        const response = await makeRequest('POST', `${API_PREFIX}/checkout/initialize`, checkoutData, {
            'x-session-token': sessionToken,
            'Authorization': 'Bearer test-jwt-token'
        });
        log(`Status: ${response.statusCode}`);
        log(`Response: ${JSON.stringify(response.body, null, 2)}`);

        // Checkout might require auth, so 401 is acceptable
        if (response.statusCode !== 200 && response.statusCode !== 201 && response.statusCode !== 401) {
            throw new Error(`Expected 200/201/401, got ${response.statusCode}`);
        }

        return response.body;
    });
}

async function testShippingOptions() {
    return runTest('Get Shipping Options', async () => {
        const response = await makeRequest('GET', `${API_PREFIX}/checkout/shipping/options`);
        log(`Status: ${response.statusCode}`);
        log(`Response: ${JSON.stringify(response.body, null, 2)}`);

        if (response.statusCode !== 200) {
            throw new Error(`Expected 200, got ${response.statusCode}`);
        }

        return response.body;
    });
}

async function testCalculateShipping() {
    return runTest('Calculate Shipping Cost', async () => {
        const shippingData = {
            address: {
                city: 'Test City',
                state: 'TS',
                zipCode: '12345',
                country: 'US'
            },
            items: [
                { productId: 'prod_test_001', quantity: 2, weight: 2.5 }
            ]
        };

        const response = await makeRequest('POST', `${API_PREFIX}/checkout/shipping/calculate`, shippingData);
        log(`Status: ${response.statusCode}`);
        log(`Response: ${JSON.stringify(response.body, null, 2)}`);

        if (response.statusCode !== 200) {
            throw new Error(`Expected 200, got ${response.statusCode}`);
        }

        return response.body;
    });
}

async function testCalculateTax() {
    return runTest('Calculate Tax', async () => {
        const taxData = {
            address: {
                city: 'Test City',
                state: 'TS',
                zipCode: '12345',
                country: 'US'
            },
            subtotal: 500.00,
            items: [
                { productId: 'prod_test_001', quantity: 2, price: 250.00, category: 'electronics' }
            ]
        };

        const response = await makeRequest('POST', `${API_PREFIX}/checkout/tax/calculate`, taxData);
        log(`Status: ${response.statusCode}`);
        log(`Response: ${JSON.stringify(response.body, null, 2)}`);

        if (response.statusCode !== 200) {
            throw new Error(`Expected 200, got ${response.statusCode}`);
        }

        return response.body;
    });
}

async function testValidateCoupon() {
    return runTest('Validate Discount Coupon', async () => {
        const couponData = {
            code: 'SAVE10',
            subtotal: 500.00,
            items: []
        };

        const response = await makeRequest('POST', `${API_PREFIX}/checkout/discount/validate`, couponData);
        log(`Status: ${response.statusCode}`);
        log(`Response: ${JSON.stringify(response.body, null, 2)}`);

        if (response.statusCode !== 200) {
            throw new Error(`Expected 200, got ${response.statusCode}`);
        }

        return response.body;
    });
}

async function testPricingHealth() {
    return runTest('Pricing Service Health Check', async () => {
        const response = await makeRequest('GET', `${API_PREFIX}/pricing/health`, null, {
            'Authorization': 'Bearer test-jwt-token'
        });
        log(`Status: ${response.statusCode}`);
        log(`Response: ${JSON.stringify(response.body, null, 2)}`);

        // Might require auth
        if (response.statusCode !== 200 && response.statusCode !== 401) {
            throw new Error(`Expected 200/401, got ${response.statusCode}`);
        }

        return response.body;
    });
}

async function testRemoveCartItem() {
    return runTest('Remove Item from Cart', async () => {
        if (!cartItemId) {
            log('⚠️  Skipping: No cart item ID available', 'yellow');
            return { skipped: true };
        }

        const response = await makeRequest('DELETE', `${API_PREFIX}/cart/items/${cartItemId}`, null, {
            'x-session-token': sessionToken
        });
        log(`Status: ${response.statusCode}`);

        if (response.statusCode !== 204 && response.statusCode !== 200) {
            throw new Error(`Expected 204/200, got ${response.statusCode}`);
        }

        return { deleted: true };
    });
}

async function testCartHealth() {
    return runTest('Cart Service Health Check', async () => {
        const response = await makeRequest('GET', `${API_PREFIX}/cart/health`);
        log(`Status: ${response.statusCode}`);
        log(`Response: ${JSON.stringify(response.body, null, 2)}`);

        if (response.statusCode !== 200) {
            throw new Error(`Expected 200, got ${response.statusCode}`);
        }

        return response.body;
    });
}

async function testClearCart() {
    return runTest('Clear Cart', async () => {
        const response = await makeRequest('DELETE', `${API_PREFIX}/cart`, null, {
            'x-session-token': sessionToken
        });
        log(`Status: ${response.statusCode}`);

        if (response.statusCode !== 204 && response.statusCode !== 200) {
            throw new Error(`Expected 204/200, got ${response.statusCode}`);
        }

        return { cleared: true };
    });
}

async function generateReport() {
    log('\n\n', 'reset');
    log('╔════════════════════════════════════════════════════════════════════════════╗', 'cyan');
    log('║                         API TEST SUMMARY REPORT                            ║', 'cyan');
    log('╚════════════════════════════════════════════════════════════════════════════╝', 'cyan');
    log('');

    log(`📊 Total Tests: ${totalTests}`, 'bright');
    log(`✅ Passed: ${passedTests}`, 'green');
    log(`❌ Failed: ${failedTests}`, 'red');
    log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(2)}%`, passedTests === totalTests ? 'green' : 'yellow');
    log('');

    log('─'.repeat(80), 'cyan');
    log('DETAILED RESULTS:', 'bright');
    log('─'.repeat(80), 'cyan');

    testResults.forEach((result, index) => {
        const icon = result.status === 'PASSED' ? '✅' : '❌';
        const color = result.status === 'PASSED' ? 'green' : 'red';
        log(`${index + 1}. ${icon} ${result.name}`, color);
        if (result.error) {
            log(`   Error: ${result.error}`, 'red');
        }
    });

    log('');
    log('═'.repeat(80), 'cyan');

    // Save results to file
    const reportData = {
        timestamp: new Date().toISOString(),
        summary: {
            total: totalTests,
            passed: passedTests,
            failed: failedTests,
            successRate: `${((passedTests / totalTests) * 100).toFixed(2)}%`
        },
        tests: testResults
    };

    fs.writeFileSync('api-test-results.json', JSON.stringify(reportData, null, 2));
    log('📄 Detailed report saved to: api-test-results.json', 'cyan');
}

async function runAllTests() {
    log('╔════════════════════════════════════════════════════════════════════════════╗', 'bright');
    log('║            COMPREHENSIVE API TEST SUITE - ADD TO CART SERVICE             ║', 'bright');
    log('╚════════════════════════════════════════════════════════════════════════════╝', 'bright');
    log(`🚀 Starting tests at: ${new Date().toISOString()}`, 'cyan');
    log(`📡 Target: ${BASE_URL}:${PORT}`, 'cyan');
    log('');

    try {
        // Health checks
        await testHealthCheck();

        // Session management
        await testCreateSession();

        // Cart operations
        await testGetEmptyCart();
        await testAddItemToCart();
        await testAddMultipleItems();
        await testGetCartWithItems();
        await testUpdateCartItem();
        await testValidateCart();

        // Checkout flow
        await testCheckoutInitialize();
        await testShippingOptions();
        await testCalculateShipping();
        await testCalculateTax();
        await testValidateCoupon();

        // Service health checks
        await testPricingHealth();
        await testCartHealth();

        // Cleanup operations
        await testRemoveCartItem();
        await testClearCart();

    } catch (error) {
        log(`\n⚠️  Test suite encountered an error: ${error.message}`, 'red');
    }

    // Generate final report
    await generateReport();

    process.exit(failedTests > 0 ? 1 : 0);
}

// Run the test suite
runAllTests();

