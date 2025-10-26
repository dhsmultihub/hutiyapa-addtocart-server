import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import { CartPersistenceService } from './cart-persistence.service';
import { DeviceSyncService } from './device-sync.service';
import { CartBackupJob } from '../jobs/cart-backup.job';
import { SessionCleanupJob } from '../jobs/session-cleanup.job';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        DatabaseModule,
        AuthModule,
        CartModule
    ],
    controllers: [SessionController],
    providers: [
        SessionService,
        CartPersistenceService,
        DeviceSyncService,
        CartBackupJob,
        SessionCleanupJob
    ],
    exports: [
        SessionService,
        CartPersistenceService,
        DeviceSyncService
    ]
})
export class SessionModule { }
