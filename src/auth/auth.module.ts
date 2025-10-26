import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { AuthController } from './auth.controller';

@Module({
    imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        HttpModule,
        JwtModule.registerAsync({
            useFactory: (configService: ConfigService) => ({
                secret: configService.get('JWT_SECRET'),
                signOptions: {
                    expiresIn: configService.get('JWT_EXPIRES_IN', '7d'),
                },
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [
    AuthService,
    {
      provide: JwtStrategy,
      useFactory: (authService: AuthService, configService: ConfigService) => {
        return new JwtStrategy(authService, configService);
      },
      inject: [AuthService, ConfigService],
    },
  ],
    controllers: [AuthController],
    exports: [AuthService, JwtStrategy, PassportModule],
})
export class AuthModule { }
