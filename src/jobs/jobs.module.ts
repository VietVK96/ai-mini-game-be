import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { MemoryCacheModule } from '../memory-cache/memory-cache.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ImageModule } from '../image/image.module';
import { QueueModule } from '../queue/queue.module';
import { GeminiModule } from '../gemini/gemini.module';

@Module({
  imports: [
    // Import QueueModule to access BullQueue_gen
    QueueModule,
    // Register the 'gen' queue for injection in JobsService
    BullModule.registerQueue({
      name: 'gen',
      defaultJobOptions: {
        // Limit job history to prevent memory accumulation
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour (in seconds)
          count: 100, // Keep max 100 completed jobs
        },
        removeOnFail: {
          age: 3600, // Keep failed jobs for 1 hour (in seconds)
          count: 100, // Keep max 100 failed jobs
        },
      },
    }),
    MemoryCacheModule,
    RealtimeModule,
    ImageModule,
    GeminiModule,
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {
  constructor() {
    console.log('💼 JOBS: JobsModule initialized');
  }
}
