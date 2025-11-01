import { Module, forwardRef } from '@nestjs/common';
import { CartWebSocketGateway } from './websocket.gateway';
import { CartEventsService } from './cart-events.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        DatabaseModule,
        AuthModule
    ],
    providers: [
        CartWebSocketGateway,
        CartEventsService
    ],
    exports: [
        CartWebSocketGateway,
        CartEventsService
    ]
})
export class WebSocketModule { }
