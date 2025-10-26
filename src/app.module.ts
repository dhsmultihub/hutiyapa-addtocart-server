import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { CartModule } from './cart/cart.module';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { ProductIntegrationModule } from './product-integration/product-integration.module';
import { CheckoutModule } from './checkout/checkout.module';
import { OrderModule } from './order/order.module';
import { PricingModule } from './pricing/pricing.module';
import { SessionModule } from './session/session.module';
import { WebSocketModule } from './websocket/websocket.module';
import { NotificationModule } from './notifications/notification.module';
import { EventsModule } from './events/events.module';
import { CacheModule } from './cache/cache.module';
import { OptimizationModule } from './optimization/optimization.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import configuration from './config/configuration';

@Module({
  imports: [
    // Configuration module
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),

    // HTTP module for external service calls
    HttpModule,

    // Database module
    DatabaseModule,

    // Common module for shared components
    CommonModule,

    // Authentication module
    AuthModule,

    // Product integration module
    ProductIntegrationModule,

    // Checkout module
    CheckoutModule,

    // Order module
    OrderModule,

    // Pricing module
    PricingModule,

    // Session module
    SessionModule,

    // WebSocket module
    WebSocketModule,

    // Notification module
    NotificationModule,

    // Events module
    EventsModule,

    // Cache module
    CacheModule,

    // Optimization module
    OptimizationModule,

    // Monitoring module
    MonitoringModule,

    // Feature modules
    CartModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
