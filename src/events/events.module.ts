import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CartEventPublisher } from './cart-event.publisher';
import { ProductEventHandler } from './event-handlers/product-event.handler';
import { DatabaseModule } from '../database/database.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    DatabaseModule,
    NotificationModule
  ],
  providers: [
    CartEventPublisher,
    ProductEventHandler
  ],
  exports: [
    CartEventPublisher,
    ProductEventHandler
  ]
})
export class EventsModule {}
