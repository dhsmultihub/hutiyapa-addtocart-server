import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';

@Global()
@Module({
  providers: [
    {
      provide: DatabaseService,
      useFactory: async (configService: ConfigService) => {
        const databaseService = new DatabaseService();
        await databaseService.connect();
        return databaseService;
      },
      inject: [ConfigService],
    },
  ],
  exports: [DatabaseService],
})
export class DatabaseModule {}
