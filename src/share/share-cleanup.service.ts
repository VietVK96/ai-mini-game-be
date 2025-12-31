import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ShareService } from './share.service';

@Injectable()
export class ShareCleanupService {
  private readonly logger = new Logger(ShareCleanupService.name);

  constructor(private readonly shareService: ShareService) {}


}

