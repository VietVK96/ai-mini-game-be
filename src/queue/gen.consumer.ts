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
    console.log(`[${new Date().toISOString()}] 🔥🔥🔥 CONSUMER TRIGGERED! Job ID: ${job.id}`);  
    const { jobId, file, prompt, aspectRatio = '1:1', id_request = '1-1' } = job.data;
    
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

      // Get template bg paths for nam and nu based on id_request
      const templateBg = await this.templatesService.getTemplateBg(id_request);
      if (!templateBg) {
        throw new Error(`Template bg not found for id_request: ${id_request}`);
      }

      console.log('🎨 CONSUMER: Template bg info:', {
        id: templateBg.id,
        name: templateBg.name,
        namPath: templateBg.namPath,
        nuPath: templateBg.nuPath,
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

      // Read nam and nu images (already contain pose, outfit, and background)
      await this.memoryCacheService.updateJobMetadata(jobId, {
        progress: 20,
        message: 'Đang đọc ảnh template nam/nữ...',
      });

      this.realtimeService.emitJobProgress(jobId, {
        status: 'running',
        progress: 20,
        message: 'Đang đọc ảnh template nam/nữ...',
      });

      const namImagePath = join(process.cwd(), 'public', templateBg.namPath);
      const nuImagePath = join(process.cwd(), 'public', templateBg.nuPath);
      
      let namImageBuffer: Buffer;
      let namImageBase64: string;
      let namImageMimeType: string;
      let nuImageBuffer: Buffer;
      let nuImageBase64: string;
      let nuImageMimeType: string;
      
      try {
        // Read nam image
        namImageBuffer = await fs.promises.readFile(namImagePath);
        namImageBase64 = namImageBuffer.toString('base64');
        namImageMimeType = this.getMimeType(namImagePath);
        console.log('👤 CONSUMER: Nam image loaded:', templateBg.namPath, 'size:', namImageBuffer.length, 'bytes');
      } catch (error) {
        throw new Error(`Failed to load nam image from path: ${templateBg.namPath}`);
      }
      
      try {
        // Read nu image
        nuImageBuffer = await fs.promises.readFile(nuImagePath);
        nuImageBase64 = nuImageBuffer.toString('base64');
        nuImageMimeType = this.getMimeType(nuImagePath);
        console.log('👤 CONSUMER: Nu image loaded:', templateBg.nuPath, 'size:', nuImageBuffer.length, 'bytes');
      } catch (error) {
        throw new Error(`Failed to load nu image from path: ${templateBg.nuPath}`);
      }

      const inputMimeType = file.mimetype || 'image/jpeg';
      
      console.log('🎨 CONSUMER: Images loaded - Input:', inputMimeType, 'Nam:', namImageMimeType, 'Nu:', nuImageMimeType);

      // AI Image Editing - Thay mặt từ input vào ảnh nam hoặc nữ tùy giới tính
      await this.memoryCacheService.updateJobMetadata(jobId, {
        progress: 40,
        message: 'AI đang thay mặt vào ảnh template...',
      });

      this.realtimeService.emitJobProgress(jobId, {
        status: 'running',
        progress: 40,
        message: 'AI đang thay mặt vào ảnh template...',
      });

      // Sử dụng Gemini để thay mặt từ input vào ảnh nam hoặc nữ (ảnh đã có sẵn pose, trang phục, background)
      // Dùng nam image làm background template (tạm thời), AI sẽ chọn nam hoặc nữ dựa trên giới tính
      const result = await this.geminiService.editImageWithReferenceTemplate({
        prompt,
        inputImage: inputBuffer.toString('base64'),
        maleOutfitImage: namImageBase64, // Ảnh nam đã có sẵn pose, trang phục, background
        femaleOutfitImage: nuImageBase64, // Ảnh nữ đã có sẵn pose, trang phục, background
        inputMimeType,
        maleOutfitMimeType: namImageMimeType,
        femaleOutfitMimeType: nuImageMimeType,
        aspectRatio,
      });
      console.log('🎨 CONSUMER: Image created by Gemini, size:', result.length, 'bytes');

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
