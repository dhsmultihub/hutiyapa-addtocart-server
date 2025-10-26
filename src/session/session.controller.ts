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
import { SessionService } from './session.service';
import { CartPersistenceService } from './cart-persistence.service';
import { DeviceSyncService } from './device-sync.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
    CreateSessionRequest,
    SessionResponse,
    SessionListResponse,
    SessionSearchFilters,
    SessionAnalytics,
    CartSyncRequest,
    CartSyncResponse,
    SessionType,
    SessionStatus,
    DeviceType
} from '../types/session.types';

@Controller('api/v1/sessions')
@UseGuards(JwtAuthGuard)
export class SessionController {
    constructor(
        private readonly sessionService: SessionService,
        private readonly cartPersistenceService: CartPersistenceService,
        private readonly deviceSyncService: DeviceSyncService
    ) { }

    /**
     * Create a new session
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createSession(
        @Body() createSessionRequest: CreateSessionRequest,
        @Request() req: any
    ): Promise<SessionResponse> {
        // Set user ID from authenticated user
        createSessionRequest.userId = req.user.id;

        return await this.sessionService.createSession(createSessionRequest);
    }

    /**
     * Get session by ID
     */
    @Get(':id')
    async getSessionById(
        @Param('id', ParseUUIDPipe) sessionId: string,
        @Request() req: any
    ): Promise<SessionResponse> {
        const session = await this.sessionService.getSessionById(sessionId);

        // Ensure user can only access their own sessions (unless admin)
        if (session.userId !== req.user.id && !req.user.roles?.includes('admin')) {
            throw new Error('Unauthorized to access this session');
        }

        return session;
    }

    /**
     * Get session by token
     */
    @Get('token/:token')
    async getSessionByToken(
        @Param('token') sessionToken: string
    ): Promise<SessionResponse | null> {
        return await this.sessionService.getSessionByToken(sessionToken);
    }

    /**
     * Get user sessions
     */
    @Get()
    async getUserSessions(
        @Request() req: any,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('type') type?: SessionType,
        @Query('status') status?: SessionStatus,
        @Query('deviceType') deviceType?: DeviceType,
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string,
        @Query('sortBy') sortBy?: 'createdAt' | 'lastActivity' | 'expiresAt',
        @Query('sortOrder') sortOrder?: 'asc' | 'desc'
    ): Promise<SessionListResponse> {
        const filters: SessionSearchFilters = {
            userId: req.user.id,
            page,
            limit,
            type,
            status,
            deviceType,
            sortBy,
            sortOrder,
            dateFrom: dateFrom ? new Date(dateFrom) : undefined,
            dateTo: dateTo ? new Date(dateTo) : undefined
        };

        return await this.sessionService.getUserSessions(req.user.id, filters);
    }

    /**
     * Update session activity
     */
    @Put(':id/activity')
    @HttpCode(HttpStatus.OK)
    async updateSessionActivity(
        @Param('id', ParseUUIDPipe) sessionId: string,
        @Request() req: any
    ): Promise<void> {
        // First check if user can access this session
        const session = await this.sessionService.getSessionById(sessionId);

        if (session.userId !== req.user.id && !req.user.roles?.includes('admin')) {
            throw new Error('Unauthorized to update this session');
        }

        await this.sessionService.updateSessionActivity(sessionId);
    }

    /**
     * Extend session expiration
     */
    @Put(':id/extend')
    async extendSession(
        @Param('id', ParseUUIDPipe) sessionId: string,
        @Body() body: { durationMinutes?: number },
        @Request() req: any
    ): Promise<SessionResponse> {
        // First check if user can access this session
        const session = await this.sessionService.getSessionById(sessionId);

        if (session.userId !== req.user.id && !req.user.roles?.includes('admin')) {
            throw new Error('Unauthorized to extend this session');
        }

        return await this.sessionService.extendSession(sessionId, body.durationMinutes);
    }

    /**
     * Terminate session
     */
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async terminateSession(
        @Param('id', ParseUUIDPipe) sessionId: string,
        @Request() req: any
    ): Promise<void> {
        // First check if user can access this session
        const session = await this.sessionService.getSessionById(sessionId);

        if (session.userId !== req.user.id && !req.user.roles?.includes('admin')) {
            throw new Error('Unauthorized to terminate this session');
        }

        await this.sessionService.terminateSession(sessionId);
    }

    /**
     * Migrate guest session to user session
     */
    @Post(':id/migrate')
    @HttpCode(HttpStatus.OK)
    async migrateGuestToUser(
        @Param('id', ParseUUIDPipe) sessionId: string,
        @Request() req: any
    ): Promise<SessionResponse> {
        return await this.sessionService.migrateGuestToUser(sessionId, req.user.id);
    }

    /**
     * Get session analytics
     */
    @Get('analytics/overview')
    async getSessionAnalytics(
        @Request() req: any,
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string
    ): Promise<SessionAnalytics> {
        // Only allow admin users to view analytics
        if (!req.user.roles?.includes('admin')) {
            throw new Error('Unauthorized to view session analytics');
        }

        return await this.sessionService.getSessionAnalytics(
            dateFrom ? new Date(dateFrom) : undefined,
            dateTo ? new Date(dateTo) : undefined
        );
    }

    // Cart Persistence Endpoints

    /**
     * Save cart state
     */
    @Post(':id/cart/save')
    @HttpCode(HttpStatus.OK)
    async saveCartState(
        @Param('id', ParseUUIDPipe) sessionId: string,
        @Body() body: { cartId: string },
        @Request() req: any
    ): Promise<{ success: boolean; message: string }> {
        // First check if user can access this session
        const session = await this.sessionService.getSessionById(sessionId);

        if (session.userId !== req.user.id && !req.user.roles?.includes('admin')) {
            throw new Error('Unauthorized to save cart for this session');
        }

        // Get cart data
        const cart = await this.cartPersistenceService.saveCartState(sessionId, body.cartId, {} as any);

        return {
            success: true,
            message: 'Cart state saved successfully'
        };
    }

    /**
     * Recover cart from last saved state
     */
    @Get(':id/cart/recover')
    async recoverCart(
        @Param('id', ParseUUIDPipe) sessionId: string,
        @Query('cartId') cartId: string,
        @Request() req: any
    ): Promise<{ success: boolean; cartData?: any; message: string }> {
        // First check if user can access this session
        const session = await this.sessionService.getSessionById(sessionId);

        if (session.userId !== req.user.id && !req.user.roles?.includes('admin')) {
            throw new Error('Unauthorized to recover cart for this session');
        }

        const cartData = await this.cartPersistenceService.recoverCart(sessionId, cartId);

        if (!cartData) {
            return {
                success: false,
                message: 'No saved cart state found'
            };
        }

        return {
            success: true,
            cartData,
            message: 'Cart recovered successfully'
        };
    }

    /**
     * Get cart snapshots
     */
    @Get(':id/cart/snapshots')
    async getCartSnapshots(
        @Param('id', ParseUUIDPipe) sessionId: string,
        @Query('cartId') cartId?: string,
        @Request() req: any
    ): Promise<any[]> {
        // First check if user can access this session
        const session = await this.sessionService.getSessionById(sessionId);

        if (session.userId !== req.user.id && !req.user.roles?.includes('admin')) {
            throw new Error('Unauthorized to access cart snapshots for this session');
        }

        return await this.cartPersistenceService.getCartSnapshots(sessionId, cartId);
    }

    /**
     * Restore cart from snapshot
     */
    @Post(':id/cart/restore/:snapshotId')
    @HttpCode(HttpStatus.OK)
    async restoreCartFromSnapshot(
        @Param('id', ParseUUIDPipe) sessionId: string,
        @Param('snapshotId', ParseUUIDPipe) snapshotId: string,
        @Request() req: any
    ): Promise<{ success: boolean; message: string }> {
        // First check if user can access this session
        const session = await this.sessionService.getSessionById(sessionId);

        if (session.userId !== req.user.id && !req.user.roles?.includes('admin')) {
            throw new Error('Unauthorized to restore cart for this session');
        }

        const success = await this.cartPersistenceService.restoreCartFromSnapshot(sessionId, snapshotId);

        return {
            success,
            message: success ? 'Cart restored successfully' : 'Cart restoration failed'
        };
    }

    /**
     * Get cart backup history
     */
    @Get(':id/cart/backups')
    async getCartBackupHistory(
        @Param('id', ParseUUIDPipe) sessionId: string,
        @Query('cartId') cartId: string,
        @Request() req: any
    ): Promise<any[]> {
        // First check if user can access this session
        const session = await this.sessionService.getSessionById(sessionId);

        if (session.userId !== req.user.id && !req.user.roles?.includes('admin')) {
            throw new Error('Unauthorized to access cart backups for this session');
        }

        return await this.cartPersistenceService.getCartBackupHistory(sessionId, cartId);
    }

    // Device Sync Endpoints

    /**
     * Sync cart across devices
     */
    @Post(':id/sync')
    @HttpCode(HttpStatus.OK)
    async syncCart(
        @Param('id', ParseUUIDPipe) sessionId: string,
        @Body() syncRequest: CartSyncRequest,
        @Request() req: any
    ): Promise<CartSyncResponse> {
        // First check if user can access this session
        const session = await this.sessionService.getSessionById(sessionId);

        if (session.userId !== req.user.id && !req.user.roles?.includes('admin')) {
            throw new Error('Unauthorized to sync cart for this session');
        }

        syncRequest.sessionId = sessionId;
        return await this.deviceSyncService.syncCart(syncRequest);
    }

    /**
     * Get sync status
     */
    @Get(':id/sync/status')
    async getSyncStatus(
        @Param('id', ParseUUIDPipe) sessionId: string,
        @Query('deviceId') deviceId: string,
        @Request() req: any
    ): Promise<any> {
        // First check if user can access this session
        const session = await this.sessionService.getSessionById(sessionId);

        if (session.userId !== req.user.id && !req.user.roles?.includes('admin')) {
            throw new Error('Unauthorized to access sync status for this session');
        }

        return await this.deviceSyncService.getSyncStatus(sessionId, deviceId);
    }

    /**
     * Get session syncs
     */
    @Get(':id/syncs')
    async getSessionSyncs(
        @Param('id', ParseUUIDPipe) sessionId: string,
        @Request() req: any
    ): Promise<any[]> {
        // First check if user can access this session
        const session = await this.sessionService.getSessionById(sessionId);

        if (session.userId !== req.user.id && !req.user.roles?.includes('admin')) {
            throw new Error('Unauthorized to access syncs for this session');
        }

        return await this.deviceSyncService.getSessionSyncs(sessionId);
    }

    /**
     * Resolve sync conflicts
     */
    @Post(':id/sync/resolve')
    @HttpCode(HttpStatus.OK)
    async resolveConflicts(
        @Param('id', ParseUUIDPipe) sessionId: string,
        @Body() body: { deviceId: string; resolution: any },
        @Request() req: any
    ): Promise<CartSyncResponse> {
        // First check if user can access this session
        const session = await this.sessionService.getSessionById(sessionId);

        if (session.userId !== req.user.id && !req.user.roles?.includes('admin')) {
            throw new Error('Unauthorized to resolve conflicts for this session');
        }

        return await this.deviceSyncService.resolveConflicts(sessionId, body.deviceId, body.resolution);
    }

    // Admin Endpoints

    /**
     * Search all sessions (admin only)
     */
    @Get('admin/search')
    async searchSessions(
        @Request() req: any,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('userId') userId?: string,
        @Query('type') type?: SessionType,
        @Query('status') status?: SessionStatus,
        @Query('deviceType') deviceType?: DeviceType,
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string,
        @Query('sortBy') sortBy?: 'createdAt' | 'lastActivity' | 'expiresAt',
        @Query('sortOrder') sortOrder?: 'asc' | 'desc'
    ): Promise<SessionListResponse> {
        // Only allow admin users to search all sessions
        if (!req.user.roles?.includes('admin')) {
            throw new Error('Unauthorized to search all sessions');
        }

        const filters: SessionSearchFilters = {
            page,
            limit,
            userId,
            type,
            status,
            deviceType,
            sortBy,
            sortOrder,
            dateFrom: dateFrom ? new Date(dateFrom) : undefined,
            dateTo: dateTo ? new Date(dateTo) : undefined
        };

        return await this.sessionService.searchSessions(filters);
    }

    /**
     * Clean up expired sessions (admin only)
     */
    @Post('admin/cleanup')
    @HttpCode(HttpStatus.OK)
    async cleanupExpiredSessions(
        @Request() req: any
    ): Promise<{ success: boolean; cleanedCount: number; message: string }> {
        // Only allow admin users to trigger cleanup
        if (!req.user.roles?.includes('admin')) {
            throw new Error('Unauthorized to trigger session cleanup');
        }

        const cleanedCount = await this.sessionService.cleanupExpiredSessions();

        return {
            success: true,
            cleanedCount,
            message: `Cleaned up ${cleanedCount} expired sessions`
        };
    }

    /**
     * Health check
     */
    @Get('health')
    @HttpCode(HttpStatus.OK)
    async healthCheck(): Promise<{ status: string; timestamp: string }> {
        return {
            status: 'healthy',
            timestamp: new Date().toISOString()
        };
    }
}
