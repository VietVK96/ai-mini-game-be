import { Module } from '@nestjs/common';
import { ShareController, SharePageController } from './share.controller';
import { ShareService } from './share.service';
import { ShareCleanupService } from './share-cleanup.service';

@Module({
  controllers: [ShareController, SharePageController],
  providers: [ShareService, ShareCleanupService],
})
export class ShareModule {}

