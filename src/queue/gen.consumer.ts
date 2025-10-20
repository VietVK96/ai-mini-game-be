import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { MemoryCacheService } from '../memory-cache/memory-cache.service';
import { RealtimeService } from '../realtime/realtime.service';
import { GeminiService } from '../gemini/gemini.service';
import { ImageService } from '../image/image.service';
import { TemplatesService } from 'src/templates/templates.service';
import * as fs from 'fs';
import { join } from 'path';

@Processor('gen')
export class GenConsumer {
  constructor(
    private memoryCacheService: MemoryCacheService,
    private realtimeService: RealtimeService,
    private geminiService: GeminiService,
    private imageService: ImageService,
    private templatesService: TemplatesService,
  ) {
    console.log('🏭 CONSUMER: GenConsumer initialized and ready to process jobs');
    console.log('🏭 CONSUMER: Dependencies injected:', {
      memoryCache: !!this.memoryCacheService,
      realtime: !!this.realtimeService,
      gemini: !!this.geminiService,
      image: !!this.imageService,
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
      
      console.log('🎨 CONSUMER: Template info:', {
        id: template.id,
        name: template.name,
        hasBackground: !!template.backgroundPath,
        templatePath: templatePath
      });

      // Enhance prompt
      await this.memoryCacheService.updateJobMetadata(jobId, {
        progress: 20,
        message: 'Enhancing prompt...',
      });

      this.realtimeService.emitJobProgress(jobId, {
        status: 'running',
        progress: 20,
        message: 'Enhancing prompt...',
      });

      // const enhancedPrompt = await this.geminiService.enhancePrompt(prompt);

      // Generate enhanced prompt for image generation
      await this.memoryCacheService.updateJobMetadata(jobId, {
        progress: 40,
        message: 'Tạo prompt nâng cao cho AI...',
      });

      this.realtimeService.emitJobProgress(jobId, {
        status: 'running',
        progress: 40,
        message: 'Tạo prompt nâng cao cho AI...',
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


      // AI Image Editing - Chỉnh sửa ảnh theo prompt
      await this.memoryCacheService.updateJobMetadata(jobId, {
        progress: 50,
        message: 'AI đang chỉnh sửa ảnh...',
      });

      this.realtimeService.emitJobProgress(jobId, {
        status: 'running',
        progress: 50,
        message: 'AI đang chỉnh sửa ảnh...',
      });

      // Sử dụng Gemini để chỉnh sửa ảnh
      const editedImage = await this.geminiService.editImage(prompt, inputBuffer.toString('base64'));
      console.log('🎨 CONSUMER: Image edited by Gemini, size:', editedImage.length, 'bytes');

      // Process image with template frame
      await this.memoryCacheService.updateJobMetadata(jobId, {
        progress: 70,
        message: 'Đang tạo khung ảnh...',
      });

      this.realtimeService.emitJobProgress(jobId, {
        status: 'running',
        progress: 70,
        message: 'Đang tạo khung ảnh...',
      });

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

      const result = await this.imageService.processImage(editedImage, templatePath || undefined);
      console.log('🖼️ CONSUMER: Image processing completed, result size:', result.length, 'bytes');
      
      await this.memoryCacheService.setJobResult(jobId, {
        buffer: result,
        mimeType: 'image/webp',
        filename: `ai-generated-${jobId}.webp`,
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
