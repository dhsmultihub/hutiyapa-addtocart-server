import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

export interface ValidateTokenDto {
    token: string;
}

export interface UserInfoResponse {
    id: string;
    email: string;
    roles: string[];
    isAdmin: boolean;
    isGuest: boolean;
}

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    /**
     * Validate token endpoint
     */
    @Public()
    @Post('validate')
    async validateToken(@Body() validateTokenDto: ValidateTokenDto) {
        try {
            const result = await this.authService.validateToken(validateTokenDto.token);
            return {
                valid: result.isValid,
                user: result.user,
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message,
            };
        }
    }

    /**
     * Get current user info
     */
    @UseGuards(JwtAuthGuard)
    @Get('me')
    async getCurrentUser(@CurrentUser() user: any): Promise<UserInfoResponse> {
        return {
            id: user.id,
            email: user.email,
            roles: user.roles || [],
            isAdmin: this.authService.isAdmin(user),
            isGuest: this.authService.isGuest(user),
        };
    }

    /**
     * Generate guest session token
     */
    @Public()
    @Post('guest-session')
    async createGuestSession() {
        const token = this.authService.generateGuestSessionToken();
        return {
            token,
            type: 'guest',
            expiresIn: '24h',
        };
    }

    /**
     * Check user permissions
     */
    @UseGuards(JwtAuthGuard)
    @Post('check-permissions')
    async checkPermissions(
        @CurrentUser() user: any,
        @Body() body: { permissions: string[] }
    ) {
        const hasPermissions = await this.authService.checkPermissions(
            user.id,
            body.permissions
        );

        return {
            hasPermissions,
            userId: user.id,
            requestedPermissions: body.permissions,
        };
    }

    /**
     * Health check for auth service
     */
    @Public()
    @Get('health')
    async healthCheck() {
        return {
            status: 'healthy',
            service: 'auth',
            timestamp: new Date().toISOString(),
        };
    }
}
