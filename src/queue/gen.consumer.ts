import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { MemoryCacheService } from '../memory-cache/memory-cache.service';
import { RealtimeService } from '../realtime/realtime.service';
import { GeminiService } from '../gemini/gemini.service';
import { TemplatesService } from 'src/templates/templates.service';
import * as fs from 'fs';
import { join } from 'path';

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
    const { jobId, file, prompt, templateId, aspectRatio = '1:1' } = job.data;
    
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

      const LogoPath = join(process.cwd(), 'public', '/templates/Logo_ZAPP.png');
      const logoBuffer = await fs.promises.readFile(LogoPath);
      const logoBase64 = logoBuffer.toString('base64');
      const logoMimeType = this.getMimeType(LogoPath);
      
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
        logoImage: logoBase64,
        inputMimeType,
        backgroundMimeType,
        logoMimeType,
        aspectRatio,
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
