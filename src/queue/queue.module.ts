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
    }),
    MemoryCacheModule,
    RealtimeModule,
    GeminiModule,
    ImageModule,
    TemplatesModule,
  ],
  providers: [GenConsumer],
})
export class QueueModule {}
