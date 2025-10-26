import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    HttpStatus,
    HttpCode,
    ParseUUIDPipe,
    ParseIntPipe,
    DefaultValuePipe
} from '@nestjs/common';
import { OrderService } from '../services/order.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
    CreateOrderRequest,
    UpdateOrderRequest,
    OrderResponse,
    OrderListResponse,
    OrderSearchFilters,
    OrderAnalytics,
    OrderStatus,
    PaymentStatus,
    ShippingStatus
} from '../types/order.types';

@Controller('api/v1/orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
    constructor(private readonly orderService: OrderService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createOrder(
        @Body() createOrderRequest: CreateOrderRequest,
        @Request() req: any
    ): Promise<OrderResponse> {
        // Ensure the user ID matches the authenticated user
        createOrderRequest.userId = req.user.id;

        return await this.orderService.createOrder(createOrderRequest);
    }

    @Get(':id')
    async getOrderById(
        @Param('id', ParseUUIDPipe) orderId: string,
        @Request() req: any
    ): Promise<OrderResponse> {
        const order = await this.orderService.getOrderById(orderId);

        // Ensure user can only access their own orders (unless admin)
        if (order.userId !== req.user.id && !req.user.roles?.includes('admin')) {
            throw new Error('Unauthorized to access this order');
        }

        return order;
    }

    @Get('number/:orderNumber')
    async getOrderByNumber(
        @Param('orderNumber') orderNumber: string,
        @Request() req: any
    ): Promise<OrderResponse> {
        const order = await this.orderService.getOrderByNumber(orderNumber);

        // Ensure user can only access their own orders (unless admin)
        if (order.userId !== req.user.id && !req.user.roles?.includes('admin')) {
            throw new Error('Unauthorized to access this order');
        }

        return order;
    }

    @Get()
    async getUserOrders(
        @Request() req: any,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('status') status?: OrderStatus,
        @Query('paymentStatus') paymentStatus?: PaymentStatus,
        @Query('shippingStatus') shippingStatus?: ShippingStatus,
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string,
        @Query('orderNumber') orderNumber?: string,
        @Query('productId') productId?: string,
        @Query('sortBy') sortBy?: 'createdAt' | 'updatedAt' | 'total' | 'status',
        @Query('sortOrder') sortOrder?: 'asc' | 'desc'
    ): Promise<OrderListResponse> {
        const filters: OrderSearchFilters = {
            userId: req.user.id,
            page,
            limit,
            status,
            paymentStatus,
            shippingStatus,
            orderNumber,
            productId,
            sortBy,
            sortOrder,
            dateFrom: dateFrom ? new Date(dateFrom) : undefined,
            dateTo: dateTo ? new Date(dateTo) : undefined
        };

        return await this.orderService.getUserOrders(req.user.id, filters);
    }

    @Put(':id')
    async updateOrder(
        @Param('id', ParseUUIDPipe) orderId: string,
        @Body() updateOrderRequest: UpdateOrderRequest,
        @Request() req: any
    ): Promise<OrderResponse> {
        // First check if user can access this order
        const existingOrder = await this.orderService.getOrderById(orderId);

        if (existingOrder.userId !== req.user.id && !req.user.roles?.includes('admin')) {
            throw new Error('Unauthorized to update this order');
        }

        return await this.orderService.updateOrder(orderId, updateOrderRequest);
    }

    @Delete(':id/cancel')
    @HttpCode(HttpStatus.OK)
    async cancelOrder(
        @Param('id', ParseUUIDPipe) orderId: string,
        @Body() body: { reason?: string },
        @Request() req: any
    ): Promise<OrderResponse> {
        // First check if user can access this order
        const existingOrder = await this.orderService.getOrderById(orderId);

        if (existingOrder.userId !== req.user.id && !req.user.roles?.includes('admin')) {
            throw new Error('Unauthorized to cancel this order');
        }

        return await this.orderService.cancelOrder(orderId, body.reason);
    }

    @Get('analytics/overview')
    async getOrderAnalytics(
        @Request() req: any,
        @Query('userId') userId?: string,
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string
    ): Promise<OrderAnalytics> {
        // Only allow users to see their own analytics unless they're admin
        const targetUserId = req.user.roles?.includes('admin') ? userId : req.user.id;

        const filters: OrderSearchFilters = {
            userId: targetUserId,
            dateFrom: dateFrom ? new Date(dateFrom) : undefined,
            dateTo: dateTo ? new Date(dateTo) : undefined
        };

        return await this.orderService.getOrderAnalytics(filters);
    }

    @Get('search')
    async searchOrders(
        @Request() req: any,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('status') status?: OrderStatus,
        @Query('paymentStatus') paymentStatus?: PaymentStatus,
        @Query('shippingStatus') shippingStatus?: ShippingStatus,
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string,
        @Query('orderNumber') orderNumber?: string,
        @Query('productId') productId?: string,
        @Query('userId') userId?: string,
        @Query('sortBy') sortBy?: 'createdAt' | 'updatedAt' | 'total' | 'status',
        @Query('sortOrder') sortOrder?: 'asc' | 'desc'
    ): Promise<OrderListResponse> {
        // Only allow admin users to search all orders
        if (!req.user.roles?.includes('admin')) {
            throw new Error('Unauthorized to search all orders');
        }

        const filters: OrderSearchFilters = {
            page,
            limit,
            status,
            paymentStatus,
            shippingStatus,
            orderNumber,
            productId,
            userId,
            sortBy,
            sortOrder,
            dateFrom: dateFrom ? new Date(dateFrom) : undefined,
            dateTo: dateTo ? new Date(dateTo) : undefined
        };

        return await this.orderService.searchOrders(filters);
    }

    @Get('status/:status')
    async getOrdersByStatus(
        @Param('status') status: OrderStatus,
        @Request() req: any,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number
    ): Promise<OrderListResponse> {
        const filters: OrderSearchFilters = {
            userId: req.user.id,
            status,
            page,
            limit
        };

        return await this.orderService.getUserOrders(req.user.id, filters);
    }

    @Get('recent')
    async getRecentOrders(
        @Request() req: any,
        @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number
    ): Promise<OrderListResponse> {
        const filters: OrderSearchFilters = {
            userId: req.user.id,
            page: 1,
            limit,
            sortBy: 'createdAt',
            sortOrder: 'desc'
        };

        return await this.orderService.getUserOrders(req.user.id, filters);
    }

    @Get('pending')
    async getPendingOrders(
        @Request() req: any,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number
    ): Promise<OrderListResponse> {
        const filters: OrderSearchFilters = {
            userId: req.user.id,
            status: OrderStatus.PENDING,
            page,
            limit
        };

        return await this.orderService.getUserOrders(req.user.id, filters);
    }

    @Get('completed')
    async getCompletedOrders(
        @Request() req: any,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number
    ): Promise<OrderListResponse> {
        const filters: OrderSearchFilters = {
            userId: req.user.id,
            status: OrderStatus.DELIVERED,
            page,
            limit
        };

        return await this.orderService.getUserOrders(req.user.id, filters);
    }

    @Get('cancelled')
    async getCancelledOrders(
        @Request() req: any,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number
    ): Promise<OrderListResponse> {
        const filters: OrderSearchFilters = {
            userId: req.user.id,
            status: OrderStatus.CANCELLED,
            page,
            limit
        };

        return await this.orderService.getUserOrders(req.user.id, filters);
    }

    @Get('health')
    @HttpCode(HttpStatus.OK)
    async healthCheck(): Promise<{ status: string; timestamp: string }> {
        return {
            status: 'healthy',
            timestamp: new Date().toISOString()
        };
    }
}
