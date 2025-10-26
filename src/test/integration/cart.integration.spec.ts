import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';
import { CartModule } from '../../cart/cart.module';
import { CartService } from '../../cart/cart.service';
import { DatabaseService } from '../../database/database.service';
import { PricingEngineService } from '../../services/pricing-engine.service';
import { DiscountService } from '../../services/discount.service';
import { TaxService } from '../../services/tax.service';
import { PromotionService } from '../../services/promotion.service';

describe('Cart Integration Tests', () => {
    let app: INestApplication;
    let cartService: CartService;
    let databaseService: DatabaseService;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: ['.env.test', '.env'],
                }),
                DatabaseModule,
                CartModule,
            ],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();

        cartService = app.get<CartService>(CartService);
        databaseService = app.get<DatabaseService>(DatabaseService);
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        // Clean up database before each test
        await databaseService.cartItem.deleteMany();
        await databaseService.cart.deleteMany();
    });

    describe('Cart Workflow Integration', () => {
        it('should complete full cart workflow', async () => {
            const userId = 'test-user-123';
            const sessionId = 'test-session-456';

            // 1. Create cart
            const cart = await cartService.createCart({
                userId,
                sessionId,
            });

            expect(cart).toBeDefined();
            expect(cart.userId).toBe(userId);
            expect(cart.sessionId).toBe(sessionId);
            expect(cart.items).toEqual([]);

            // 2. Add items to cart
            const item1 = await cartService.addItemToCart(cart.id, {
                productId: 'product-123',
                variantId: 'variant-456',
                quantity: 2,
                price: 29.99,
            });

            expect(item1.items).toHaveLength(1);
            expect(item1.items[0].productId).toBe('product-123');
            expect(item1.items[0].quantity).toBe(2);

            const item2 = await cartService.addItemToCart(cart.id, {
                productId: 'product-456',
                variantId: 'variant-789',
                quantity: 1,
                price: 49.99,
            });

            expect(item2.items).toHaveLength(2);

            // 3. Update item quantity
            const updatedCart = await cartService.updateCartItem(
                cart.id,
                item1.items[0].id,
                { quantity: 3 }
            );

            expect(updatedCart.items[0].quantity).toBe(3);

            // 4. Get cart totals
            const totals = await cartService.getCartTotals(cart.id);

            expect(totals.itemCount).toBe(4); // 3 + 1
            expect(totals.subtotal).toBeGreaterThan(0);

            // 5. Remove item
            const cartAfterRemoval = await cartService.removeItemFromCart(
                cart.id,
                item1.items[0].id
            );

            expect(cartAfterRemoval.items).toHaveLength(1);

            // 6. Clear cart
            const clearedCart = await cartService.clearCart(cart.id);

            expect(clearedCart.items).toHaveLength(0);

            // 7. Delete cart
            const deletedCart = await cartService.deleteCart(cart.id);

            expect(deletedCart).toBeDefined();
        });

        it('should handle concurrent cart operations', async () => {
            const userId = 'test-user-concurrent';
            const sessionId = 'test-session-concurrent';

            // Create cart
            const cart = await cartService.createCart({
                userId,
                sessionId,
            });

            // Simulate concurrent operations
            const promises = [
                cartService.addItemToCart(cart.id, {
                    productId: 'product-1',
                    variantId: 'variant-1',
                    quantity: 1,
                    price: 10.00,
                }),
                cartService.addItemToCart(cart.id, {
                    productId: 'product-2',
                    variantId: 'variant-2',
                    quantity: 1,
                    price: 20.00,
                }),
                cartService.addItemToCart(cart.id, {
                    productId: 'product-3',
                    variantId: 'variant-3',
                    quantity: 1,
                    price: 30.00,
                }),
            ];

            const results = await Promise.all(promises);

            // All operations should succeed
            results.forEach((result) => {
                expect(result).toBeDefined();
                expect(result.items.length).toBeGreaterThan(0);
            });

            // Final cart should have all items
            const finalCart = await cartService.getCartById(cart.id);
            expect(finalCart.items).toHaveLength(3);
        });

        it('should handle user with multiple carts', async () => {
            const userId = 'test-user-multiple';
            const sessionId1 = 'test-session-1';
            const sessionId2 = 'test-session-2';

            // Create two carts for the same user
            const cart1 = await cartService.createCart({
                userId,
                sessionId: sessionId1,
            });

            const cart2 = await cartService.createCart({
                userId,
                sessionId: sessionId2,
            });

            // Add items to both carts
            await cartService.addItemToCart(cart1.id, {
                productId: 'product-1',
                variantId: 'variant-1',
                quantity: 1,
                price: 10.00,
            });

            await cartService.addItemToCart(cart2.id, {
                productId: 'product-2',
                variantId: 'variant-2',
                quantity: 2,
                price: 20.00,
            });

            // Get user carts
            const userCarts = await cartService.getUserCarts(userId);

            expect(userCarts).toHaveLength(2);
            expect(userCarts[0].sessionId).toBe(sessionId2); // Most recent first
            expect(userCarts[1].sessionId).toBe(sessionId1);
        });
    });

    describe('Error Handling Integration', () => {
        it('should handle database connection errors gracefully', async () => {
            // This test would require mocking database connection failures
            // For now, we'll test with invalid data
            await expect(
                cartService.createCart({
                    userId: null as any,
                    sessionId: 'test-session',
                })
            ).rejects.toThrow();
        });

        it('should handle invalid cart operations', async () => {
            const nonExistentCartId = 'non-existent-cart';

            await expect(
                cartService.addItemToCart(nonExistentCartId, {
                    productId: 'product-123',
                    variantId: 'variant-456',
                    quantity: 1,
                    price: 10.00,
                })
            ).rejects.toThrow('Cart not found');

            await expect(
                cartService.updateCartItem(nonExistentCartId, 'item-123', {
                    quantity: 2,
                })
            ).rejects.toThrow('Cart not found');

            await expect(
                cartService.removeItemFromCart(nonExistentCartId, 'item-123')
            ).rejects.toThrow('Cart not found');

            await expect(cartService.clearCart(nonExistentCartId)).rejects.toThrow(
                'Cart not found'
            );

            await expect(cartService.deleteCart(nonExistentCartId)).rejects.toThrow(
                'Cart not found'
            );
        });
    });

    describe('Performance Integration', () => {
        it('should handle large cart operations efficiently', async () => {
            const userId = 'test-user-performance';
            const sessionId = 'test-session-performance';

            const cart = await cartService.createCart({
                userId,
                sessionId,
            });

            const startTime = Date.now();

            // Add many items
            const itemPromises = Array.from({ length: 100 }, (_, index) =>
                cartService.addItemToCart(cart.id, {
                    productId: `product-${index}`,
                    variantId: `variant-${index}`,
                    quantity: 1,
                    price: 10.00 + index,
                })
            );

            await Promise.all(itemPromises);

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete within reasonable time (adjust threshold as needed)
            expect(duration).toBeLessThan(5000); // 5 seconds

            // Verify all items were added
            const finalCart = await cartService.getCartById(cart.id);
            expect(finalCart.items).toHaveLength(100);
        });

        it('should handle concurrent users efficiently', async () => {
            const startTime = Date.now();

            // Create multiple carts for different users
            const userPromises = Array.from({ length: 50 }, (_, index) =>
                cartService.createCart({
                    userId: `user-${index}`,
                    sessionId: `session-${index}`,
                })
            );

            const carts = await Promise.all(userPromises);

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete within reasonable time
            expect(duration).toBeLessThan(10000); // 10 seconds

            // Verify all carts were created
            expect(carts).toHaveLength(50);
            carts.forEach((cart, index) => {
                expect(cart.userId).toBe(`user-${index}`);
                expect(cart.sessionId).toBe(`session-${index}`);
            });
        });
    });

    describe('Data Consistency Integration', () => {
        it('should maintain data consistency during transactions', async () => {
            const userId = 'test-user-consistency';
            const sessionId = 'test-session-consistency';

            const cart = await cartService.createCart({
                userId,
                sessionId,
            });

            // Add item
            await cartService.addItemToCart(cart.id, {
                productId: 'product-123',
                variantId: 'variant-456',
                quantity: 2,
                price: 29.99,
            });

            // Verify cart state
            const cartWithItem = await cartService.getCartById(cart.id);
            expect(cartWithItem.items).toHaveLength(1);
            expect(cartWithItem.items[0].quantity).toBe(2);

            // Update item
            await cartService.updateCartItem(
                cart.id,
                cartWithItem.items[0].id,
                { quantity: 5 }
            );

            // Verify update
            const updatedCart = await cartService.getCartById(cart.id);
            expect(updatedCart.items[0].quantity).toBe(5);

            // Remove item
            await cartService.removeItemFromCart(cart.id, cartWithItem.items[0].id);

            // Verify removal
            const emptyCart = await cartService.getCartById(cart.id);
            expect(emptyCart.items).toHaveLength(0);
        });
    });
});
