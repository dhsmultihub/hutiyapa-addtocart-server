// Database Seed File
// Comprehensive test data setup for development and testing

import { PrismaClient } from '../generated/prisma';
import { CartSessionModel } from '../models/cart-session.model';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive database seed...');
  console.log('');

  // Clear existing data
  console.log('🗑️  Clearing existing data...');
  await prisma.cartItem.deleteMany({});
  await prisma.cartMetadata.deleteMany({});
  await prisma.cart.deleteMany({});
  await prisma.cartSession.deleteMany({});
  console.log('✅ Existing data cleared');
  console.log('');

  const sessionModel = new CartSessionModel(prisma);
  const sessionTokens = [];

  // Create multiple guest sessions
  console.log('👤 Creating guest sessions...');
  const guestSession1Token = sessionModel.generateSessionToken();
  const guestSession1 = await sessionModel.create({
    userId: null,
    sessionToken: guestSession1Token,
    expiresAt: sessionModel.calculateExpiryDate(24)
  });
  sessionTokens.push({ type: 'Guest 1 (with cart)', token: guestSession1Token });

  const guestSession2Token = sessionModel.generateSessionToken();
  const guestSession2 = await sessionModel.create({
    userId: null,
    sessionToken: guestSession2Token,
    expiresAt: sessionModel.calculateExpiryDate(48)
  });
  sessionTokens.push({ type: 'Guest 2 (empty cart)', token: guestSession2Token });

  // Create user sessions
  console.log('👥 Creating user sessions...');
  const userSession1Token = sessionModel.generateSessionToken();
  const userSession1 = await sessionModel.create({
    userId: 'user_john_123',
    sessionToken: userSession1Token,
    expiresAt: sessionModel.calculateExpiryDate(24)
  });
  sessionTokens.push({ type: 'User John (active cart)', token: userSession1Token });

  const userSession2Token = sessionModel.generateSessionToken();
  const userSession2 = await sessionModel.create({
    userId: 'user_jane_456',
    sessionToken: userSession2Token,
    expiresAt: sessionModel.calculateExpiryDate(24)
  });
  sessionTokens.push({ type: 'User Jane (checkout cart)', token: userSession2Token });

  const userSession3Token = sessionModel.generateSessionToken();
  const userSession3 = await sessionModel.create({
    userId: 'user_bob_789',
    sessionToken: userSession3Token,
    expiresAt: sessionModel.calculateExpiryDate(12)
  });
  sessionTokens.push({ type: 'User Bob (multiple items)', token: userSession3Token });

  // Create expired session for cleanup testing
  const expiredSessionToken = sessionModel.generateSessionToken();
  await sessionModel.create({
    userId: 'user_expired_999',
    sessionToken: expiredSessionToken,
    expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
  });
  sessionTokens.push({ type: 'Expired (for cleanup test)', token: expiredSessionToken });

  console.log('✅ Created 6 sessions (4 active, 1 expired)');
  console.log('');

  // Create carts with different statuses
  console.log('🛒 Creating carts...');

  // Guest cart 1 - Active with items
  const guestCart1 = await prisma.cart.create({
    data: {
      sessionId: guestSession1.id,
      userId: null,
      status: 'ACTIVE',
      metadata: {
        create: [
          { key: 'source', value: 'web' },
          { key: 'device', value: 'desktop' },
          { key: 'browser', value: 'chrome' }
        ]
      }
    }
  });

  // Guest cart 2 - Empty active cart
  const guestCart2 = await prisma.cart.create({
    data: {
      sessionId: guestSession2.id,
      userId: null,
      status: 'ACTIVE',
      metadata: {
        create: [
          { key: 'source', value: 'web' },
          { key: 'device', value: 'mobile' }
        ]
      }
    }
  });

  // User cart 1 - Active with items
  const userCart1 = await prisma.cart.create({
    data: {
      sessionId: userSession1.id,
      userId: 'user_john_123',
      status: 'ACTIVE',
      metadata: {
        create: [
          { key: 'source', value: 'mobile_app' },
          { key: 'device', value: 'ios' },
          { key: 'app_version', value: '1.2.3' }
        ]
      }
    }
  });

  // User cart 2 - Checkout status
  const userCart2 = await prisma.cart.create({
    data: {
      sessionId: userSession2.id,
      userId: 'user_jane_456',
      status: 'CHECKOUT',
      metadata: {
        create: [
          { key: 'source', value: 'web' },
          { key: 'device', value: 'tablet' },
          { key: 'checkout_started', value: new Date().toISOString() }
        ]
      }
    }
  });

  // User cart 3 - Multiple items
  const userCart3 = await prisma.cart.create({
    data: {
      sessionId: userSession3.id,
      userId: 'user_bob_789',
      status: 'ACTIVE',
      metadata: {
        create: [
          { key: 'source', value: 'web' },
          { key: 'device', value: 'desktop' }
        ]
      }
    }
  });

  console.log('✅ Created 5 carts with various statuses');
  console.log('');

  // Create cart items with diverse products
  console.log('📦 Creating cart items...');
  await prisma.cartItem.createMany({
    data: [
      // Guest Cart 1 - Electronics
      {
        cartId: guestCart1.id,
        productId: 'prod_laptop_001',
        variantId: 'var_laptop_16gb',
        quantity: 1,
        price: 1299.99,
        originalPrice: 1499.99
      },
      {
        cartId: guestCart1.id,
        productId: 'prod_mouse_002',
        variantId: 'var_mouse_wireless',
        quantity: 2,
        price: 29.99,
        originalPrice: 39.99
      },

      // User Cart 1 (John) - Clothing
      {
        cartId: userCart1.id,
        productId: 'prod_tshirt_001',
        variantId: 'var_tshirt_blue_m',
        quantity: 3,
        price: 24.99,
        originalPrice: 29.99
      },
      {
        cartId: userCart1.id,
        productId: 'prod_jeans_002',
        variantId: 'var_jeans_black_32',
        quantity: 1,
        price: 59.99,
        originalPrice: 79.99
      },
      {
        cartId: userCart1.id,
        productId: 'prod_shoes_003',
        variantId: 'var_shoes_white_10',
        quantity: 1,
        price: 89.99,
        originalPrice: 89.99
      },

      // User Cart 2 (Jane) - Checkout
      {
        cartId: userCart2.id,
        productId: 'prod_book_001',
        variantId: null,
        quantity: 2,
        price: 15.99,
        originalPrice: 19.99
      },
      {
        cartId: userCart2.id,
        productId: 'prod_headphones_002',
        variantId: 'var_headphones_black',
        quantity: 1,
        price: 149.99,
        originalPrice: 199.99
      },

      // User Cart 3 (Bob) - Mixed items
      {
        cartId: userCart3.id,
        productId: 'prod_phone_001',
        variantId: 'var_phone_128gb_blue',
        quantity: 1,
        price: 799.99,
        originalPrice: 899.99
      },
      {
        cartId: userCart3.id,
        productId: 'prod_case_002',
        variantId: 'var_case_clear',
        quantity: 2,
        price: 19.99,
        originalPrice: 24.99
      },
      {
        cartId: userCart3.id,
        productId: 'prod_charger_003',
        variantId: 'var_charger_fast',
        quantity: 1,
        price: 29.99,
        originalPrice: 29.99
      },
      {
        cartId: userCart3.id,
        productId: 'prod_screen_004',
        variantId: 'var_screen_tempered',
        quantity: 3,
        price: 9.99,
        originalPrice: 14.99
      }
    ]
  });

  console.log('✅ Created 11 cart items across all carts');
  console.log('');

  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ DATABASE SEED COMPLETED SUCCESSFULLY!');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('📊 Summary:');
  console.log('   - 6 sessions (5 active, 1 expired)');
  console.log('   - 5 carts (4 ACTIVE, 1 CHECKOUT)');
  console.log('   - 11 cart items');
  console.log('   - 13 metadata entries');
  console.log('');
  console.log('🔑 Session Tokens for Testing:');
  console.log('───────────────────────────────────────────────────────');
  sessionTokens.forEach(({ type, token }) => {
    console.log(`   ${type}: ${token}`);
  });
  console.log('');
  console.log('💡 Use these tokens in the x-session-token header for API testing');
  console.log('═══════════════════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    console.error('Stack trace:', e.stack);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
