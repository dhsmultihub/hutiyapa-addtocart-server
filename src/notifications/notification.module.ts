import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { PushNotificationService } from './push-notification.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule
  ],
  providers: [
    NotificationService,
    PushNotificationService,
    NotificationPreferencesService
  ],
  exports: [
    NotificationService,
    PushNotificationService,
    NotificationPreferencesService
  ]
})
export class NotificationModule {}
