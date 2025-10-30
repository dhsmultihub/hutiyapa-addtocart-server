const http = require('http');

// Simple script to get a session token from database and test cart endpoints
const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

const BASE_URL = 'localhost';
const PORT = 8000;
const API_PREFIX = '/api/v1';

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

async function runTests() {
    console.log('🔍 Fetching session token from database...\n');

    // Get a session token from the seeded data
    const session = await prisma.cartSession.findFirst({
        where: {
            expiresAt: {
                gt: new Date() // Get a non-expired session
            }
        }
    });

    if (!session) {
        console.log('❌ No valid session found in database. Please run: npm run seed');
        await prisma.$disconnect();
        process.exit(1);
    }

    const sessionToken = session.sessionToken;
    console.log(`✅ Found session token: ${sessionToken}`);
    console.log(`   User ID: ${session.userId || 'Guest'}`);
    console.log(`   Expires: ${session.expiresAt}`);
    console.log('\n' + '='.repeat(80) + '\n');

    // Test 1: Get Cart
    console.log('TEST 1: Get Cart');
    console.log('-'.repeat(80));
    const cartResponse = await makeRequest('GET', `${API_PREFIX}/cart`, null, {
        'x-session-token': sessionToken
    });
    console.log(`Status: ${cartResponse.statusCode}`);
    console.log(`Response:`, JSON.stringify(cartResponse.body, null, 2));
    console.log('\n' + '='.repeat(80) + '\n');

    let cartId = cartResponse.body?.id;

    // Test 2: Add Item to Cart
    console.log('TEST 2: Add Item to Cart');
    console.log('-'.repeat(80));
    const addItemResponse = await makeRequest('POST', `${API_PREFIX}/cart/items`, {
        productId: 'prod_api_test_001',
        variantId: 'var_api_test_001',
        quantity: 2,
        price: 99.99,
        originalPrice: 129.99
    }, {
        'x-session-token': sessionToken
    });
    console.log(`Status: ${addItemResponse.statusCode}`);
    console.log(`Response:`, JSON.stringify(addItemResponse.body, null, 2));
    console.log('\n' + '='.repeat(80) + '\n');

    // Test 3: Get Cart with Items
    console.log('TEST 3: Get Cart with Items');
    console.log('-'.repeat(80));
    const cartWithItemsResponse = await makeRequest('GET', `${API_PREFIX}/cart`, null, {
        'x-session-token': sessionToken
    });
    console.log(`Status: ${cartWithItemsResponse.statusCode}`);
    console.log(`Response:`, JSON.stringify(cartWithItemsResponse.body, null, 2));
    console.log('\n' + '='.repeat(80) + '\n');

    // Test 4: Get Shipping Options
    console.log('TEST 4: Get Shipping Options');
    console.log('-'.repeat(80));
    const shippingResponse = await makeRequest('GET', `${API_PREFIX}/checkout/shipping/options`);
    console.log(`Status: ${shippingResponse.statusCode}`);
    console.log(`Response:`, JSON.stringify(shippingResponse.body, null, 2));
    console.log('\n' + '='.repeat(80) + '\n');

    // Test 5: Calculate Tax
    console.log('TEST 5: Calculate Tax');
    console.log('-'.repeat(80));
    const taxResponse = await makeRequest('POST', `${API_PREFIX}/checkout/tax/calculate`, {
        address: {
            city: 'New York',
            state: 'NY',
            zipCode: '10001',
            country: 'US'
        },
        subtotal: 199.98,
        items: [
            { productId: 'prod_api_test_001', quantity: 2, price: 99.99, category: 'electronics' }
        ]
    });
    console.log(`Status: ${taxResponse.statusCode}`);
    console.log(`Response:`, JSON.stringify(taxResponse.body, null, 2));
    console.log('\n' + '='.repeat(80) + '\n');

    // Test 6: Validate Coupon
    console.log('TEST 6: Validate Discount Coupon');
    console.log('-'.repeat(80));
    const couponResponse = await makeRequest('POST', `${API_PREFIX}/checkout/discount/validate`, {
        code: 'SAVE10',
        subtotal: 199.98,
        items: []
    });
    console.log(`Status: ${couponResponse.statusCode}`);
    console.log(`Response:`, JSON.stringify(couponResponse.body, null, 2));
    console.log('\n' + '='.repeat(80) + '\n');

    // Test 7: Validate Cart
    console.log('TEST 7: Validate Cart');
    console.log('-'.repeat(80));
    const validateResponse = await makeRequest('GET', `${API_PREFIX}/cart/validate`, null, {
        'x-session-token': sessionToken
    });
    console.log(`Status: ${validateResponse.statusCode}`);
    console.log(`Response:`, JSON.stringify(validateResponse.body, null, 2));
    console.log('\n' + '='.repeat(80) + '\n');

    console.log('✅ All tests completed!');
    console.log('\n📊 Session used for testing:');
    console.log(`   Token: ${sessionToken}`);
    console.log(`   Cart ID: ${cartId}`);

    await prisma.$disconnect();
}

runTests().catch((error) => {
    console.error('❌ Test error:', error);
    prisma.$disconnect();
    process.exit(1);
});

