import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MemoryCacheModule } from '../memory-cache/memory-cache.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { GeminiModule } from '../gemini/gemini.module';
import { ImageModule } from '../image/image.module';
import { TemplatesModule } from '../templates/templates.module';
import { GenConsumer } from './gen.consumer';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'gen',
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }),
    MemoryCacheModule,
    RealtimeModule,
    GeminiModule,
    ImageModule,
    TemplatesModule,
  ],
  providers: [GenConsumer],
  exports: [BullModule, GenConsumer], // Export both BullModule and GenConsumer
})
export class QueueModule {
  constructor() {
    console.log('📦 QUEUE: QueueModule initialized with GenConsumer');
    console.log('📦 QUEUE: Queue "gen" registered with BullModule');
  }
}
