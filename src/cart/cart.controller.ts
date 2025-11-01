import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Headers,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { DatabaseService } from '../database/database.service';
import { AddItemDto } from './dto/add-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import { BulkOperationsDto, BulkOperationsResponseDto } from './dto/bulk-operations.dto';
import { CartMergeDto, CartMergeResponseDto, MergePreviewDto } from './dto/cart-merge.dto';
import { SessionContext } from '../types/cart.types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { BulkOperationsService } from './operations/bulk-operations.service';
import { CartMergerService } from './operations/cart-merger.service';
import { ItemManagerService } from './operations/item-manager.service';
import { CartValidatorService } from './validation/cart-validator.service';

@Controller('cart')
export class CartController {
  private readonly logger = new Logger(CartController.name);

  constructor(
    private readonly cartService: CartService,
    private readonly bulkOperationsService: BulkOperationsService,
    private readonly cartMergerService: CartMergerService,
    private readonly itemManagerService: ItemManagerService,
    private readonly cartValidatorService: CartValidatorService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Get cart
   */
  @Get()
  async getCart(
    @Headers('x-session-token') sessionToken: string,
    @Headers('x-test-user-id') testUserId?: string,
    @Headers('x-test-session-id') testSessionId?: string,
    @Query('userId') queryUserId?: string,
    @Query('sessionId') querySessionId?: string,
    @CurrentUser() user?: any
  ): Promise<CartResponseDto> {
    // Development mode: Allow userId/sessionId from query params or headers
    let finalUserId: string | undefined;
    let finalSessionId: string | undefined;

    if (process.env.NODE_ENV === 'development') {
      finalUserId = queryUserId || testUserId;
      finalSessionId = querySessionId || testSessionId;
    }

    // If test userId/sessionId provided, use it
    if (finalUserId || finalSessionId) {
      const sessionContext: SessionContext = {
        sessionId: finalSessionId || `user_${finalUserId}`,
        userId: finalUserId,
        isGuest: !finalUserId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };

      const cart = await this.cartService.getOrCreateCart(sessionContext);
      return this.cartService.getCartResponse(cart);
    }

    // Normal flow
    if (!sessionToken && !user) {
      throw new BadRequestException('Session token or authentication required');
    }

    let sessionContext: SessionContext;

    if (user) {
      // Authenticated user
      sessionContext = {
        sessionId: user.sessionId || `user_${user.id}`,
        userId: user.id,
        isGuest: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };
    } else {
      // Guest user
      sessionContext = await this.cartService.getSessionContext(sessionToken);
      if (!sessionContext) {
        throw new BadRequestException('Invalid or expired session');
      }
    }

    const cart = await this.cartService.getOrCreateCart(sessionContext);
    return this.cartService.getCartResponse(cart);
  }

  /**
   * Add item to cart
   */
  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  async addItem(
    @Headers('x-session-token') sessionToken: string,
    @Headers('x-test-user-id') testUserId?: string,
    @Headers('x-test-session-id') testSessionId?: string,
    @Body() addItemDto: AddItemDto,
    @CurrentUser() user?: any
  ): Promise<CartResponseDto> {
    // Development mode: Allow userId/sessionId from headers
    let finalUserId: string | undefined;
    let finalSessionId: string | undefined;

    if (process.env.NODE_ENV === 'development') {
      finalUserId = testUserId;
      finalSessionId = testSessionId;
    }

    // If test userId/sessionId provided, use it
    if (finalUserId || finalSessionId) {
      const sessionContext: SessionContext = {
        sessionId: finalSessionId || `user_${finalUserId}`,
        userId: finalUserId,
        isGuest: !finalUserId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };

      const cart = await this.cartService.getOrCreateCart(sessionContext);
      await this.cartService.addItemToCart(cart.id, addItemDto);

      // Return updated cart
      const updatedCart = await this.cartService.getCartById(cart.id);
      return this.cartService.getCartResponse(updatedCart);
    }

    // Normal flow
    if (!sessionToken && !user) {
      throw new BadRequestException('Session token or authentication required');
    }

    let sessionContext: SessionContext;

    if (user) {
      // Authenticated user
      sessionContext = {
        sessionId: user.sessionId || `user_${user.id}`,
        userId: user.id,
        isGuest: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };
    } else {
      // Guest user
      sessionContext = await this.cartService.getSessionContext(sessionToken);
      if (!sessionContext) {
        throw new BadRequestException('Invalid or expired session');
      }
    }

    const cart = await this.cartService.getOrCreateCart(sessionContext);
    await this.cartService.addItemToCart(cart.id, addItemDto);

    // Return updated cart
    const updatedCart = await this.cartService.getCartById(cart.id);
    return this.cartService.getCartResponse(updatedCart);
  }

  /**
   * Update cart item
   */
  @Patch('items/:itemId')
  async updateItem(
    @Headers('x-session-token') sessionToken: string,
    @Param('itemId') itemId: string,
    @Body() updateItemDto: UpdateItemDto,
  ): Promise<CartResponseDto> {
    if (!sessionToken) {
      throw new BadRequestException('Session token is required');
    }

    const sessionContext = await this.cartService.getSessionContext(sessionToken);
    if (!sessionContext) {
      throw new BadRequestException('Invalid or expired session');
    }

    const cart = await this.cartService.getOrCreateCart(sessionContext);
    await this.cartService.updateCartItem(itemId, updateItemDto);

    // Return updated cart
    const updatedCart = await this.cartService.getCartById(cart.id);
    return this.cartService.getCartResponse(updatedCart);
  }

  /**
   * Remove item from cart
   */
  @Delete('items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeItem(
    @Headers('x-session-token') sessionToken: string,
    @Param('itemId') itemId: string,
  ): Promise<void> {
    if (!sessionToken) {
      throw new BadRequestException('Session token is required');
    }

    const sessionContext = await this.cartService.getSessionContext(sessionToken);
    if (!sessionContext) {
      throw new BadRequestException('Invalid or expired session');
    }

    await this.cartService.removeItemFromCart(itemId);
  }

  /**
   * Clear cart
   */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearCart(@Headers('x-session-token') sessionToken: string): Promise<void> {
    if (!sessionToken) {
      throw new BadRequestException('Session token is required');
    }

    const sessionContext = await this.cartService.getSessionContext(sessionToken);
    if (!sessionContext) {
      throw new BadRequestException('Invalid or expired session');
    }

    const cart = await this.cartService.getOrCreateCart(sessionContext);
    await this.cartService.clearCart(cart.id);
  }

  /**
   * Create session
   */
  @Post('session')
  async createSession(
    @Headers('x-user-id') userId?: string,
  ): Promise<{ sessionToken: string; expiresAt: Date }> {
    const result = await this.cartService.createSession(userId);
    return result;
  }

  /**
   * Bulk operations - Add multiple items
   */
  @Post('bulk/items')
  @HttpCode(HttpStatus.CREATED)
  async addMultipleItems(
    @Headers('x-session-token') sessionToken: string,
    @Body() bulkOperationsDto: BulkOperationsDto,
    @CurrentUser() user?: any
  ): Promise<BulkOperationsResponseDto> {
    if (!sessionToken && !user) {
      throw new BadRequestException('Session token or authentication required');
    }

    let sessionContext: SessionContext;
    
    if (user) {
      sessionContext = {
        sessionId: user.sessionId || `user_${user.id}`,
        userId: user.id,
        isGuest: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
    } else {
      sessionContext = await this.cartService.getSessionContext(sessionToken);
      if (!sessionContext) {
        throw new BadRequestException('Invalid or expired session');
      }
    }

    const cart = await this.cartService.getOrCreateCart(sessionContext);
    return this.bulkOperationsService.addMultipleItems(cart.id, bulkOperationsDto.items || [], sessionContext);
  }

  /**
   * Bulk operations - Remove multiple items
   */
  @Delete('bulk/items')
  async removeMultipleItems(
    @Headers('x-session-token') sessionToken: string,
    @Body() bulkOperationsDto: BulkOperationsDto,
    @CurrentUser() user?: any
  ): Promise<BulkOperationsResponseDto> {
    if (!sessionToken && !user) {
      throw new BadRequestException('Session token or authentication required');
    }

    let sessionContext: SessionContext;
    
    if (user) {
      sessionContext = {
        sessionId: user.sessionId || `user_${user.id}`,
        userId: user.id,
        isGuest: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
    } else {
      sessionContext = await this.cartService.getSessionContext(sessionToken);
      if (!sessionContext) {
        throw new BadRequestException('Invalid or expired session');
      }
    }

    const cart = await this.cartService.getOrCreateCart(sessionContext);
    return this.bulkOperationsService.removeMultipleItems(cart.id, bulkOperationsDto.itemIds || [], sessionContext);
  }

  /**
   * Merge guest cart with user cart
   */
  @Post('merge')
  async mergeCarts(
    @Body() mergeDto: { guestCartId: string; userCartId: string; mergeOptions: CartMergeDto },
    @CurrentUser() user: any
  ): Promise<CartMergeResponseDto> {
    if (!user) {
      throw new BadRequestException('Authentication required for cart merging');
    }

    return this.cartMergerService.mergeCarts(
      mergeDto.guestCartId,
      mergeDto.userCartId,
      mergeDto.mergeOptions
    );
  }

  /**
   * Preview cart merge
   */
  @Post('merge/preview')
  async previewMerge(
    @Body() previewDto: MergePreviewDto,
    @CurrentUser() user: any
  ) {
    if (!user) {
      throw new BadRequestException('Authentication required for merge preview');
    }

    return this.cartMergerService.previewMerge(
      previewDto.guestCartId,
      previewDto.userCartId,
      previewDto.mergeOptions
    );
  }

  /**
   * Move item to saved for later
   */
  @Post('items/:itemId/save')
  async moveToSavedForLater(
    @Param('itemId') itemId: string,
    @Headers('x-session-token') sessionToken: string,
    @Body() body: { notes?: string },
    @CurrentUser() user?: any
  ) {
    if (!sessionToken && !user) {
      throw new BadRequestException('Session token or authentication required');
    }

    let sessionContext: SessionContext;
    
    if (user) {
      sessionContext = {
        sessionId: user.sessionId || `user_${user.id}`,
        userId: user.id,
        isGuest: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
    } else {
      sessionContext = await this.cartService.getSessionContext(sessionToken);
      if (!sessionContext) {
        throw new BadRequestException('Invalid or expired session');
      }
    }

    const cart = await this.cartService.getOrCreateCart(sessionContext);
    return this.itemManagerService.moveToSavedForLater(itemId, cart.id, sessionContext, body.notes);
  }

  /**
   * Validate cart
   */
  @Get('validate')
  async validateCart(
    @Headers('x-session-token') sessionToken: string,
    @CurrentUser() user?: any
  ) {
    if (!sessionToken && !user) {
      throw new BadRequestException('Session token or authentication required');
    }

    let sessionContext: SessionContext;
    
    if (user) {
      sessionContext = {
        sessionId: user.sessionId || `user_${user.id}`,
        userId: user.id,
        isGuest: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
    } else {
      sessionContext = await this.cartService.getSessionContext(sessionToken);
      if (!sessionContext) {
        throw new BadRequestException('Invalid or expired session');
      }
    }

    const cart = await this.cartService.getOrCreateCart(sessionContext);
    return this.cartValidatorService.validateCart(cart.id, sessionContext);
  }

  /**
   * Health check
   */
  @Public()
  @Get('health')
  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get users with carts (Development only)
   * Returns list of users/sessions that have active carts for testing
   */
  @Public()
  @Get('test/users')
  async getUsersWithCarts(): Promise<{
    users: Array<{
      userId: string | null;
      sessionId?: string;
      itemCount: number;
      total?: number;
      cartId?: string;
    }>;
  }> {
    // Only allow in development mode
    if (process.env.NODE_ENV !== 'development') {
      throw new BadRequestException('This endpoint is only available in development mode');
    }

    try {
      // Get all active carts with their items
      const carts = await this.databaseService.prisma.cart.findMany({
        where: {
          status: 'ACTIVE'
        },
        include: {
          items: true,
          session: true
        },
        orderBy: {
          updatedAt: 'desc'
        },
        take: 50 // Limit to 50 carts for performance
      });

      const usersWithCarts = carts.map((cart: any) => {
        const itemCount = cart.items?.length || 0;
        const total = cart.items?.reduce((sum: number, item: any) => 
          sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0
        );

        return {
          userId: cart.userId || null,
          sessionId: cart.sessionId,
          itemCount,
          total,
          cartId: cart.id
        };
      });

      return {
        users: usersWithCarts
      };
    } catch (error) {
      this.logger.error('Failed to fetch users with carts:', error);
      throw new BadRequestException('Failed to fetch users with carts');
    }
  }

  /**
   * Get sessions with carts (Development only)
   */
  @Public()
  @Get('test/sessions')
  async getSessionsWithCarts(): Promise<{
    sessions: Array<{
      sessionId: string;
      userId?: string;
      itemCount: number;
      total?: number;
      cartId?: string;
    }>;
  }> {
    // Only allow in development mode
    if (process.env.NODE_ENV !== 'development') {
      throw new BadRequestException('This endpoint is only available in development mode');
    }

    try {
      // Get all active sessions with carts
      const sessions = await this.databaseService.prisma.cartSession.findMany({
        where: {
          expiresAt: {
            gt: new Date()
          }
        },
        include: {
          cart: {
            include: {
              items: true
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        },
        take: 50 // Limit to 50 sessions
      });

      const sessionsWithCarts = sessions
        .filter((session: any) => session.cart)
        .map((session: any) => {
          const cart = session.cart as any;
          const itemCount = cart?.items?.length || 0;
          const total = cart?.items?.reduce((sum: number, item: any) => 
            sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0
          ) || 0;

          return {
            sessionId: session.id,
            userId: session.userId || undefined,
            itemCount,
            total,
            cartId: cart?.id
          };
        });

      return {
        sessions: sessionsWithCarts
      };
    } catch (error) {
      this.logger.error('Failed to fetch sessions with carts:', error);
      throw new BadRequestException('Failed to fetch sessions with carts');
    }
  }
}
