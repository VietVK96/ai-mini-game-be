import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ShareService } from './share.service';

@Injectable()
export class ShareCleanupService {
  private readonly logger = new Logger(ShareCleanupService.name);

  constructor(private readonly shareService: ShareService) {}

  /**
   * Run cleanup every 5 minutes
   */
  @Cron('*/5 * * * *')
  async handleCleanup(): Promise<void> {
    this.logger.log('Starting share cleanup job...');
    try {
      const deletedCount = await this.shareService.cleanupExpiredShares();
      if (deletedCount > 0) {
        this.logger.log(`Cleaned up ${deletedCount} expired share(s)`);
      }
    } catch (error) {
      this.logger.error('Error during share cleanup:', error);
    }
  }
}

