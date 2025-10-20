import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule } from '@nestjs/throttler';
import { JobsModule } from './jobs/jobs.module';
import { TemplatesModule } from './templates/templates.module';
import { MemoryCacheModule } from './memory-cache/memory-cache.module';
import { RealtimeModule } from './realtime/realtime.module';
import { GeminiModule } from './gemini/gemini.module';
import { ImageModule } from './image/image.module';
import { QueueModule } from './queue/queue.module';
import { geminiConfig } from './config/gemini.config';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [geminiConfig],
    }),
    
    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 minute
      limit: 10, // 10 requests per minute
    }]),
    
    // Bull Queue
    BullModule.forRootAsync({
      useFactory: () => {
        const redisConfig = {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
          enableReadyCheck: false,
          lazyConnect: true,
          // Add connection event handlers
          onConnect: () => {
            console.log('🔗 REDIS: Connected to Redis successfully');
          },
          onError: (error) => {
            console.error('❌ REDIS: Connection failed:', error);
            throw new Error(`Redis connection failed: ${error.message}`);
          },
          onReady: () => {
            console.log('✅ REDIS: Redis is ready');
          },
          onClose: () => {
            console.log('🔌 REDIS: Connection closed');
          },
        };

        console.log(`🔗 REDIS: Attempting to connect to Redis at ${redisConfig.host}:${redisConfig.port}`);
        
        return {
          redis: redisConfig,
          defaultJobOptions: {
            removeOnComplete: 10,
            removeOnFail: 5,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        };
      },
    }),
    
    // Queue module must be imported before JobsModule
    QueueModule,
    
    // Feature modules
    JobsModule,
    TemplatesModule,
    MemoryCacheModule,
    RealtimeModule,
    GeminiModule,
    ImageModule,
  ],
})
export class AppModule {
  constructor() {
    console.log('🚀 APP: AppModule initialized');
    console.log('🚀 APP: All modules loaded successfully');
  }
}
