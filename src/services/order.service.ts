import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  Order,
  OrderStatus,
  PaymentStatus,
  ShippingStatus,
  CreateOrderRequest,
  UpdateOrderRequest,
  OrderResponse,
  OrderListResponse,
  OrderSearchFilters,
  OrderAnalytics,
  OrderEvent,
  OrderNotification
} from '../types/order.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OrderService {
  constructor(private readonly databaseService: DatabaseService) { }

  async createOrder(createOrderRequest: CreateOrderRequest): Promise<OrderResponse> {
    const { userId, sessionId, items, shippingAddress, billingAddress, paymentMethod, paymentProvider, shippingMethod, notes, metadata } = createOrderRequest;

    // Validate items
    if (!items || items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const tax = subtotal * 0.1; // 10% tax - should be calculated based on location
    const shipping = 10; // Fixed shipping cost - should be calculated based on method and location
    const discount = 0; // No discount for now
    const total = subtotal + tax + shipping - discount;

    // Generate order number
    const orderNumber = this.generateOrderNumber();

    // Create order items
    const orderItems = items.map(item => ({
      id: uuidv4(),
      orderId: '', // Will be set after order creation
      productId: item.productId,
      variantId: item.variantId,
      productName: '', // Should be fetched from product service
      productSku: '', // Should be fetched from product service
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.unitPrice * item.quantity,
      metadata: item.metadata,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    // Create order
    const order: Order = {
      id: uuidv4(),
      orderNumber,
      userId,
      sessionId,
      status: OrderStatus.PENDING,
      items: orderItems,
      totals: {
        subtotal,
        tax,
        shipping,
        discount,
        total,
        currency: 'USD'
      },
      payment: {
        id: uuidv4(),
        orderId: '', // Will be set after order creation
        paymentMethod,
        paymentProvider,
        transactionId: undefined,
        amount: total,
        currency: 'USD',
        status: PaymentStatus.PENDING,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      },
      shipping: {
        id: uuidv4(),
        orderId: '', // Will be set after order creation
        carrier: 'Standard',
        trackingNumber: undefined,
        status: ShippingStatus.PENDING,
        shippingAddress: { ...shippingAddress, id: uuidv4() },
        shippingMethod,
        shippingCost: shipping,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      },
      billingAddress: { ...billingAddress, id: uuidv4() },
      notes,
      metadata: metadata || {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Set order IDs for related entities
    order.items.forEach(item => item.orderId = order.id);
    order.payment.orderId = order.id;
    order.shipping.orderId = order.id;

    // Save to database
    await this.databaseService.order.create({
      data: {
        id: order.id,
        orderNumber: order.orderNumber,
        userId: order.userId,
        sessionId: order.sessionId,
        status: order.status,
        notes: order.notes,
        metadata: order.metadata,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        items: {
          create: order.items.map(item => ({
            id: item.id,
            productId: item.productId,
            variantId: item.variantId,
            productName: item.productName,
            productSku: item.productSku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            productImage: item.productImage,
            productUrl: item.productUrl,
            metadata: item.metadata,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
          }))
        },
        payment: {
          create: {
            id: order.payment.id,
            paymentMethod: order.payment.paymentMethod,
            paymentProvider: order.payment.paymentProvider,
            transactionId: order.payment.transactionId,
            amount: order.payment.amount,
            currency: order.payment.currency,
            status: order.payment.status,
            metadata: order.payment.metadata,
            createdAt: order.payment.createdAt,
            updatedAt: order.payment.updatedAt
          }
        },
        shipping: {
          create: {
            id: order.shipping.id,
            carrier: order.shipping.carrier,
            trackingNumber: order.shipping.trackingNumber,
            status: order.shipping.status,
            estimatedDelivery: order.shipping.estimatedDelivery,
            actualDelivery: order.shipping.actualDelivery,
            shippingAddress: order.shipping.shippingAddress,
            shippingMethod: order.shipping.shippingMethod,
            shippingCost: order.shipping.shippingCost,
            metadata: order.shipping.metadata,
            createdAt: order.shipping.createdAt,
            updatedAt: order.shipping.updatedAt
          }
        },
        billingAddress: {
          create: {
            id: uuidv4(),
            firstName: billingAddress.firstName,
            lastName: billingAddress.lastName,
            company: billingAddress.company,
            address1: billingAddress.address1,
            address2: billingAddress.address2,
            city: billingAddress.city,
            state: billingAddress.state,
            postalCode: billingAddress.postalCode,
            country: billingAddress.country,
            phone: billingAddress.phone,
            email: billingAddress.email,
            isDefault: billingAddress.isDefault
          }
        }
      }
    });

    // Log order creation event
    await this.logOrderEvent(order.id, 'created', { orderNumber, userId }, userId);

    return this.mapOrderToResponse(order);
  }

  async getOrderById(orderId: string): Promise<OrderResponse> {
    const order = await this.databaseService.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payment: true,
        shipping: true,
        billingAddress: true
      }
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    return this.mapOrderToResponse(order as Order);
  }

  async getOrderByNumber(orderNumber: string): Promise<OrderResponse> {
    const order = await this.databaseService.order.findUnique({
      where: { orderNumber },
      include: {
        items: true,
        payment: true,
        shipping: true,
        billingAddress: true
      }
    });

    if (!order) {
      throw new NotFoundException(`Order with number ${orderNumber} not found`);
    }

    return this.mapOrderToResponse(order as Order);
  }

  async getUserOrders(userId: string, filters: OrderSearchFilters = {}): Promise<OrderListResponse> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = filters;
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    if (filters.orderNumber) {
      where.orderNumber = { contains: filters.orderNumber, mode: 'insensitive' };
    }

    const [orders, total] = await Promise.all([
      this.databaseService.order.findMany({
        where,
        include: {
          items: true,
          payment: true,
          shipping: true,
          billingAddress: true
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit
      }),
      this.databaseService.order.count({ where })
    ]);

    return {
      orders: orders.map(order => this.mapOrderToResponse(order as Order)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async updateOrder(orderId: string, updateOrderRequest: UpdateOrderRequest): Promise<OrderResponse> {
    const order = await this.databaseService.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payment: true,
        shipping: true,
        billingAddress: true
      }
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Validate status transition
    if (updateOrderRequest.status && !this.isValidStatusTransition(order.status, updateOrderRequest.status)) {
      throw new BadRequestException(`Invalid status transition from ${order.status} to ${updateOrderRequest.status}`);
    }

    const updateData: any = {
      updatedAt: new Date()
    };

    if (updateOrderRequest.status) {
      updateData.status = updateOrderRequest.status;

      // Set completion date for certain statuses
      if (updateOrderRequest.status === OrderStatus.DELIVERED) {
        updateData.completedAt = new Date();
      }
      if (updateOrderRequest.status === OrderStatus.CANCELLED) {
        updateData.cancelledAt = new Date();
      }
    }

    if (updateOrderRequest.notes !== undefined) {
      updateData.notes = updateOrderRequest.notes;
    }

    if (updateOrderRequest.metadata) {
      updateData.metadata = { ...order.metadata, ...updateOrderRequest.metadata };
    }

    // Update shipping if tracking number provided
    if (updateOrderRequest.trackingNumber) {
      await this.databaseService.shipping.update({
        where: { orderId },
        data: {
          trackingNumber: updateOrderRequest.trackingNumber,
          updatedAt: new Date()
        }
      });
    }

    if (updateOrderRequest.shippingStatus) {
      await this.databaseService.shipping.update({
        where: { orderId },
        data: {
          status: updateOrderRequest.shippingStatus,
          updatedAt: new Date()
        }
      });
    }

    const updatedOrder = await this.databaseService.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        items: true,
        payment: true,
        shipping: true,
        billingAddress: true
      }
    });

    // Log order update event
    await this.logOrderEvent(orderId, 'updated', updateOrderRequest, order.userId);

    return this.mapOrderToResponse(updatedOrder as Order);
  }

  async cancelOrder(orderId: string, reason?: string): Promise<OrderResponse> {
    const order = await this.databaseService.order.findUnique({
      where: { id: orderId },
      include: { payment: true }
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Check if order can be cancelled
    if (!this.canCancelOrder(order.status, order.payment.status)) {
      throw new ConflictException(`Order cannot be cancelled in current status: ${order.status}`);
    }

    const updatedOrder = await this.databaseService.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        updatedAt: new Date(),
        notes: reason ? `${order.notes || ''}\nCancellation reason: ${reason}`.trim() : order.notes
      },
      include: {
        items: true,
        payment: true,
        shipping: true,
        billingAddress: true
      }
    });

    // Log cancellation event
    await this.logOrderEvent(orderId, 'cancelled', { reason }, order.userId);

    return this.mapOrderToResponse(updatedOrder as Order);
  }

  async getOrderAnalytics(filters: OrderSearchFilters = {}): Promise<OrderAnalytics> {
    const where: any = {};

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    const [
      totalOrders,
      orders,
      ordersByStatus,
      ordersByPaymentStatus,
      ordersByShippingStatus,
      topProducts
    ] = await Promise.all([
      this.databaseService.order.count({ where }),
      this.databaseService.order.findMany({
        where,
        include: { items: true, payment: true, shipping: true }
      }),
      this.databaseService.order.groupBy({
        by: ['status'],
        where,
        _count: { status: true }
      }),
      this.databaseService.payment.groupBy({
        by: ['status'],
        where: { order: where },
        _count: { status: true }
      }),
      this.databaseService.shipping.groupBy({
        by: ['status'],
        where: { order: where },
        _count: { status: true }
      }),
      this.databaseService.orderItem.groupBy({
        by: ['productId'],
        where: { order: where },
        _sum: { quantity: true, totalPrice: true },
        _count: { productId: true }
      })
    ]);

    const totalRevenue = orders.reduce((sum, order) => sum + order.totals.total, 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalOrders,
      totalRevenue,
      averageOrderValue,
      ordersByStatus: this.mapGroupByToRecord(ordersByStatus, 'status'),
      ordersByPaymentStatus: this.mapGroupByToRecord(ordersByPaymentStatus, 'status'),
      ordersByShippingStatus: this.mapGroupByToRecord(ordersByShippingStatus, 'status'),
      topProducts: topProducts.map(product => ({
        productId: product.productId,
        productName: '', // Should be fetched from product service
        quantity: product._sum.quantity || 0,
        revenue: product._sum.totalPrice || 0
      })),
      ordersByDateRange: [] // Should be calculated based on date range
    };
  }

  async searchOrders(filters: OrderSearchFilters): Promise<OrderListResponse> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.status) where.status = filters.status;
    if (filters.orderNumber) where.orderNumber = { contains: filters.orderNumber, mode: 'insensitive' };
    if (filters.productId) {
      where.items = { some: { productId: filters.productId } };
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    const [orders, total] = await Promise.all([
      this.databaseService.order.findMany({
        where,
        include: {
          items: true,
          payment: true,
          shipping: true,
          billingAddress: true
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit
      }),
      this.databaseService.order.count({ where })
    ]);

    return {
      orders: orders.map(order => this.mapOrderToResponse(order as Order)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `ORD-${timestamp}-${random}`.toUpperCase();
  }

  private isValidStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): boolean {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED, OrderStatus.FAILED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REFUNDED]: [],
      [OrderStatus.FAILED]: [OrderStatus.CONFIRMED]
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  private canCancelOrder(orderStatus: OrderStatus, paymentStatus: PaymentStatus): boolean {
    const cancellableStatuses = [OrderStatus.PENDING, OrderStatus.CONFIRMED];
    const cancellablePaymentStatuses = [PaymentStatus.PENDING, PaymentStatus.PROCESSING];

    return cancellableStatuses.includes(orderStatus) && cancellablePaymentStatuses.includes(paymentStatus);
  }

  private async logOrderEvent(orderId: string, eventType: string, eventData: any, userId: string): Promise<void> {
    await this.databaseService.orderEvent.create({
      data: {
        id: uuidv4(),
        orderId,
        eventType,
        eventData,
        userId,
        createdAt: new Date()
      }
    });
  }

  private mapOrderToResponse(order: Order): OrderResponse {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      status: order.status,
      items: order.items,
      totals: order.totals,
      payment: {
        id: order.payment.id,
        status: order.payment.status,
        amount: order.payment.amount,
        currency: order.payment.currency,
        method: order.payment.paymentMethod,
        provider: order.payment.paymentProvider,
        transactionId: order.payment.transactionId
      },
      shipping: {
        id: order.shipping.id,
        status: order.shipping.status,
        carrier: order.shipping.carrier,
        trackingNumber: order.shipping.trackingNumber,
        estimatedDelivery: order.shipping.estimatedDelivery,
        actualDelivery: order.shipping.actualDelivery
      },
      addresses: {
        shipping: order.shipping.shippingAddress,
        billing: order.billingAddress
      },
      notes: order.notes,
      metadata: order.metadata,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      completedAt: order.completedAt
    };
  }

  private mapGroupByToRecord(groupByResult: any[], key: string): Record<string, number> {
    return groupByResult.reduce((acc, item) => {
      acc[item[key]] = item._count[key];
      return acc;
    }, {});
  }
}