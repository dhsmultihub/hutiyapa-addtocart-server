import { Module } from '@nestjs/common';
import { WebSocketGateway } from './websocket.gateway';
import { CartEventsService } from './cart-events.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        DatabaseModule,
        AuthModule
    ],
    providers: [
        WebSocketGateway,
        CartEventsService
    ],
    exports: [
        WebSocketGateway,
        CartEventsService
    ]
})
export class WebSocketModule { }
