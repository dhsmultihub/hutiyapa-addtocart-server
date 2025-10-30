# Add-to-Cart Service - Database Seed & API Testing Guide

## Prerequisites

1. **PostgreSQL Database Running**
   - Ensure PostgreSQL is running on `localhost:5432`
   - Database name: `hutiyapa_cart` (or update DATABASE_URL)
   - Username/password configured

2. **Environment Setup**
   - Create a `.env` file in the server root with:
   ```env
   PORT=8000
   DATABASE_URL="postgresql://postgres:password@localhost:5432/hutiyapa_cart?schema=public"
   REDIS_URL="redis://localhost:6379"
   JWT_SECRET="dev-jwt-secret-123"
   NODE_ENV="development"
   ```

3. **Dependencies Installed**
   ```bash
   npm install
   ```

## Step 1: Setup Database Schema

Run Prisma migrations to create the database tables:

```bash
cd D:\HUTIYAPA\HUTIYAPA\addtocart-hutiyapa\hutiyapa-addtocart-server
npx prisma migrate dev --name init
npx prisma generate
```

## Step 2: Seed the Database

Populate the database with comprehensive test data:

```bash
npm run seed
```

**Expected Output:**
- 6 sessions created (5 active, 1 expired)
- 5 carts with different statuses
- 11 cart items with diverse products
- 13 metadata entries
- Session tokens displayed for API testing

**Sample Session Tokens:**
The seed script will output session tokens like:
```
Guest 1 (with cart): sess_abc123...
User John (active cart): sess_def456...
User Jane (checkout cart): sess_ghi789...
```

**💡 Save these tokens** - you'll need them for manual API testing!

## Step 3: Start the Server

In a separate terminal:

```bash
npm run dev
# or
npm start
```

The server should start on port **8000** with output:
```
🚀 Add-to-Cart Microservice running on port 8000
📊 Environment: development
🔗 Health check: http://localhost:8000/api/v1/health
```

## Step 4: Run Comprehensive API Tests

With the server running, execute the automated test suite:

```bash
node test-all-apis.js
```

### Tests Covered:

#### **Health & Session Management**
1. ✅ Health Check - Monitoring Service
2. ✅ Create Cart Session
3. ✅ Get Cart (Empty)

#### **Cart Operations**
4. ✅ Add Item to Cart
5. ✅ Add Multiple Items (Bulk)
6. ✅ Get Cart (With Items)
7. ✅ Update Cart Item Quantity
8. ✅ Validate Cart

#### **Checkout Flow**
9. ✅ Initialize Checkout
10. ✅ Get Shipping Options
11. ✅ Calculate Shipping Cost
12. ✅ Calculate Tax
13. ✅ Validate Discount Coupon

#### **Service Health Checks**
14. ✅ Pricing Service Health Check
15. ✅ Cart Service Health Check

#### **Cleanup Operations**
16. ✅ Remove Item from Cart
17. ✅ Clear Cart

### Test Results

After running, check:
- **Console output** for real-time test results
- **`api-test-results.json`** for detailed JSON report

## Step 5: Manual API Testing (Optional)

Use the session tokens from seed output to test APIs manually with tools like:
- **cURL**
- **Postman**
- **Thunder Client (VS Code)**
- **Insomnia**

### Example cURL Commands:

**Get Cart:**
```bash
curl -X GET http://localhost:8000/api/v1/cart \
  -H "x-session-token: YOUR_SESSION_TOKEN_HERE"
```

**Add Item to Cart:**
```bash
curl -X POST http://localhost:8000/api/v1/cart/items \
  -H "x-session-token: YOUR_SESSION_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "prod_new_001",
    "variantId": "var_new_001",
    "quantity": 2,
    "price": 99.99,
    "originalPrice": 129.99
  }'
```

**Get Shipping Options:**
```bash
curl -X GET http://localhost:8000/api/v1/checkout/shipping/options
```

## Troubleshooting

### Database Connection Issues
```bash
# Test database connection
psql -U postgres -d hutiyapa_cart -c "SELECT 1;"

# Reset database
npx prisma migrate reset
npm run seed
```

### Port Already in Use
```bash
# Find process on port 8000 (Windows)
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Or change PORT in .env file
```

### Prisma Client Issues
```bash
# Regenerate Prisma client
npx prisma generate
npm run build
```

### Redis Connection Issues
- Ensure Redis server is running: `redis-server`
- Or comment out Redis-dependent features temporarily

## Key Endpoints Reference

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/v1/health` | GET | Health check | No |
| `/api/v1/cart` | GET | Get cart | Session token |
| `/api/v1/cart/items` | POST | Add item | Session token |
| `/api/v1/cart/items/:id` | PATCH | Update item | Session token |
| `/api/v1/cart/items/:id` | DELETE | Remove item | Session token |
| `/api/v1/cart` | DELETE | Clear cart | Session token |
| `/api/v1/cart/session` | POST | Create session | Optional user ID |
| `/api/v1/cart/bulk/items` | POST | Add multiple items | Session token |
| `/api/v1/cart/validate` | GET | Validate cart | Session token |
| `/api/v1/checkout/initialize` | POST | Start checkout | JWT required |
| `/api/v1/checkout/shipping/options` | GET | Shipping options | No |
| `/api/v1/checkout/shipping/calculate` | POST | Calculate shipping | No |
| `/api/v1/checkout/tax/calculate` | POST | Calculate tax | No |
| `/api/v1/checkout/discount/validate` | POST | Validate coupon | No |

## Success Criteria

✅ **Database seeded** with 6 sessions, 5 carts, 11 items  
✅ **Server running** on port 8000  
✅ **All API tests passing** (17/17 tests)  
✅ **Test report generated** in `api-test-results.json`  

---

**📝 Note:** User preference requires not running terminal commands automatically. Please execute the commands above manually as needed.

