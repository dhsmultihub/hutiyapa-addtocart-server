import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';
import { CartModule } from '../../cart/cart.module';
import { CheckoutModule } from '../../checkout/checkout.module';
import { OrderModule } from '../../order/order.module';
import { PricingModule } from '../../pricing/pricing.module';
import { SessionModule } from '../../session/session.module';
import { MonitoringModule } from '../../monitoring/monitoring.module';
import { AppModule } from '../../app.module';
import * as request from 'supertest';

describe('Add-to-Cart Service E2E Tests', () => {
    let app: INestApplication;
    let httpServer: any;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
        httpServer = app.getHttpServer();
    });

    afterAll(async () => {
        await app.close();
    });

    describe('Health Check Endpoints', () => {
        it('should return health status', () => {
            return request(httpServer)
                .get('/api/v1/health')
                .expect(200)
                .expect((res) => {
                    expect(res.body).toHaveProperty('status');
                    expect(res.body).toHaveProperty('checks');
                    expect(res.body).toHaveProperty('timestamp');
                });
        });

        it('should return detailed health status', () => {
            return request(httpServer)
                .get('/api/v1/health/detailed')
                .expect(200)
                .expect((res) => {
                    expect(res.body).toHaveProperty('overall');
                    expect(res.body).toHaveProperty('database');
                    expect(res.body).toHaveProperty('redis');
                    expect(res.body).toHaveProperty('externalServices');
                    expect(res.body).toHaveProperty('system');
                    expect(res.body).toHaveProperty('business');
                });
        });

        it('should return readiness probe', () => {
            return request(httpServer)
                .get('/api/v1/health/ready')
                .expect(200)
                .expect((res) => {
                    expect(res.body).toHaveProperty('ready');
                    expect(res.body).toHaveProperty('checks');
                });
        });

        it('should return liveness probe', () => {
            return request(httpServer)
                .get('/api/v1/health/live')
                .expect(200)
                .expect((res) => {
                    expect(res.body).toHaveProperty('alive');
                    expect(res.body).toHaveProperty('uptime');
                    expect(res.body).toHaveProperty('timestamp');
                });
        });
    });

    describe('Cart API Endpoints', () => {
        let cartId: string;
        let itemId: string;

        it('should create a new cart', () => {
            return request(httpServer)
                .post('/api/v1/cart')
                .send({
                    userId: 'test-user-123',
                    sessionId: 'test-session-456',
                })
                .expect(201)
                .expect((res) => {
                    expect(res.body).toHaveProperty('id');
                    expect(res.body.userId).toBe('test-user-123');
                    expect(res.body.sessionId).toBe('test-session-456');
                    cartId = res.body.id;
                });
        });

        it('should get cart by ID', () => {
            return request(httpServer)
                .get(`/api/v1/cart/${cartId}`)
                .expect(200)
                .expect((res) => {
                    expect(res.body.id).toBe(cartId);
                    expect(res.body.items).toEqual([]);
                });
        });

        it('should add item to cart', () => {
            return request(httpServer)
                .post(`/api/v1/cart/${cartId}/items`)
                .send({
                    productId: 'product-123',
                    variantId: 'variant-456',
                    quantity: 2,
                    price: 29.99,
                })
                .expect(201)
                .expect((res) => {
                    expect(res.body.items).toHaveLength(1);
                    expect(res.body.items[0].productId).toBe('product-123');
                    expect(res.body.items[0].quantity).toBe(2);
                    itemId = res.body.items[0].id;
                });
        });

        it('should update cart item', () => {
            return request(httpServer)
                .patch(`/api/v1/cart/${cartId}/items/${itemId}`)
                .send({
                    quantity: 3,
                })
                .expect(200)
                .expect((res) => {
                    expect(res.body.items[0].quantity).toBe(3);
                });
        });

        it('should get cart totals', () => {
            return request(httpServer)
                .get(`/api/v1/cart/${cartId}/totals`)
                .expect(200)
                .expect((res) => {
                    expect(res.body).toHaveProperty('subtotal');
                    expect(res.body).toHaveProperty('tax');
                    expect(res.body).toHaveProperty('discount');
                    expect(res.body).toHaveProperty('total');
                    expect(res.body).toHaveProperty('itemCount');
                });
        });

        it('should remove item from cart', () => {
            return request(httpServer)
                .delete(`/api/v1/cart/${cartId}/items/${itemId}`)
                .expect(200)
                .expect((res) => {
                    expect(res.body.items).toHaveLength(0);
                });
        });

        it('should clear cart', () => {
            // First add an item back
            return request(httpServer)
                .post(`/api/v1/cart/${cartId}/items`)
                .send({
                    productId: 'product-456',
                    variantId: 'variant-789',
                    quantity: 1,
                    price: 19.99,
                })
                .expect(201)
                .then(() => {
                    return request(httpServer)
                        .delete(`/api/v1/cart/${cartId}/items`)
                        .expect(200)
                        .expect((res) => {
                            expect(res.body.items).toHaveLength(0);
                        });
                });
        });

        it('should delete cart', () => {
            return request(httpServer)
                .delete(`/api/v1/cart/${cartId}`)
                .expect(200)
                .expect((res) => {
                    expect(res.body).toHaveProperty('id');
                });
        });
    });

    describe('Checkout API Endpoints', () => {
        let cartId: string;
        let checkoutSessionId: string;

        beforeEach(async () => {
            // Create cart for checkout tests
            const cartResponse = await request(httpServer)
                .post('/api/v1/cart')
                .send({
                    userId: 'checkout-user-123',
                    sessionId: 'checkout-session-456',
                });
            cartId = cartResponse.body.id;

            // Add item to cart
            await request(httpServer)
                .post(`/api/v1/cart/${cartId}/items`)
                .send({
                    productId: 'product-123',
                    variantId: 'variant-456',
                    quantity: 1,
                    price: 29.99,
                });
        });

        it('should create checkout session', () => {
            return request(httpServer)
                .post('/api/v1/checkout/session')
                .send({
                    cartId: cartId,
                    userId: 'checkout-user-123',
                })
                .expect(201)
                .expect((res) => {
                    expect(res.body).toHaveProperty('sessionId');
                    expect(res.body).toHaveProperty('status');
                    checkoutSessionId = res.body.sessionId;
                });
        });

        it('should get checkout session', () => {
            return request(httpServer)
                .get(`/api/v1/checkout/session/${checkoutSessionId}`)
                .expect(200)
                .expect((res) => {
                    expect(res.body.sessionId).toBe(checkoutSessionId);
                    expect(res.body).toHaveProperty('cart');
                    expect(res.body).toHaveProperty('totals');
                });
        });

        it('should process checkout', () => {
            return request(httpServer)
                .post('/api/v1/checkout/process')
                .send({
                    sessionId: checkoutSessionId,
                    paymentMethod: 'credit_card',
                    shippingAddress: {
                        firstName: 'John',
                        lastName: 'Doe',
                        address1: '123 Main St',
                        city: 'New York',
                        state: 'NY',
                        postalCode: '10001',
                        country: 'US',
                        phone: '+1234567890',
                        email: 'john@example.com',
                    },
                    billingAddress: {
                        firstName: 'John',
                        lastName: 'Doe',
                        address1: '123 Main St',
                        city: 'New York',
                        state: 'NY',
                        postalCode: '10001',
                        country: 'US',
                        phone: '+1234567890',
                        email: 'john@example.com',
                    },
                })
                .expect(201)
                .expect((res) => {
                    expect(res.body).toHaveProperty('success');
                    expect(res.body).toHaveProperty('orderId');
                });
        });
    });

    describe('Order API Endpoints', () => {
        let orderId: string;

        it('should get user orders', () => {
            return request(httpServer)
                .get('/api/v1/orders')
                .query({ userId: 'test-user-123' })
                .expect(200)
                .expect((res) => {
                    expect(Array.isArray(res.body)).toBe(true);
                });
        });

        it('should get order by ID', () => {
            // This would require an existing order ID
            // For now, we'll test the endpoint structure
            return request(httpServer)
                .get('/api/v1/orders/non-existent-order')
                .expect(404);
        });
    });

    describe('Pricing API Endpoints', () => {
        it('should calculate pricing', () => {
            return request(httpServer)
                .post('/api/v1/pricing/calculate')
                .send({
                    items: [
                        {
                            productId: 'product-123',
                            variantId: 'variant-456',
                            quantity: 2,
                            unitPrice: 29.99,
                        },
                    ],
                    userId: 'test-user-123',
                    sessionId: 'test-session-456',
                    currency: 'USD',
                })
                .expect(200)
                .expect((res) => {
                    expect(res.body).toHaveProperty('breakdown');
                    expect(res.body.breakdown).toHaveProperty('subtotal');
                    expect(res.body.breakdown).toHaveProperty('taxTotal');
                    expect(res.body.breakdown).toHaveProperty('discountTotal');
                    expect(res.body.breakdown).toHaveProperty('total');
                });
        });

        it('should get discounts', () => {
            return request(httpServer)
                .get('/api/v1/pricing/discounts')
                .expect(200)
                .expect((res) => {
                    expect(Array.isArray(res.body)).toBe(true);
                });
        });

        it('should get tax rates', () => {
            return request(httpServer)
                .get('/api/v1/pricing/tax-rates')
                .expect(200)
                .expect((res) => {
                    expect(Array.isArray(res.body)).toBe(true);
                });
        });
    });

    describe('Session API Endpoints', () => {
        let sessionId: string;

        it('should create session', () => {
            return request(httpServer)
                .post('/api/v1/session')
                .send({
                    userId: 'test-user-123',
                    deviceInfo: {
                        userAgent: 'test-agent',
                        platform: 'web',
                    },
                })
                .expect(201)
                .expect((res) => {
                    expect(res.body).toHaveProperty('sessionId');
                    expect(res.body).toHaveProperty('token');
                    sessionId = res.body.sessionId;
                });
        });

        it('should get session', () => {
            return request(httpServer)
                .get(`/api/v1/session/${sessionId}`)
                .expect(200)
                .expect((res) => {
                    expect(res.body.sessionId).toBe(sessionId);
                });
        });

        it('should update session', () => {
            return request(httpServer)
                .patch(`/api/v1/session/${sessionId}`)
                .send({
                    metadata: {
                        lastActivity: new Date().toISOString(),
                    },
                })
                .expect(200)
                .expect((res) => {
                    expect(res.body.sessionId).toBe(sessionId);
                });
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid cart ID', () => {
            return request(httpServer)
                .get('/api/v1/cart/invalid-cart-id')
                .expect(404);
        });

        it('should handle invalid checkout session', () => {
            return request(httpServer)
                .get('/api/v1/checkout/session/invalid-session')
                .expect(404);
        });

        it('should handle invalid order ID', () => {
            return request(httpServer)
                .get('/api/v1/orders/invalid-order-id')
                .expect(404);
        });

        it('should handle malformed requests', () => {
            return request(httpServer)
                .post('/api/v1/cart')
                .send({
                    // Missing required fields
                })
                .expect(400);
        });
    });

    describe('Performance Tests', () => {
        it('should handle concurrent cart operations', async () => {
            const promises = Array.from({ length: 10 }, (_, index) =>
                request(httpServer)
                    .post('/api/v1/cart')
                    .send({
                        userId: `concurrent-user-${index}`,
                        sessionId: `concurrent-session-${index}`,
                    })
            );

            const responses = await Promise.all(promises);

            responses.forEach((response) => {
                expect(response.status).toBe(201);
                expect(response.body).toHaveProperty('id');
            });
        });

        it('should handle rapid item additions', async () => {
            // Create cart
            const cartResponse = await request(httpServer)
                .post('/api/v1/cart')
                .send({
                    userId: 'performance-user',
                    sessionId: 'performance-session',
                });

            const cartId = cartResponse.body.id;

            // Add multiple items rapidly
            const promises = Array.from({ length: 20 }, (_, index) =>
                request(httpServer)
                    .post(`/api/v1/cart/${cartId}/items`)
                    .send({
                        productId: `product-${index}`,
                        variantId: `variant-${index}`,
                        quantity: 1,
                        price: 10.00 + index,
                    })
            );

            const responses = await Promise.all(promises);

            responses.forEach((response) => {
                expect(response.status).toBe(201);
            });

            // Verify all items were added
            const finalCartResponse = await request(httpServer)
                .get(`/api/v1/cart/${cartId}`)
                .expect(200);

            expect(finalCartResponse.body.items).toHaveLength(20);
        });
    });
});
