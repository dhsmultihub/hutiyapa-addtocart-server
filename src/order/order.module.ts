import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from '../services/order.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        DatabaseModule,
        AuthModule
    ],
    controllers: [OrderController],
    providers: [OrderService],
    exports: [OrderService]
})
export class OrderModule { }
