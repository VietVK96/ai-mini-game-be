import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import { join } from 'path';
import { ShareResponseDto } from './dto/share-response.dto';

const sharp = require('sharp');

interface ShareMetadata {
  createdAt: string;
  expiresAt: string;
}

@Injectable()
export class ShareService {
  private readonly sharesDir: string;
  private readonly publicBaseUrl: string;
  private readonly shareTtlSeconds: number;
  private readonly maxUploadMB: number;
  private readonly appShareUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.sharesDir = join(process.cwd(), 'public', 'shares');
    const app = this.configService.get('app');
    this.publicBaseUrl = app?.publicBaseUrl || 'http://localhost:3001';
    this.shareTtlSeconds = app?.shareTtlSeconds || 21600;
    this.maxUploadMB = app?.maxUploadMB || 8;
    this.appShareUrl = app?.appShareUrl || 'https://zapp.vn';

    // Ensure public and shares directories exist (fire and forget, errors are handled)
    this.ensureSharesDirectory().catch((error) => {
      console.error('Failed to create shares directory:', error);
    });
  }

  private async ensureSharesDirectory(): Promise<void> {
    try {
      // Ensure public directory exists first
      const publicDir = join(process.cwd(), 'public');
      await fs.mkdir(publicDir, { recursive: true });
      
      // Then ensure shares directory exists
      await fs.mkdir(this.sharesDir, { recursive: true });
      
      // Verify directory exists and is accessible
      try {
        await fs.access(this.sharesDir);
      } catch (accessError) {
        console.error('Directory created but not accessible:', accessError);
        throw new Error(`Shares directory is not accessible: ${this.sharesDir}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = error && typeof error === 'object' && 'code' in error ? error.code : 'N/A';
      console.error('Failed to create shares directory:', {
        path: this.sharesDir,
        cwd: process.cwd(),
        error: errorMessage,
        errorCode: errorCode,
      });
      throw error;
    }
  }

  /**
   * Create a new share and save uploaded image
   */
  async createShare(file: Express.Multer.File): Promise<ShareResponseDto> {
    // Ensure directory exists before processing
    try {
      await this.ensureSharesDirectory();
    } catch (error) {
      console.error('Shares directory not available:', error);
      throw new BadRequestException('Server configuration error: shares directory unavailable');
    }

    // Validate file
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const maxSizeBytes = this.maxUploadMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException(`File size exceeds ${this.maxUploadMB}MB limit`);
    }

    // Validate MIME type
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, and WebP images are allowed');
    }

    // Generate shareId
    const shareId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.shareTtlSeconds * 1000);

    // Save metadata
    const metadata: ShareMetadata = {
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const metadataPath = join(this.sharesDir, `${shareId}.json`);
    let metadataSaved = false;

    try {
      // Double-check directory exists before writing
      await fs.mkdir(this.sharesDir, { recursive: true });
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
      metadataSaved = true;
    } catch (error) {
      console.error('Failed to save metadata:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error details:', {
        path: metadataPath,
        sharesDir: this.sharesDir,
        error: errorMessage,
      });
      throw new BadRequestException(`Failed to save share metadata: ${errorMessage}`);
    }

    // Convert and save image as JPEG using sharp
    const imagePath = join(this.sharesDir, `${shareId}.jpg`);
    try {
      await sharp(file.buffer)
        .jpeg({ quality: 90 })
        .toFile(imagePath);
    } catch (error) {
      console.error('Failed to process image:', error);
      // Cleanup metadata if image save fails
      if (metadataSaved) {
        await fs.unlink(metadataPath).catch(() => {
          // Ignore cleanup errors
        });
      }
      throw new BadRequestException(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      shareId,
      sharePageUrl: `${this.publicBaseUrl}/s/${shareId}`,
      imageUrl: `${this.publicBaseUrl}/shares/${shareId}.jpg`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Get share metadata
   */
  async getShareMetadata(shareId: string): Promise<ShareMetadata | null> {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(shareId)) {
      return null;
    }

    const metadataPath = join(this.sharesDir, `${shareId}.json`);
    try {
      const content = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(content) as ShareMetadata;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if share exists and is not expired
   */
  async isShareValid(shareId: string): Promise<boolean> {
    const metadata = await this.getShareMetadata(shareId);
    if (!metadata) {
      return false;
    }

    const expiresAt = new Date(metadata.expiresAt);
    return expiresAt > new Date();
  }

  /**
   * Get share page HTML with Open Graph tags
   */
  async getSharePageHtml(shareId: string): Promise<string> {
    const isValid = await this.isShareValid(shareId);
    const app = this.configService.get('app');
    const fbAppId = app?.fbAppId;
    const sharePageUrl = `${this.publicBaseUrl}/s/${shareId}`;
    const imageUrl = `${this.publicBaseUrl}/shares/${shareId}.jpg`;

    if (!isValid) {
      return this.getExpiredPageHtml();
    }

    const ogTitle = 'ZAPP ẢNH AI - Tạo ảnh đẹp chỉ với một click!';
    const ogDescription = `Xin lỗi chứ nếu ảnh tui còn chưa Dziêng thì ai Dziêng cho nổi mấy ní?

Click có một cái mà ra hình cỡ này, nhiều click chắc tui lên bìa tạp chí luôn 😌

Ní nào mê ảnh đẹp thì vô ZAPP ẢNH AI thử liền nha!

#ZAPP #ZAPPCHATDZIENG #khoidaychatdzieng #ZAPPANHAI`;
    const ogType = 'website';

    let html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${ogTitle}</title>
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="${ogType}">
  <meta property="og:url" content="${sharePageUrl}">
  <meta property="og:title" content="${ogTitle}">
  <meta property="og:description" content="test">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:secure_url" content="${imageUrl}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  ${fbAppId ? `<meta property="fb:app_id" content="${fbAppId}">` : ''}
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${sharePageUrl}">
  <meta name="twitter:title" content="${ogTitle}">
  <meta name="twitter:description" content="${ogDescription}">
  <meta name="twitter:image" content="${imageUrl}">
</head>
<body>
  <div style="text-align: center; padding: 50px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; color: white;">
    <div style="max-width: 800px; margin: 0 auto; background: white; border-radius: 20px; padding: 40px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
      <h1 style="color: #667eea; margin-bottom: 20px; font-size: 28px;">ZAPP ẢNH AI</h1>
      <div style="width: 100%; display: flex; justify-content: center; align-items: center; margin: 20px 0;">
        <img src="${imageUrl}" alt="Ảnh AI đã tạo" style="width: 100%; max-width: 100%; height: auto; display: block; object-fit: contain; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
      </div>
      
      <div style="color: #333; margin: 30px 0; line-height: 1.8; font-size: 16px;">
        <p style="margin-bottom: 15px;">Xin lỗi chứ nếu ảnh tui còn chưa Dziêng thì ai Dziêng cho nổi mấy ní? 😅</p>
        <p style="margin-bottom: 15px;">Click có một cái mà ra hình cỡ này, nhiều click chắc tui lên bìa tạp chí luôn 😌</p>
        <p style="margin-bottom: 30px; font-weight: bold;">Ní nào mê ảnh đẹp thì vô ZAPP ẢNH AI thử liền nha!</p>
      </div>
      
      <a href="${this.appShareUrl}" style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 18px; box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4); transition: transform 0.2s;">
        👉 Link Zapp ảnh
      </a>
      
      <div style="margin-top: 30px; color: #999; font-size: 14px;">
        <p>#ZAPP #ZAPPCHATDZIENG #khoidaychatdzieng #ZAPPANHAI</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    return html;
  }

  /**
   * Get expired page HTML
   */
  private getExpiredPageHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Image Expired</title>
</head>
<body>
  <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
    <h1>Ảnh đã hết hạn</h1>
    <p>Ảnh này đã hết hạn hoặc không tồn tại.</p>
  </div>
</body>
</html>`;
  }

  /**
   * Cleanup expired shares
   */
  async cleanupExpiredShares(): Promise<number> {
    let deletedCount = 0;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    try {
      const files = await fs.readdir(this.sharesDir);
      const now = new Date();

      for (const file of files) {
        // Only process JSON metadata files
        if (!file.endsWith('.json')) {
          continue;
        }

        const shareId = file.replace('.json', '');
        // Validate UUID format to avoid deleting wrong files
        if (!uuidRegex.test(shareId)) {
          continue;
        }

        try {
          const metadataPath = join(this.sharesDir, file);
          const content = await fs.readFile(metadataPath, 'utf-8');
          const metadata = JSON.parse(content) as ShareMetadata;
          const expiresAt = new Date(metadata.expiresAt);

          if (expiresAt <= now) {
            // Delete both JSON and JPG files
            await fs.unlink(metadataPath).catch(() => {});
            const imagePath = join(this.sharesDir, `${shareId}.jpg`);
            await fs.unlink(imagePath).catch(() => {});
            deletedCount++;
          }
        } catch (error) {
          // Skip files that can't be read or parsed
          console.warn(`Failed to process ${file}:`, error);
        }
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }

    return deletedCount;
  }
}

