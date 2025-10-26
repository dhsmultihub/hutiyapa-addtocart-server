import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
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
  ) {}

  /**
   * Get cart
   */
  @Get()
  async getCart(
    @Headers('x-session-token') sessionToken: string,
    @CurrentUser() user?: any
  ): Promise<CartResponseDto> {
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
    @Body() addItemDto: AddItemDto,
    @CurrentUser() user?: any
  ): Promise<CartResponseDto> {
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
}
