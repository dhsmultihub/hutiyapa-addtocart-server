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

  // Create user sessions - Real Indian user IDs
  console.log('👥 Creating user sessions...');
  const userSession1Token = sessionModel.generateSessionToken();
  const userSession1 = await sessionModel.create({
    userId: 'rajesh_kumar_123',
    sessionToken: userSession1Token,
    expiresAt: sessionModel.calculateExpiryDate(24)
  });
  sessionTokens.push({ type: 'Rajesh Kumar (active cart)', token: userSession1Token });

  const userSession2Token = sessionModel.generateSessionToken();
  const userSession2 = await sessionModel.create({
    userId: 'priya_sharma_456',
    sessionToken: userSession2Token,
    expiresAt: sessionModel.calculateExpiryDate(24)
  });
  sessionTokens.push({ type: 'Priya Sharma (checkout cart)', token: userSession2Token });

  const userSession3Token = sessionModel.generateSessionToken();
  const userSession3 = await sessionModel.create({
    userId: 'amit_patel_789',
    sessionToken: userSession3Token,
    expiresAt: sessionModel.calculateExpiryDate(12)
  });
  sessionTokens.push({ type: 'Amit Patel (multiple items)', token: userSession3Token });

  // Additional real-like users
  const userSession4Token = sessionModel.generateSessionToken();
  const userSession4 = await sessionModel.create({
    userId: 'kavita_singh_101',
    sessionToken: userSession4Token,
    expiresAt: sessionModel.calculateExpiryDate(24)
  });
  sessionTokens.push({ type: 'Kavita Singh (fashion items)', token: userSession4Token });

  const userSession5Token = sessionModel.generateSessionToken();
  const userSession5 = await sessionModel.create({
    userId: 'rahul_gupta_202',
    sessionToken: userSession5Token,
    expiresAt: sessionModel.calculateExpiryDate(48)
  });
  sessionTokens.push({ type: 'Rahul Gupta (electronics)', token: userSession5Token });

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

  // User cart 1 - Active with items (Rajesh Kumar)
  const userCart1 = await prisma.cart.create({
    data: {
      sessionId: userSession1.id,
      userId: 'rajesh_kumar_123',
      status: 'ACTIVE',
      metadata: {
        create: [
          { key: 'source', value: 'mobile_app' },
          { key: 'device', value: 'android' },
          { key: 'app_version', value: '2.1.0' }
        ]
      }
    }
  });

  // User cart 2 - Checkout status (Priya Sharma)
  const userCart2 = await prisma.cart.create({
    data: {
      sessionId: userSession2.id,
      userId: 'priya_sharma_456',
      status: 'CHECKOUT',
      metadata: {
        create: [
          { key: 'source', value: 'web' },
          { key: 'device', value: 'desktop' },
          { key: 'checkout_started', value: new Date().toISOString() }
        ]
      }
    }
  });

  // User cart 3 - Multiple items (Amit Patel)
  const userCart3 = await prisma.cart.create({
    data: {
      sessionId: userSession3.id,
      userId: 'amit_patel_789',
      status: 'ACTIVE',
      metadata: {
        create: [
          { key: 'source', value: 'web' },
          { key: 'device', value: 'desktop' }
        ]
      }
    }
  });

  // User cart 4 - Fashion items (Kavita Singh)
  const userCart4 = await prisma.cart.create({
    data: {
      sessionId: userSession4.id,
      userId: 'kavita_singh_101',
      status: 'ACTIVE',
      metadata: {
        create: [
          { key: 'source', value: 'mobile_app' },
          { key: 'device', value: 'ios' }
        ]
      }
    }
  });

  // User cart 5 - Electronics (Rahul Gupta)
  const userCart5 = await prisma.cart.create({
    data: {
      sessionId: userSession5.id,
      userId: 'rahul_gupta_202',
      status: 'ACTIVE',
      metadata: {
        create: [
          { key: 'source', value: 'web' },
          { key: 'device', value: 'mobile' }
        ]
      }
    }
  });

  console.log('✅ Created 7 carts with various statuses');
  console.log('');

  // Create cart items with real-like Indian products (prices in INR)
  console.log('📦 Creating cart items with Indian products...');
  await prisma.cartItem.createMany({
    data: [
      // Guest Cart 1 - Electronics (INR prices)
      {
        cartId: guestCart1.id,
        productId: 'laptop_dell_inspiron_15',
        variantId: '16gb_512gb',
        quantity: 1,
        price: 54990.00, // ₹54,990
        originalPrice: 64990.00
      },
      {
        cartId: guestCart1.id,
        productId: 'mouse_logitech_mx',
        variantId: 'wireless_black',
        quantity: 2,
        price: 2999.00, // ₹2,999
        originalPrice: 3499.00
      },

      // User Cart 1 (Rajesh Kumar) - Clothing & Fashion (INR prices)
      {
        cartId: userCart1.id,
        productId: 'levis_501_jeans',
        variantId: 'blue_32_waist',
        quantity: 2,
        price: 3999.00, // ₹3,999
        originalPrice: 4999.00
      },
      {
        cartId: userCart1.id,
        productId: 'allen_solly_shirt',
        variantId: 'white_medium',
        quantity: 3,
        price: 1799.00, // ₹1,799
        originalPrice: 2299.00
      },
      {
        cartId: userCart1.id,
        productId: 'nike_air_max_shoes',
        variantId: 'black_10',
        quantity: 1,
        price: 8999.00, // ₹8,999
        originalPrice: 10999.00
      },

      // User Cart 2 (Priya Sharma) - Checkout (Home & Kitchen)
      {
        cartId: userCart2.id,
        productId: 'prestige_cookware_set',
        variantId: 'non_stick_7pcs',
        quantity: 1,
        price: 3499.00, // ₹3,499
        originalPrice: 4499.00
      },
      {
        cartId: userCart2.id,
        productId: 'philips_mixer_grinder',
        variantId: '750w_3jar',
        quantity: 1,
        price: 4999.00, // ₹4,999
        originalPrice: 5999.00
      },
      {
        cartId: userCart2.id,
        productId: 'lenovo_tab_m10',
        variantId: '64gb_wifi',
        quantity: 1,
        price: 12999.00, // ₹12,999
        originalPrice: 15999.00
      },

      // User Cart 3 (Amit Patel) - Electronics & Accessories (INR prices)
      {
        cartId: userCart3.id,
        productId: 'samsung_galaxy_s23',
        variantId: '128gb_phantom_black',
        quantity: 1,
        price: 74999.00, // ₹74,999
        originalPrice: 84999.00
      },
      {
        cartId: userCart3.id,
        productId: 'spigen_phone_case',
        variantId: 'clear_galaxy_s23',
        quantity: 2,
        price: 1499.00, // ₹1,499
        originalPrice: 1999.00
      },
      {
        cartId: userCart3.id,
        productId: 'samsung_45w_charger',
        variantId: 'usb_c_fast',
        quantity: 1,
        price: 3499.00, // ₹3,499
        originalPrice: 3999.00
      },
      {
        cartId: userCart3.id,
        productId: 'tempered_glass_screen',
        variantId: 'galaxy_s23_protector',
        quantity: 3,
        price: 299.00, // ₹299
        originalPrice: 499.00
      },
      {
        cartId: userCart3.id,
        productId: 'oneplus_buds_pro',
        variantId: 'white_noise_cancel',
        quantity: 1,
        price: 9999.00, // ₹9,999
        originalPrice: 11999.00
      },

      // User Cart 4 (Kavita Singh) - Fashion & Accessories (INR prices)
      {
        cartId: userCart4.id,
        productId: 'levis_women_jeans',
        variantId: 'skinny_28_blue',
        quantity: 1,
        price: 3499.00, // ₹3,499
        originalPrice: 4499.00
      },
      {
        cartId: userCart4.id,
        productId: 'zara_women_top',
        variantId: 'white_small',
        quantity: 2,
        price: 1799.00, // ₹1,799
        originalPrice: 2299.00
      },
      {
        cartId: userCart4.id,
        productId: 'puma_women_sneakers',
        variantId: 'pink_7',
        quantity: 1,
        price: 4999.00, // ₹4,999
        originalPrice: 6499.00
      },
      {
        cartId: userCart4.id,
        productId: 'fossil_women_watch',
        variantId: 'rose_gold_leather',
        quantity: 1,
        price: 8999.00, // ₹8,999
        originalPrice: 11999.00
      },

      // User Cart 5 (Rahul Gupta) - Electronics & Smart Home (INR prices)
      {
        cartId: userCart5.id,
        productId: 'mi_tv_55_inch',
        variantId: '4k_android',
        quantity: 1,
        price: 44999.00, // ₹44,999
        originalPrice: 54999.00
      },
      {
        cartId: userCart5.id,
        productId: 'amazon_echo_dot',
        variantId: 'gen_5_black',
        quantity: 2,
        price: 4999.00, // ₹4,999
        originalPrice: 5999.00
      },
      {
        cartId: userCart5.id,
        productId: 'philips_hue_bulbs',
        variantId: 'smart_white_2pack',
        quantity: 1,
        price: 2999.00, // ₹2,999
        originalPrice: 3999.00
      }
    ]
  });

  console.log('✅ Created 21 cart items across all carts');
  console.log('');

  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ DATABASE SEED COMPLETED SUCCESSFULLY!');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('📊 Summary:');
  console.log('   - 8 sessions (7 active, 1 expired)');
  console.log('   - 7 carts (6 ACTIVE, 1 CHECKOUT)');
  console.log('   - 21 cart items with Indian products (₹ prices)');
  console.log('   - Multiple users: rajesh_kumar_123, priya_sharma_456, amit_patel_789, kavita_singh_101, rahul_gupta_202');
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
