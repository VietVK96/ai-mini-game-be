import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MemoryCacheModule } from '../memory-cache/memory-cache.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { GeminiModule } from '../gemini/gemini.module';
import { TemplatesModule } from '../templates/templates.module';
import { GenConsumer } from './gen.consumer';

@Module({
  imports: [
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
    GeminiModule,
    TemplatesModule,
  ],
  providers: [GenConsumer],
})
export class QueueModule {}
