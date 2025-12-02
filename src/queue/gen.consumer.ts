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
    const { jobId, file, prompt, templateId } = job.data;
    
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
      
      // Check if template has backgroundPath (not null)
      const templatePath = template.backgroundPath 
        ? join(process.cwd(), 'public', template.backgroundPath)
        : null;
      
      if (!templatePath) {
        throw new Error('Template background path is required');
      }

      console.log('🎨 CONSUMER: Template info:', {
        id: template.id,
        name: template.name,
        hasBackground: !!template.backgroundPath,
        templatePath: templatePath
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

      // Read background image from template file
      await this.memoryCacheService.updateJobMetadata(jobId, {
        progress: 20,
        message: 'Đang đọc ảnh background...',
      });

      this.realtimeService.emitJobProgress(jobId, {
        status: 'running',
        progress: 20,
        message: 'Đang đọc ảnh background...',
      });

      const backgroundBuffer = await fs.promises.readFile(templatePath);
      const backgroundBase64 = backgroundBuffer.toString('base64');
      console.log('🎨 CONSUMER: Background image loaded, size:', backgroundBuffer.length, 'bytes');

      // AI Image Editing - Chỉnh sửa ảnh chính theo prompt và thay background
      await this.memoryCacheService.updateJobMetadata(jobId, {
        progress: 40,
        message: 'AI đang chỉnh sửa ảnh và thay background...',
      });

      this.realtimeService.emitJobProgress(jobId, {
        status: 'running',
        progress: 40,
        message: 'AI đang chỉnh sửa ảnh và thay background...',
      });

      // Sử dụng Gemini để chỉnh sửa ảnh chính và thay background
      const result = await this.geminiService.editImageWithBackground(
        prompt, 
        inputBuffer.toString('base64'),
        backgroundBase64
      );
      console.log('🎨 CONSUMER: Image edited with background by Gemini, size:', result.length, 'bytes');

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
}
