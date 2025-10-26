import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, UserPayload } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private authService: AuthService,
        private configService: ConfigService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get('JWT_SECRET') || 'your-super-secret-jwt-key-change-in-production',
            passReqToCallback: true,
        });
    }

    async validate(req: any, payload: UserPayload): Promise<UserPayload> {
        // Extract token from request
        const token = this.extractTokenFromHeader(req);

        if (!token) {
            throw new UnauthorizedException('No token provided');
        }

        // Validate token with Auth service
        try {
            const validation = await this.authService.validateToken(token);

            if (!validation.isValid) {
                throw new UnauthorizedException('Token validation failed');
            }

            // Log successful authentication
            this.authService.logAuthEvent('token_validated', payload.id);

            return validation.user;
        } catch (error) {
            this.authService.logAuthEvent('token_validation_failed', payload.id, {
                error: error.message,
            });
            throw new UnauthorizedException('Token validation failed');
        }
    }

    private extractTokenFromHeader(request: any): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}
