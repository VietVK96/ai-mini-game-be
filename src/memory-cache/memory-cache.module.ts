import { Module } from '@nestjs/common';
import { MemoryCacheService } from './memory-cache.service';

@Module({
  providers: [MemoryCacheService],
  exports: [MemoryCacheService],
})
export class MemoryCacheModule {}
