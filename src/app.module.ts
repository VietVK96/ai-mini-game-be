import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { JobsModule } from './jobs/jobs.module';
import { TemplatesModule } from './templates/templates.module';
import { MemoryCacheModule } from './memory-cache/memory-cache.module';
import { RealtimeModule } from './realtime/realtime.module';
import { GeminiModule } from './gemini/gemini.module';
import { ImageModule } from './image/image.module';
import { QueueModule } from './queue/queue.module';
import { ShareModule } from './share/share.module';
import { geminiConfig } from './config/gemini.config';
import { appConfig } from './config/app.config';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [geminiConfig, appConfig],
    }),
    
    // Schedule module for cron jobs
    ScheduleModule.forRoot(),
    
    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 minute
      limit: 10, // 10 requests per minute
    }]),
    
    // Bull Queue
    BullModule.forRootAsync({
      useFactory: () =>{
        console.log('REDIS_HOST', process.env.REDIS_HOST);
        console.log('REDIS_PORT', process.env.REDIS_PORT);
        console.log('REDIS_PASSWORD', process.env.REDIS_PASSWORD);
        return {
          redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
          },
        }
      }
    }),
    
    // Feature modules
    JobsModule,
    TemplatesModule,
    MemoryCacheModule,
    RealtimeModule,
    GeminiModule,
    ImageModule,
    QueueModule,
    ShareModule,
  ],
})
export class AppModule {}
