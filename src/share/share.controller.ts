import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ShareService } from './share.service';
import { ShareResponseDto } from './dto/share-response.dto';
import { memoryStorage } from 'multer';

@Controller('share')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 8 * 1024 * 1024, // 8MB default, will be validated in service
      },
    }),
  )
  async uploadShare(@UploadedFile() file: Express.Multer.File): Promise<ShareResponseDto> {
    return this.shareService.createShare(file);
  }
}

/**
 * Separate controller for share page route (without /api/v1 prefix)
 */
@Controller()
export class SharePageController {
  constructor(private readonly shareService: ShareService) {}

  @Get('s/:shareId')
  async getSharePage(@Param('shareId') shareId: string, @Res() res: Response): Promise<void> {
    const html = await this.shareService.getSharePageHtml(shareId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}

