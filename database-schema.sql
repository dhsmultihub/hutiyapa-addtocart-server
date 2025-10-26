-- Add-to-Cart Microservice Database Schema
-- Enterprise-grade schema for cart management with PostgreSQL
-- Run this in your Neon database editor

-- Create enum for cart status
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CHECKOUT', 'ABANDONED', 'COMPLETED', 'EXPIRED');

-- Create cart_sessions table
CREATE TABLE "cart_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_sessions_pkey" PRIMARY KEY ("id")
);

-- Create carts table
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- Create cart_items table
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(10,2) NOT NULL,
    "originalPrice" DECIMAL(10,2),
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- Create cart_metadata table
CREATE TABLE "cart_metadata" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_metadata_pkey" PRIMARY KEY ("id")
);

-- Create indexes for cart_sessions
CREATE UNIQUE INDEX "cart_sessions_sessionToken_key" ON "cart_sessions"("sessionToken");
CREATE INDEX "cart_sessions_userId_idx" ON "cart_sessions"("userId");
CREATE INDEX "cart_sessions_expiresAt_idx" ON "cart_sessions"("expiresAt");

-- Create indexes for carts
CREATE INDEX "carts_sessionId_idx" ON "carts"("sessionId");
CREATE INDEX "carts_userId_idx" ON "carts"("userId");
CREATE INDEX "carts_status_idx" ON "carts"("status");
CREATE INDEX "carts_createdAt_idx" ON "carts"("createdAt");

-- Create indexes for cart_items
CREATE INDEX "cart_items_cartId_idx" ON "cart_items"("cartId");
CREATE INDEX "cart_items_productId_idx" ON "cart_items"("productId");
CREATE INDEX "cart_items_variantId_idx" ON "cart_items"("variantId");
CREATE INDEX "cart_items_addedAt_idx" ON "cart_items"("addedAt");
CREATE UNIQUE INDEX "cart_items_cartId_productId_variantId_key" ON "cart_items"("cartId", "productId", "variantId");

-- Create indexes for cart_metadata
CREATE INDEX "cart_metadata_cartId_idx" ON "cart_metadata"("cartId");
CREATE INDEX "cart_metadata_key_idx" ON "cart_metadata"("key");
CREATE UNIQUE INDEX "cart_metadata_cartId_key_key" ON "cart_metadata"("cartId", "key");

-- Add foreign key constraints
ALTER TABLE "carts" ADD CONSTRAINT "carts_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "cart_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cart_metadata" ADD CONSTRAINT "cart_metadata_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Insert sample data for testing
INSERT INTO "cart_sessions" ("id", "userId", "sessionToken", "expiresAt", "createdAt", "updatedAt") VALUES
('session_guest_001', NULL, 'cart_guest_1234567890_abc123def', NOW() + INTERVAL '24 hours', NOW(), NOW()),
('session_user_001', 'user_123', 'cart_user_1234567890_xyz789ghi', NOW() + INTERVAL '24 hours', NOW(), NOW()),
('session_expired_001', 'user_456', 'cart_expired_1234567890_mno456pqr', NOW() - INTERVAL '24 hours', NOW() - INTERVAL '25 hours', NOW() - INTERVAL '25 hours');

INSERT INTO "carts" ("id", "sessionId", "userId", "status", "createdAt", "updatedAt") VALUES
('cart_guest_001', 'session_guest_001', NULL, 'ACTIVE', NOW(), NOW()),
('cart_user_001', 'session_user_001', 'user_123', 'ACTIVE', NOW(), NOW());

INSERT INTO "cart_items" ("id", "cartId", "productId", "variantId", "quantity", "price", "originalPrice", "addedAt", "updatedAt") VALUES
('item_001', 'cart_guest_001', 'prod_001', 'var_001', 2, 29.99, 39.99, NOW(), NOW()),
('item_002', 'cart_guest_001', 'prod_002', NULL, 1, 15.50, 15.50, NOW(), NOW()),
('item_003', 'cart_user_001', 'prod_003', 'var_002', 3, 45.00, 50.00, NOW(), NOW());

INSERT INTO "cart_metadata" ("id", "cartId", "key", "value", "createdAt") VALUES
('meta_001', 'cart_guest_001', 'source', 'web', NOW()),
('meta_002', 'cart_guest_001', 'device', 'desktop', NOW()),
('meta_003', 'cart_user_001', 'source', 'mobile', NOW()),
('meta_004', 'cart_user_001', 'device', 'ios', NOW());

-- Verify the setup
SELECT 'Database schema created successfully!' as status;
SELECT COUNT(*) as total_sessions FROM "cart_sessions";
SELECT COUNT(*) as total_carts FROM "carts";
SELECT COUNT(*) as total_items FROM "cart_items";
SELECT COUNT(*) as total_metadata FROM "cart_metadata";
