import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { MemoryCacheService } from '../memory-cache/memory-cache.service';
import { RealtimeService } from '../realtime/realtime.service';
import { GeminiService } from '../gemini/gemini.service';
import { TemplatesService } from 'src/templates/templates.service';
import { Style } from 'src/jobs/dto/create-job.dto';
import * as fs from 'fs';
import { join } from 'path';

/**
 * Map style enum or string to outfit filenames (Male and Female)
 * Format: style enum/string -> { male: PascalCaseNam.png, female: PascalCaseNu.png }
 */
function getOutfitFileNames(style: Style | string): { male: string; female: string } {
  // Convert style to string to handle both enum and string values
  const styleStr = String(style);
  const styleMap: Record<string, { male: string; female: string }> = {
    [Style.COOL_NGAU]: { male: 'CoolNgauNam.png', female: 'CoolNgauNu.png' },
    [Style.NGHIEM_TUK]: { male: 'NghiemTukNam.png', female: 'NghiemTukNu.png' },
    [Style.HUONG_NGOAI]: { male: 'HuongNgoaiNam.png', female: 'HuongNgoaiNu.png' },
    [Style.CHILL_GUY]: { male: 'ChillGuyNam.png', female: 'ChillGuyNu.png' },
    [Style.FASHION]: { male: 'FashionNam.png', female: 'FashionNu.png' },
    [Style.BEO_XINH]: { male: 'BeoXinhNam.png', female: 'BeoXinhNu.png' },
  };
  return styleMap[styleStr] || styleMap[Style.COOL_NGAU];
}

@Processor('gen')
export class GenConsumer {
  constructor(
    private memoryCacheService: MemoryCacheService,
    private realtimeService: RealtimeService,
    private geminiService: GeminiService,
    private templatesService: TemplatesService,
  ) {
    console.log('🏭 CONSUMER: GenConsumer initialized and ready to process jobs');
    console.log('🏭 CONSUMER: Dependencies injected:', {
      memoryCache: !!this.memoryCacheService,
      realtime: !!this.realtimeService,
      gemini: !!this.geminiService,
      templates: !!this.templatesService,
    });
  }

  @Process('generate')
  async handleGenerate(job: Job) {
    console.log(`🔥🔥🔥 CONSUMER TRIGGERED! Job ID: ${job.id}`);  
    const { jobId, file, prompt, templateId, aspectRatio = '1:1', style = 'cool_ngau' } = job.data;
    
    try {
      // Update job status
      await this.memoryCacheService.updateJobMetadata(jobId, {
        status: 'running',
        progress: 10,
        message: 'Starting image generation...',
      });

      this.realtimeService.emitJobProgress(jobId, {
        status: 'running',
        progress: 10,
        message: 'Starting image generation...',
      });

      // Get template
      const template = await this.templatesService.getTemplate(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      if (!template.backgroundPath) {
        throw new Error('Template backgroundPath is required');
      }

      console.log('🎨 CONSUMER: Template info:', {
        id: template.id,
        name: template.name,
        backgroundPath: template.backgroundPath,
        aspectRatio: aspectRatio
      });

      // Convert buffer data back to Buffer if it was serialized
      let inputBuffer: Buffer;
      if (Buffer.isBuffer(file.buffer)) {
        inputBuffer = file.buffer;
      } else if (file.buffer?.data && Array.isArray(file.buffer.data)) {
        // Handle serialized buffer data
        inputBuffer = Buffer.from(file.buffer.data);
      } else {
        throw new Error('Invalid file buffer format');
      }

      // Read reference template image (den.png or vang.png)
      await this.memoryCacheService.updateJobMetadata(jobId, {
        progress: 20,
        message: 'Đang đọc ảnh template reference...',
      });

      this.realtimeService.emitJobProgress(jobId, {
        status: 'running',
        progress: 20,
        message: 'Đang đọc ảnh template reference...',
      });

      const backgroundTemplatePath = join(process.cwd(), 'public', template.overlayPath);
      const backgroundTemplateBuffer = await fs.promises.readFile(backgroundTemplatePath);
      const backgroundTemplateBase64 = backgroundTemplateBuffer.toString('base64');

      const backgroundMimeType = this.getMimeType(backgroundTemplatePath);
      const inputMimeType = file.mimetype || 'image/jpeg';

      // Read both male and female outfit images based on style (outfit already includes logo)
      const outfitFileNames = getOutfitFileNames(style);
      const maleOutfitPath = join(process.cwd(), 'public', 'templates', 'outfit', outfitFileNames.male);
      const femaleOutfitPath = join(process.cwd(), 'public', 'templates', 'outfit', outfitFileNames.female);
      
      let maleOutfitBuffer: Buffer;
      let maleOutfitBase64: string;
      let maleOutfitMimeType: string;
      let femaleOutfitBuffer: Buffer;
      let femaleOutfitBase64: string;
      let femaleOutfitMimeType: string;
      
      try {
        // Read male outfit
        maleOutfitBuffer = await fs.promises.readFile(maleOutfitPath);
        maleOutfitBase64 = maleOutfitBuffer.toString('base64');
        maleOutfitMimeType = this.getMimeType(maleOutfitPath);
        console.log('👕 CONSUMER: Male outfit image loaded:', outfitFileNames.male, 'size:', maleOutfitBuffer.length, 'bytes');
      } catch (error) {
        console.warn(`⚠️ CONSUMER: Male outfit image not found for style ${style} (${outfitFileNames.male}), using default cool_ngau`);
        // Fallback to cool_ngau if outfit not found
        const defaultMaleOutfitPath = join(process.cwd(), 'public', 'templates', 'outfit', 'CoolNgauNam.png');
        maleOutfitBuffer = await fs.promises.readFile(defaultMaleOutfitPath);
        maleOutfitBase64 = maleOutfitBuffer.toString('base64');
        maleOutfitMimeType = this.getMimeType(defaultMaleOutfitPath);
      }
      
      try {
        // Read female outfit
        femaleOutfitBuffer = await fs.promises.readFile(femaleOutfitPath);
        femaleOutfitBase64 = femaleOutfitBuffer.toString('base64');
        femaleOutfitMimeType = this.getMimeType(femaleOutfitPath);
        console.log('👕 CONSUMER: Female outfit image loaded:', outfitFileNames.female, 'size:', femaleOutfitBuffer.length, 'bytes');
      } catch (error) {
        console.warn(`⚠️ CONSUMER: Female outfit image not found for style ${style} (${outfitFileNames.female}), using default cool_ngau`);
        // Fallback to cool_ngau if outfit not found
        const defaultFemaleOutfitPath = join(process.cwd(), 'public', 'templates', 'outfit', 'CoolNgauNu.png');
        femaleOutfitBuffer = await fs.promises.readFile(defaultFemaleOutfitPath);
        femaleOutfitBase64 = femaleOutfitBuffer.toString('base64');
        femaleOutfitMimeType = this.getMimeType(defaultFemaleOutfitPath);
      }
      
      console.log('🎨 CONSUMER: Reference template loaded, size:', backgroundTemplateBuffer.length, 'bytes');
      console.log('🎨 CONSUMER: MIME types - Input:', inputMimeType, 'Reference:', backgroundMimeType);

      // AI Image Editing - Gửi cả ảnh chính và ảnh reference template cho AI
      await this.memoryCacheService.updateJobMetadata(jobId, {
        progress: 40,
        message: 'AI đang tạo ảnh theo template reference...',
      });

      this.realtimeService.emitJobProgress(jobId, {
        status: 'running',
        progress: 40,
        message: 'AI đang tạo ảnh theo template reference...',
      });

      // Sử dụng Gemini để tạo ảnh giống reference template nhưng với người từ ảnh chính
      const result = await this.geminiService.editImageWithReferenceTemplate({
        prompt,
        inputImage: inputBuffer.toString('base64'),
        backgroundTemplateImage: backgroundTemplateBase64,
        maleOutfitImage: maleOutfitBase64,
        femaleOutfitImage: femaleOutfitBase64,
        inputMimeType,
        backgroundMimeType,
        maleOutfitMimeType,
        femaleOutfitMimeType,
        aspectRatio,
        style,
        // referenceImage: referenceImageBase64,
        // referenceImageMimeType: referenceImageMimeType,
      });
      console.log('🎨 CONSUMER: Image created with reference template by Gemini, size:', result.length, 'bytes');

      // Save result
      await this.memoryCacheService.updateJobMetadata(jobId, {
        progress: 80,
        message: 'Saving result...',
      });

      this.realtimeService.emitJobProgress(jobId, {
        status: 'running',
        progress: 80,
        message: 'Saving result...',
      });
      
      await this.memoryCacheService.setJobResult(jobId, {
        buffer: result,
        mimeType: 'image/png',
        filename: `ai-generated-${jobId}.png`,
        createdAt: new Date(),
      });

      // Complete job
      await this.memoryCacheService.updateJobMetadata(jobId, {
        status: 'completed',
        progress: 100,
        message: 'Image generation completed!',
        completedAt: new Date(),
      });

      this.realtimeService.emitJobComplete(jobId, {
        status: 'completed',
        progress: 100,
        message: 'Image generation completed!',
      });

    } catch (error) {
      console.error(`Job processing error for job ${jobId}:`, error);
      
      // Update job status with more detailed error info
      const errorMessage = error.message || 'Unknown error occurred';
      const errorStack = error.stack || '';
      
      await this.memoryCacheService.updateJobMetadata(jobId, {
        status: 'failed',
        error: errorMessage,
        errorDetails: errorStack,
        failedAt: new Date(),
      });

      this.realtimeService.emitJobError(jobId, errorMessage);
      
      // Re-throw error để Bull Queue có thể handle retry
      throw error;
    }
  }

  private readonly getMimeType = (filePath: string): string => {
    const ext = filePath.toLowerCase().split('.').pop();
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  };
}
