import { Injectable } from '@nestjs/common';
import { join } from 'path';
const sharp = require('sharp');

@Injectable()
export class ImageService {
  async processImage(
    inputBuffer: Buffer,
    templatePath?: string,
  ): Promise<Buffer> {
    try {
      console.log('🖼️ IMAGE: Starting image processing...');
      
      // Validate input buffer
      if (!Buffer.isBuffer(inputBuffer)) {
        console.error('Invalid inputBuffer:', typeof inputBuffer, inputBuffer);
        throw new Error('inputBuffer must be a valid Buffer');
      }

      if (inputBuffer.length === 0) {
        throw new Error('inputBuffer is empty');
      }

      // Get input image dimensions
      const inputMetadata = await sharp(inputBuffer).metadata();
      console.log('🖼️ IMAGE: Input image dimensions:', {
        width: inputMetadata.width,
        height: inputMetadata.height,
        format: inputMetadata.format
      });

      let result: Buffer;

      if (templatePath) {
        console.log('🖼️ IMAGE: Processing with template:', templatePath);
        
        // Resize template to match input image dimensions
        const resizedTemplate = await sharp(templatePath)
          .resize(inputMetadata.width, inputMetadata.height, {
            fit: 'fill',
            position: 'center'
          })
          .png()
          .toBuffer();

        console.log('🖼️ IMAGE: Template resized to match input dimensions');

        // Composite: overlay template (frame) on top of input image
        result = await sharp(inputBuffer)
          .composite([
            {
              input: resizedTemplate,
              blend: 'over'
            }
          ])
          .png()
          .toBuffer();
      } else {
        console.log('🖼️ IMAGE: No template provided, returning original image');
        
        // No template - just return the processed input image
        result = await sharp(inputBuffer)
          .png()
          .toBuffer();
      }

      console.log('🖼️ IMAGE: Image processing completed successfully');
      console.log('🖼️ IMAGE: Result buffer size:', result.length, 'bytes');

      return result;
      
    } catch (error) {
      console.error('Image processing error:', error);
      throw new Error(`Failed to process image: ${error.message}`);
    }
  }

  // Method to test no-template processing
  async processImageWithoutTemplate(inputBuffer: Buffer): Promise<Buffer> {
    return this.processImage(inputBuffer, undefined);
  }

}
