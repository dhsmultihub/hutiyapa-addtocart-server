// Database Seed File
// Initial data setup for development and testing

import { PrismaClient } from '../generated/prisma';
import { CartSessionModel } from '../models/cart-session.model';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create sample cart sessions
  const sessionModel = new CartSessionModel(prisma);
  
  // Create guest session
  const guestSessionToken = sessionModel.generateSessionToken();
  const guestSession = await sessionModel.create({
    userId: null,
    sessionToken: guestSessionToken,
    expiresAt: sessionModel.calculateExpiryDate(24)
  });

  // Create user session
  const userSessionToken = sessionModel.generateSessionToken();
  const userSession = await sessionModel.create({
    userId: 'user_123',
    sessionToken: userSessionToken,
    expiresAt: sessionModel.calculateExpiryDate(24)
  });

  // Create sample carts
  const guestCart = await prisma.cart.create({
    data: {
      sessionId: guestSession.id,
      userId: null,
      status: 'ACTIVE',
      metadata: {
        create: [
          { key: 'source', value: 'web' },
          { key: 'device', value: 'desktop' }
        ]
      }
    }
  });

  const userCart = await prisma.cart.create({
    data: {
      sessionId: userSession.id,
      userId: 'user_123',
      status: 'ACTIVE',
      metadata: {
        create: [
          { key: 'source', value: 'mobile' },
          { key: 'device', value: 'ios' }
        ]
      }
    }
  });

  // Create sample cart items
  await prisma.cartItem.createMany({
    data: [
      {
        cartId: guestCart.id,
        productId: 'prod_001',
        variantId: 'var_001',
        quantity: 2,
        price: 29.99,
        originalPrice: 39.99
      },
      {
        cartId: guestCart.id,
        productId: 'prod_002',
        variantId: null,
        quantity: 1,
        price: 15.50,
        originalPrice: 15.50
      },
      {
        cartId: userCart.id,
        productId: 'prod_003',
        variantId: 'var_002',
        quantity: 3,
        price: 45.00,
        originalPrice: 50.00
      }
    ]
  });

  // Create some expired sessions for testing cleanup
  const expiredSessionToken = sessionModel.generateSessionToken();
  await sessionModel.create({
    userId: 'user_456',
    sessionToken: expiredSessionToken,
    expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
  });

  console.log('✅ Database seed completed successfully!');
  console.log('📊 Created:');
  console.log(`   - 2 active sessions (1 guest, 1 user)`);
  console.log(`   - 1 expired session`);
  console.log(`   - 2 active carts`);
  console.log(`   - 3 cart items`);
  console.log(`   - 4 metadata entries`);
  console.log('');
  console.log('🔑 Session Tokens:');
  console.log(`   Guest: ${guestSessionToken}`);
  console.log(`   User: ${userSessionToken}`);
  console.log(`   Expired: ${expiredSessionToken}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
