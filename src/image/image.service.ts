import { Injectable } from '@nestjs/common';
import { join } from 'path';
import * as sharp from 'sharp';

@Injectable()
export class ImageService {
  async processImage(
    inputBuffer: Buffer,
    template: any,
    faceBuffer?: Buffer,
  ): Promise<Buffer> {
    try {
      // Validate input buffer
      if (!Buffer.isBuffer(inputBuffer)) {
        console.error('Invalid inputBuffer:', typeof inputBuffer, inputBuffer);
        throw new Error('inputBuffer must be a valid Buffer');
      }

      if (inputBuffer.length === 0) {
        throw new Error('inputBuffer is empty');
      }

      // Load template background
      const filePath = join(process.cwd(), 'public', template.backgroundPath);
      const background = await sharp(filePath);
      
      // Process input image - sử dụng method an toàn để resize
      let processedInput = await this.resizeToFitTemplate(
        inputBuffer, 
        template.placement.width, 
        template.placement.height
      );

      // Apply face swap if face image is provided
      if (faceBuffer && template.faceSwap) {
        if (!Buffer.isBuffer(faceBuffer)) {
          console.error('Invalid faceBuffer:', typeof faceBuffer, faceBuffer);
          throw new Error('faceBuffer must be a valid Buffer');
        }
        processedInput = await this.applyFaceSwap(processedInput, faceBuffer);
      }

      // Kiểm tra kích thước cuối cùng trước khi composite
      const finalMetadata = await sharp(processedInput).metadata();
      console.log(`Final image size: ${finalMetadata.width}x${finalMetadata.height}`);
      console.log(`Template placement: ${template.placement.width}x${template.placement.height}`);
      
      // Đảm bảo ảnh không vượt quá kích thước khung
      if (finalMetadata.width > template.placement.width || finalMetadata.height > template.placement.height) {
        console.error(`Image size exceeds template! Forcing resize to template size.`);
        
        // Force resize to exact template size
        processedInput = await sharp(processedInput)
          .resize(template.placement.width, template.placement.height, {
            fit: 'cover',
            position: 'center',
          })
          .toBuffer();
        
        const forcedMetadata = await sharp(processedInput).metadata();
        console.log(`Forced resize to: ${forcedMetadata.width}x${forcedMetadata.height}`);
      }

      // Composite the input image onto the background
      const result = await background
        .composite([
          {
            input: processedInput,
            left: template.placement.x,
            top: template.placement.y,
          },
        ])
        .webp({ quality: 90 })
        .toBuffer();

      return result;
      
    } catch (error) {
      console.error('Image processing error:', error);
      throw new Error(`Failed to process image: ${error.message}`);
    }
  }

  private async applyFaceSwap(inputBuffer: Buffer, faceBuffer: Buffer): Promise<Buffer> {
    // This is a placeholder for face swap functionality
    // In a real implementation, you would use a face detection/swap library
    // like face-api.js, OpenCV, or a dedicated face swap service
    
    console.log('Face swap requested but not implemented');
    return inputBuffer;
  }

  async resizeImage(
    buffer: Buffer,
    width: number,
    height: number,
    quality: number = 90,
  ): Promise<Buffer> {
    return sharp(buffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality })
      .toBuffer();
  }

  async convertToWebp(buffer: Buffer, quality: number = 90): Promise<Buffer> {
    return sharp(buffer)
      .webp({ quality })
      .toBuffer();
  }

  async getImageMetadata(buffer: Buffer) {
    return sharp(buffer).metadata();
  }

  /**
   * Resize ảnh để vừa khung template một cách an toàn
   */
  async resizeToFitTemplate(
    inputBuffer: Buffer, 
    templateWidth: number, 
    templateHeight: number
  ): Promise<Buffer> {
    const metadata = await sharp(inputBuffer).metadata();
    console.log(`Original image: ${metadata.width}x${metadata.height}`);
    console.log(`Template size: ${templateWidth}x${templateHeight}`);

    // Tính tỷ lệ để ảnh vừa khung (chọn tỷ lệ nhỏ nhất)
    const widthRatio = templateWidth / metadata.width;
    const heightRatio = templateHeight / metadata.height;
    const ratio = Math.min(widthRatio, heightRatio);

    let newWidth = Math.floor(metadata.width * ratio);
    let newHeight = Math.floor(metadata.height * ratio);

    // Đảm bảo KHÔNG vượt quá kích thước template
    newWidth = Math.min(newWidth, templateWidth);
    newHeight = Math.min(newHeight, templateHeight);

    console.log(`Calculated size: ${newWidth}x${newHeight}`);
    console.log(`Template limits: ${templateWidth}x${templateHeight}`);

    // Kiểm tra lại một lần nữa
    if (newWidth > templateWidth || newHeight > templateHeight) {
      console.warn('Calculated size exceeds template, forcing to template size');
      newWidth = templateWidth;
      newHeight = templateHeight;
    }

    console.log(`Final resize to: ${newWidth}x${newHeight}`);

    return sharp(inputBuffer)
      .resize(newWidth, newHeight, {
        fit: 'cover',
        position: 'center',
      })
      .toBuffer();
  }
}
