import { CartStatus } from '../../types/cart.types';

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
