import { Test, TestingModule } from '@nestjs/testing';
import { CartService } from '../../cart/cart.service';
import { DatabaseService } from '../../database/database.service';
import { PricingEngineService } from '../../services/pricing-engine.service';
import { Logger } from '@nestjs/common';

describe('CartService', () => {
    let service: CartService;
    let databaseService: jest.Mocked<DatabaseService>;
    let pricingEngineService: jest.Mocked<PricingEngineService>;

    beforeEach(async () => {
        const mockDatabaseService = {
            cart: {
                findUnique: jest.fn(),
                findMany: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
                count: jest.fn(),
            },
            cartItem: {
                findMany: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
                deleteMany: jest.fn(),
            },
            $transaction: jest.fn(),
        };

        const mockPricingEngineService = {
            calculatePricing: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CartService,
                {
                    provide: DatabaseService,
                    useValue: mockDatabaseService,
                },
                {
                    provide: PricingEngineService,
                    useValue: mockPricingEngineService,
                },
                {
                    provide: Logger,
                    useValue: {
                        log: jest.fn(),
                        error: jest.fn(),
                        warn: jest.fn(),
                        debug: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<CartService>(CartService);
        databaseService = module.get(DatabaseService);
        pricingEngineService = module.get(PricingEngineService);
    });

    describe('createCart', () => {
        it('should create a new cart successfully', async () => {
            const cartData = {
                userId: 'user-123',
                sessionId: 'session-456',
            };

            const mockCart = {
                id: 'cart-123',
                userId: 'user-123',
                sessionId: 'session-456',
                items: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            databaseService.cart.create.mockResolvedValue(mockCart as any);

            const result = await service.createCart(cartData);

            expect(databaseService.cart.create).toHaveBeenCalledWith({
                data: {
                    userId: cartData.userId,
                    sessionId: cartData.sessionId,
                    items: {
                        create: [],
                    },
                },
                include: {
                    items: true,
                },
            });

            expect(result).toEqual(mockCart);
        });

        it('should handle database errors', async () => {
            const cartData = {
                userId: 'user-123',
                sessionId: 'session-456',
            };

            databaseService.cart.create.mockRejectedValue(new Error('Database error'));

            await expect(service.createCart(cartData)).rejects.toThrow('Database error');
        });
    });

    describe('getCartById', () => {
        it('should return cart when found', async () => {
            const cartId = 'cart-123';
            const mockCart = {
                id: cartId,
                userId: 'user-123',
                sessionId: 'session-456',
                items: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            databaseService.cart.findUnique.mockResolvedValue(mockCart as any);

            const result = await service.getCartById(cartId);

            expect(databaseService.cart.findUnique).toHaveBeenCalledWith({
                where: { id: cartId },
                include: { items: true },
            });

            expect(result).toEqual(mockCart);
        });

        it('should return null when cart not found', async () => {
            const cartId = 'non-existent-cart';

            databaseService.cart.findUnique.mockResolvedValue(null);

            const result = await service.getCartById(cartId);

            expect(result).toBeNull();
        });
    });

    describe('addItemToCart', () => {
        it('should add item to existing cart', async () => {
            const cartId = 'cart-123';
            const itemData = {
                productId: 'product-123',
                variantId: 'variant-456',
                quantity: 2,
                price: 29.99,
            };

            const mockCart = {
                id: cartId,
                userId: 'user-123',
                sessionId: 'session-456',
                items: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const mockCartItem = {
                id: 'item-123',
                cartId: cartId,
                productId: itemData.productId,
                variantId: itemData.variantId,
                quantity: itemData.quantity,
                price: itemData.price,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            databaseService.cart.findUnique.mockResolvedValue(mockCart as any);
            databaseService.cartItem.create.mockResolvedValue(mockCartItem as any);
            databaseService.cart.update.mockResolvedValue({
                ...mockCart,
                items: [mockCartItem],
            } as any);

            const result = await service.addItemToCart(cartId, itemData);

            expect(databaseService.cart.findUnique).toHaveBeenCalledWith({
                where: { id: cartId },
                include: { items: true },
            });

            expect(databaseService.cartItem.create).toHaveBeenCalledWith({
                data: {
                    cartId,
                    productId: itemData.productId,
                    variantId: itemData.variantId,
                    quantity: itemData.quantity,
                    price: itemData.price,
                },
            });

            expect(result).toEqual({
                ...mockCart,
                items: [mockCartItem],
            });
        });

        it('should throw error when cart not found', async () => {
            const cartId = 'non-existent-cart';
            const itemData = {
                productId: 'product-123',
                variantId: 'variant-456',
                quantity: 2,
                price: 29.99,
            };

            databaseService.cart.findUnique.mockResolvedValue(null);

            await expect(service.addItemToCart(cartId, itemData)).rejects.toThrow(
                'Cart not found'
            );
        });
    });

    describe('updateCartItem', () => {
        it('should update item quantity', async () => {
            const cartId = 'cart-123';
            const itemId = 'item-123';
            const updateData = { quantity: 5 };

            const mockCart = {
                id: cartId,
                userId: 'user-123',
                sessionId: 'session-456',
                items: [
                    {
                        id: itemId,
                        cartId: cartId,
                        productId: 'product-123',
                        variantId: 'variant-456',
                        quantity: 2,
                        price: 29.99,
                    },
                ],
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const updatedItem = {
                ...mockCart.items[0],
                quantity: updateData.quantity,
            };

            databaseService.cart.findUnique.mockResolvedValue(mockCart as any);
            databaseService.cartItem.update.mockResolvedValue(updatedItem as any);
            databaseService.cart.update.mockResolvedValue({
                ...mockCart,
                items: [updatedItem],
            } as any);

            const result = await service.updateCartItem(cartId, itemId, updateData);

            expect(databaseService.cartItem.update).toHaveBeenCalledWith({
                where: { id: itemId },
                data: updateData,
            });

            expect(result).toEqual({
                ...mockCart,
                items: [updatedItem],
            });
        });

        it('should throw error when item not found', async () => {
            const cartId = 'cart-123';
            const itemId = 'non-existent-item';
            const updateData = { quantity: 5 };

            const mockCart = {
                id: cartId,
                userId: 'user-123',
                sessionId: 'session-456',
                items: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            databaseService.cart.findUnique.mockResolvedValue(mockCart as any);

            await expect(
                service.updateCartItem(cartId, itemId, updateData)
            ).rejects.toThrow('Item not found in cart');
        });
    });

    describe('removeItemFromCart', () => {
        it('should remove item from cart', async () => {
            const cartId = 'cart-123';
            const itemId = 'item-123';

            const mockCart = {
                id: cartId,
                userId: 'user-123',
                sessionId: 'session-456',
                items: [
                    {
                        id: itemId,
                        cartId: cartId,
                        productId: 'product-123',
                        variantId: 'variant-456',
                        quantity: 2,
                        price: 29.99,
                    },
                ],
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            databaseService.cart.findUnique.mockResolvedValue(mockCart as any);
            databaseService.cartItem.delete.mockResolvedValue({} as any);
            databaseService.cart.update.mockResolvedValue({
                ...mockCart,
                items: [],
            } as any);

            const result = await service.removeItemFromCart(cartId, itemId);

            expect(databaseService.cartItem.delete).toHaveBeenCalledWith({
                where: { id: itemId },
            });

            expect(result).toEqual({
                ...mockCart,
                items: [],
            });
        });
    });

    describe('clearCart', () => {
        it('should clear all items from cart', async () => {
            const cartId = 'cart-123';

            const mockCart = {
                id: cartId,
                userId: 'user-123',
                sessionId: 'session-456',
                items: [
                    {
                        id: 'item-123',
                        cartId: cartId,
                        productId: 'product-123',
                        variantId: 'variant-456',
                        quantity: 2,
                        price: 29.99,
                    },
                ],
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            databaseService.cart.findUnique.mockResolvedValue(mockCart as any);
            databaseService.cartItem.deleteMany.mockResolvedValue({ count: 1 } as any);
            databaseService.cart.update.mockResolvedValue({
                ...mockCart,
                items: [],
            } as any);

            const result = await service.clearCart(cartId);

            expect(databaseService.cartItem.deleteMany).toHaveBeenCalledWith({
                where: { cartId },
            });

            expect(result).toEqual({
                ...mockCart,
                items: [],
            });
        });
    });

    describe('getCartTotals', () => {
        it('should calculate cart totals with pricing engine', async () => {
            const cartId = 'cart-123';
            const mockCart = {
                id: cartId,
                userId: 'user-123',
                sessionId: 'session-456',
                items: [
                    {
                        id: 'item-123',
                        cartId: cartId,
                        productId: 'product-123',
                        variantId: 'variant-456',
                        quantity: 2,
                        price: 29.99,
                    },
                ],
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const mockPricingResponse = {
                breakdown: {
                    subtotal: 59.98,
                    taxTotal: 4.80,
                    discountTotal: 0,
                    total: 64.78,
                },
            };

            databaseService.cart.findUnique.mockResolvedValue(mockCart as any);
            pricingEngineService.calculatePricing.mockResolvedValue(mockPricingResponse);

            const result = await service.getCartTotals(cartId);

            expect(pricingEngineService.calculatePricing).toHaveBeenCalled();
            expect(result).toEqual({
                subtotal: 59.98,
                tax: 4.80,
                discount: 0,
                total: 64.78,
                itemCount: 2,
            });
        });

        it('should handle pricing engine failure with fallback', async () => {
            const cartId = 'cart-123';
            const mockCart = {
                id: cartId,
                userId: 'user-123',
                sessionId: 'session-456',
                items: [
                    {
                        id: 'item-123',
                        cartId: cartId,
                        productId: 'product-123',
                        variantId: 'variant-456',
                        quantity: 2,
                        price: 29.99,
                    },
                ],
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            databaseService.cart.findUnique.mockResolvedValue(mockCart as any);
            pricingEngineService.calculatePricing.mockRejectedValue(
                new Error('Pricing engine error')
            );

            const result = await service.getCartTotals(cartId);

            expect(result).toEqual({
                subtotal: 59.98,
                tax: 0,
                discount: 0,
                total: 59.98,
                itemCount: 2,
            });
        });
    });

    describe('getUserCarts', () => {
        it('should return user carts', async () => {
            const userId = 'user-123';
            const mockCarts = [
                {
                    id: 'cart-123',
                    userId: userId,
                    sessionId: 'session-456',
                    items: [],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            databaseService.cart.findMany.mockResolvedValue(mockCarts as any);

            const result = await service.getUserCarts(userId);

            expect(databaseService.cart.findMany).toHaveBeenCalledWith({
                where: { userId },
                include: { items: true },
                orderBy: { createdAt: 'desc' },
            });

            expect(result).toEqual(mockCarts);
        });
    });

    describe('deleteCart', () => {
        it('should delete cart and all items', async () => {
            const cartId = 'cart-123';

            const mockCart = {
                id: cartId,
                userId: 'user-123',
                sessionId: 'session-456',
                items: [
                    {
                        id: 'item-123',
                        cartId: cartId,
                        productId: 'product-123',
                        variantId: 'variant-456',
                        quantity: 2,
                        price: 29.99,
                    },
                ],
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            databaseService.cart.findUnique.mockResolvedValue(mockCart as any);
            databaseService.$transaction.mockImplementation(async (callback) => {
                return await callback(databaseService);
            });
            databaseService.cartItem.deleteMany.mockResolvedValue({ count: 1 } as any);
            databaseService.cart.delete.mockResolvedValue(mockCart as any);

            const result = await service.deleteCart(cartId);

            expect(databaseService.$transaction).toHaveBeenCalled();
            expect(databaseService.cartItem.deleteMany).toHaveBeenCalledWith({
                where: { cartId },
            });
            expect(databaseService.cart.delete).toHaveBeenCalledWith({
                where: { id: cartId },
            });

            expect(result).toEqual(mockCart);
        });

        it('should throw error when cart not found', async () => {
            const cartId = 'non-existent-cart';

            databaseService.cart.findUnique.mockResolvedValue(null);

            await expect(service.deleteCart(cartId)).rejects.toThrow('Cart not found');
        });
    });
});
