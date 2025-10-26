# 🛒 Add-to-Cart Service API Documentation

## Overview

The Add-to-Cart Service is a comprehensive microservice that handles cart operations, inventory management, pricing calculations, and checkout preparation. This API provides endpoints for managing shopping carts, processing checkouts, managing orders, and monitoring system health.

## Base URL

```
http://localhost:8000/api/v1
```

## Authentication

Most endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <jwt-token>
```

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

## Cart Management

### Create Cart
Create a new shopping cart for a user.

**Endpoint:** `POST /cart`

**Request Body:**
```json
{
  "userId": "string",
  "sessionId": "string"
}
```

**Response:**
```json
{
  "id": "cart-123",
  "userId": "user-456",
  "sessionId": "session-789",
  "items": [],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### Get Cart
Retrieve a cart by ID.

**Endpoint:** `GET /cart/{cartId}`

**Response:**
```json
{
  "id": "cart-123",
  "userId": "user-456",
  "sessionId": "session-789",
  "items": [
    {
      "id": "item-123",
      "productId": "product-456",
      "variantId": "variant-789",
      "quantity": 2,
      "price": 29.99,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### Add Item to Cart
Add a product to the cart.

**Endpoint:** `POST /cart/{cartId}/items`

**Request Body:**
```json
{
  "productId": "string",
  "variantId": "string",
  "quantity": "number",
  "price": "number"
}
```

**Response:**
```json
{
  "id": "cart-123",
  "userId": "user-456",
  "sessionId": "session-789",
  "items": [
    {
      "id": "item-123",
      "productId": "product-456",
      "variantId": "variant-789",
      "quantity": 2,
      "price": 29.99,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### Update Cart Item
Update the quantity of an item in the cart.

**Endpoint:** `PATCH /cart/{cartId}/items/{itemId}`

**Request Body:**
```json
{
  "quantity": "number"
}
```

### Remove Item from Cart
Remove an item from the cart.

**Endpoint:** `DELETE /cart/{cartId}/items/{itemId}`

### Clear Cart
Remove all items from the cart.

**Endpoint:** `DELETE /cart/{cartId}/items`

### Get Cart Totals
Get calculated totals for the cart.

**Endpoint:** `GET /cart/{cartId}/totals`

**Response:**
```json
{
  "subtotal": 59.98,
  "tax": 4.80,
  "discount": 0,
  "total": 64.78,
  "itemCount": 2
}
```

### Get User Carts
Get all carts for a user.

**Endpoint:** `GET /cart/user/{userId}`

### Delete Cart
Delete a cart and all its items.

**Endpoint:** `DELETE /cart/{cartId}`

## Checkout Process

### Create Checkout Session
Create a new checkout session.

**Endpoint:** `POST /checkout/session`

**Request Body:**
```json
{
  "cartId": "string",
  "userId": "string"
}
```

**Response:**
```json
{
  "sessionId": "checkout-session-123",
  "status": "pending",
  "cart": { ... },
  "totals": { ... },
  "expiresAt": "2024-01-01T01:00:00Z"
}
```

### Get Checkout Session
Retrieve checkout session details.

**Endpoint:** `GET /checkout/session/{sessionId}`

### Process Checkout
Process the checkout and create an order.

**Endpoint:** `POST /checkout/process`

**Request Body:**
```json
{
  "sessionId": "string",
  "paymentMethod": "credit_card",
  "shippingAddress": {
    "firstName": "John",
    "lastName": "Doe",
    "address1": "123 Main St",
    "address2": "Apt 4B",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "US",
    "phone": "+1234567890",
    "email": "john@example.com"
  },
  "billingAddress": {
    "firstName": "John",
    "lastName": "Doe",
    "address1": "123 Main St",
    "address2": "Apt 4B",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "US",
    "phone": "+1234567890",
    "email": "john@example.com"
  }
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "order-123",
  "orderNumber": "ORD-2024-001",
  "status": "pending",
  "paymentIntentId": "pi_1234567890"
}
```

## Order Management

### Get User Orders
Get all orders for a user.

**Endpoint:** `GET /orders`

**Query Parameters:**
- `userId` (required): User ID
- `status` (optional): Filter by order status
- `limit` (optional): Number of orders to return (default: 20)
- `offset` (optional): Number of orders to skip (default: 0)

### Get Order by ID
Get order details by ID.

**Endpoint:** `GET /orders/{orderId}`

**Response:**
```json
{
  "id": "order-123",
  "orderNumber": "ORD-2024-001",
  "userId": "user-456",
  "status": "pending",
  "items": [
    {
      "id": "order-item-123",
      "productId": "product-456",
      "variantId": "variant-789",
      "quantity": 2,
      "unitPrice": 29.99,
      "totalPrice": 59.98
    }
  ],
  "totals": {
    "subtotal": 59.98,
    "tax": 4.80,
    "discount": 0,
    "shipping": 5.99,
    "total": 70.77
  },
  "shippingAddress": { ... },
  "billingAddress": { ... },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### Update Order Status
Update the status of an order.

**Endpoint:** `PATCH /orders/{orderId}`

**Request Body:**
```json
{
  "status": "processing"
}
```

### Cancel Order
Cancel an order.

**Endpoint:** `DELETE /orders/{orderId}`

## Pricing Engine

### Calculate Pricing
Calculate pricing for items with discounts and taxes.

**Endpoint:** `POST /pricing/calculate`

**Request Body:**
```json
{
  "items": [
    {
      "productId": "string",
      "variantId": "string",
      "quantity": "number",
      "unitPrice": "number"
    }
  ],
  "userId": "string",
  "sessionId": "string",
  "currency": "USD",
  "shippingAddress": { ... },
  "couponCode": "string"
}
```

**Response:**
```json
{
  "breakdown": {
    "subtotal": 59.98,
    "taxTotal": 4.80,
    "discountTotal": 5.99,
    "shippingTotal": 5.99,
    "total": 64.78
  },
  "appliedDiscounts": [
    {
      "type": "coupon",
      "code": "SAVE10",
      "amount": 5.99
    }
  ],
  "taxBreakdown": [
    {
      "type": "sales_tax",
      "rate": 0.08,
      "amount": 4.80
    }
  ]
}
```

### Get Discounts
Get available discounts.

**Endpoint:** `GET /pricing/discounts`

### Get Tax Rates
Get tax rates for different locations.

**Endpoint:** `GET /pricing/tax-rates`

## Session Management

### Create Session
Create a new user session.

**Endpoint:** `POST /session`

**Request Body:**
```json
{
  "userId": "string",
  "deviceInfo": {
    "userAgent": "string",
    "platform": "web",
    "deviceId": "string"
  }
}
```

**Response:**
```json
{
  "sessionId": "session-123",
  "token": "jwt-token",
  "expiresAt": "2024-01-01T01:00:00Z",
  "deviceInfo": { ... }
}
```

### Get Session
Get session details.

**Endpoint:** `GET /session/{sessionId}`

### Update Session
Update session information.

**Endpoint:** `PATCH /session/{sessionId}`

### Delete Session
Delete a session.

**Endpoint:** `DELETE /session/{sessionId}`

## Health Monitoring

### Get Health Status
Get overall system health.

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "healthy",
  "checks": [
    {
      "name": "database",
      "status": "healthy",
      "message": "Database is healthy",
      "duration": 45,
      "timestamp": "2024-01-01T00:00:00Z"
    }
  ],
  "timestamp": "2024-01-01T00:00:00Z",
  "duration": 120,
  "version": "1.0.0",
  "uptime": 3600000
}
```

### Get Detailed Health
Get detailed health information.

**Endpoint:** `GET /health/detailed`

### Get Database Health
Get database health status.

**Endpoint:** `GET /health/database`

### Get Redis Health
Get Redis cache health status.

**Endpoint:** `GET /health/redis`

### Get System Health
Get system resource health.

**Endpoint:** `GET /health/system`

## Error Codes

| Code | Description |
|------|-------------|
| `CART_NOT_FOUND` | Cart with specified ID not found |
| `ITEM_NOT_FOUND` | Item not found in cart |
| `INVALID_QUANTITY` | Invalid quantity value |
| `PRODUCT_NOT_FOUND` | Product not found |
| `INSUFFICIENT_STOCK` | Not enough stock available |
| `CHECKOUT_SESSION_EXPIRED` | Checkout session has expired |
| `PAYMENT_FAILED` | Payment processing failed |
| `ORDER_NOT_FOUND` | Order not found |
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Access denied |
| `VALIDATION_ERROR` | Request validation failed |
| `INTERNAL_ERROR` | Internal server error |

## Rate Limiting

The API implements rate limiting to ensure fair usage:

- **General endpoints**: 1000 requests per hour per IP
- **Cart operations**: 100 requests per minute per user
- **Checkout operations**: 10 requests per minute per user
- **Health endpoints**: 100 requests per minute per IP

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Pagination

List endpoints support pagination:

**Query Parameters:**
- `limit`: Number of items per page (default: 20, max: 100)
- `offset`: Number of items to skip (default: 0)

**Response Headers:**
```
X-Total-Count: 150
X-Page-Limit: 20
X-Page-Offset: 0
```

## Webhooks

The service can send webhooks for important events:

### Cart Events
- `cart.created`
- `cart.updated`
- `cart.item.added`
- `cart.item.updated`
- `cart.item.removed`
- `cart.cleared`
- `cart.deleted`

### Order Events
- `order.created`
- `order.updated`
- `order.cancelled`
- `order.completed`

### Checkout Events
- `checkout.session.created`
- `checkout.session.updated`
- `checkout.session.expired`
- `checkout.completed`
- `checkout.failed`

## SDK Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

const cartApi = axios.create({
  baseURL: 'http://localhost:8000/api/v1',
  headers: {
    'Authorization': 'Bearer your-jwt-token',
    'Content-Type': 'application/json'
  }
});

// Create cart
const cart = await cartApi.post('/cart', {
  userId: 'user-123',
  sessionId: 'session-456'
});

// Add item
await cartApi.post(`/cart/${cart.data.id}/items`, {
  productId: 'product-123',
  variantId: 'variant-456',
  quantity: 2,
  price: 29.99
});
```

### Python
```python
import requests

class CartAPI:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    
    def create_cart(self, user_id, session_id):
        response = requests.post(
            f'{self.base_url}/cart',
            json={'userId': user_id, 'sessionId': session_id},
            headers=self.headers
        )
        return response.json()
    
    def add_item(self, cart_id, product_id, variant_id, quantity, price):
        response = requests.post(
            f'{self.base_url}/cart/{cart_id}/items',
            json={
                'productId': product_id,
                'variantId': variant_id,
                'quantity': quantity,
                'price': price
            },
            headers=self.headers
        )
        return response.json()

# Usage
api = CartAPI('http://localhost:8000/api/v1', 'your-jwt-token')
cart = api.create_cart('user-123', 'session-456')
```

## Testing

### Test Environment
Use the test environment for development and testing:
```
https://test-api.addtocart.com/api/v1
```

### Postman Collection
Import the Postman collection for easy API testing:
```
https://api.addtocart.com/docs/postman-collection.json
```

### cURL Examples
```bash
# Create cart
curl -X POST http://localhost:8000/api/v1/cart \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"userId": "user-123", "sessionId": "session-456"}'

# Add item to cart
curl -X POST http://localhost:8000/api/v1/cart/cart-123/items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"productId": "product-123", "variantId": "variant-456", "quantity": 2, "price": 29.99}'
```

## Support

For API support and questions:
- **Documentation**: https://docs.addtocart.com
- **Status Page**: https://status.addtocart.com
- **Support Email**: support@addtocart.com
- **GitHub Issues**: https://github.com/addtocart/api/issues
