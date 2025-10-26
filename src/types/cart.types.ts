// Cart Types and Interfaces
// TypeScript definitions for cart-related entities

export interface CartItem {
  id: string;
  cartId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  price: number;
  originalPrice?: number;
  addedAt: Date;
  updatedAt: Date;
}

export interface CartMetadata {
  id: string;
  cartId: string;
  key: string;
  value: string;
  createdAt: Date;
}

export interface CartSession {
  id: string;
  userId?: string;
  sessionToken: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Cart {
  id: string;
  sessionId: string;
  userId?: string;
  status: CartStatus;
  createdAt: Date;
  updatedAt: Date;
  items: CartItem[];
  metadata: CartMetadata[];
  session: CartSession;
}

export enum CartStatus {
  ACTIVE = 'ACTIVE',
  CHECKOUT = 'CHECKOUT',
  ABANDONED = 'ABANDONED',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED'
}

// DTOs for API requests/responses
export interface AddItemDto {
  productId: string;
  variantId?: string;
  quantity: number;
  metadata?: Record<string, string>;
}

export interface UpdateItemDto {
  quantity: number;
  metadata?: Record<string, string>;
}

export interface CartResponseDto {
  id: string;
  userId?: string;
  status: CartStatus;
  items: CartItemResponseDto[];
  totals: CartTotalsDto;
  metadata: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItemResponseDto {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  price: number;
  originalPrice?: number;
  total: number;
  addedAt: Date;
}

export interface CartTotalsDto {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  itemCount: number;
}

// Database operation types
export interface CreateCartDto {
  sessionId: string;
  userId?: string;
  metadata?: Record<string, string>;
}

export interface UpdateCartDto {
  status?: CartStatus;
  metadata?: Record<string, string>;
}

// Session management types
export interface CreateSessionDto {
  userId?: string;
  sessionToken: string;
  expiresAt: Date;
}

export interface SessionContext {
  sessionId: string;
  userId?: string;
  isGuest: boolean;
  expiresAt: Date;
}

// Error types
export interface CartError {
  code: string;
  message: string;
  details?: any;
}

export class CartServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'CartServiceError';
  }
}
