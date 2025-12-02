import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { v4 as uuidv4 } from 'uuid';
import { CreateJobDto } from './dto/create-job.dto';
import { MemoryCacheService } from 'src/memory-cache/memory-cache.service';
import { RealtimeService } from 'src/realtime/realtime.service';
import { JobResult, JobMetadata } from 'src/memory-cache/memory-cache.types';
import { GeminiService } from 'src/gemini/gemini.service';

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue('gen') private genQueue: Queue,
    private memoryCacheService: MemoryCacheService,
    private realtimeService: RealtimeService,
    private geminiService: GeminiService,
  ) {}

  async createJob(createJobDto: CreateJobDto) {
    const jobId = uuidv4();
    
    console.log(`📝 JOBS: Creating job ${jobId} with prompt: ${createJobDto.prompt}`);
    
    try {
      // Check queue status
      const waiting = await this.genQueue.getWaiting();
      const active = await this.genQueue.getActive();
      const completed = await this.genQueue.getCompleted();
      const failed = await this.genQueue.getFailed();
      
      console.log(`📊 QUEUE STATUS: Waiting: ${waiting.length}, Active: ${active.length}, Completed: ${completed.length}, Failed: ${failed.length}`);
      
      // Add job to queue
      console.log(`📤 JOBS: Adding job to queue with data:`, {
        jobId,
        prompt: createJobDto.prompt,
        templateId: createJobDto.templateId,
        hasFile: !!createJobDto.file
      });
      
      const job = await this.genQueue.add('generate', {
        jobId,
        file: createJobDto.file,
        prompt: createJobDto.prompt,
        templateId: createJobDto.templateId,
      });

      console.log(`✅ JOBS: Job ${jobId} added to queue with Bull job ID: ${job.id}`);
      console.log(`✅ JOBS: Job options:`, job.opts);
      console.log(`✅ JOBS: Job data:`, job.data);

      // Check if job is actually in queue
      const queueStatus = await this.genQueue.getJob(job.id);
      console.log(`🔍 JOBS: Job in queue:`, queueStatus ? 'YES' : 'NO');
      console.log(`🔍 JOBS: Job status:`, queueStatus?.opts);

      // Listen for queue events
      this.genQueue.on('completed', (job, result) => {
        console.log(`🎉 QUEUE EVENT: Job ${job.id} completed with result:`, result);
      });
      
      this.genQueue.on('failed', (job, err) => {
        console.log(`❌ QUEUE EVENT: Job ${job.id} failed with error:`, err);
      });
      
      this.genQueue.on('active', (job) => {
        console.log(`🔄 QUEUE EVENT: Job ${job.id} is now active`);
      });

      // Store job metadata
      await this.memoryCacheService.setJobMetadata(jobId, {
        status: 'queued',
        progress: 0,
        message: 'Job queued for processing',
        createdAt: new Date(),
      });

      return {
        jobId,
        status: 'queued',
        message: 'Job created successfully',
      };
    } catch (error) {
      console.error(`Failed to create job ${jobId}:`, error);
      throw error;
    }
  }

  async getJobStream(jobId: string) {
    console.log(`🔍 JOBS: Getting stream for job: ${jobId}`);
    
    const metadata = await this.memoryCacheService.getJobMetadata(jobId);
    console.log(`🔍 JOBS: Job metadata:`, metadata);
    
    if (!metadata) {
      console.log(`🔍 JOBS: Job not found: ${jobId}`);
      throw new NotFoundException('Job not found');
    }

    const stream = this.realtimeService.createJobStream(jobId);
    console.log(`🔍 JOBS: Stream created for job: ${jobId}`);
    return stream;
  }

  async getJobResult(jobId: string): Promise<JobResult | null> {
    return this.memoryCacheService.getJobResult(jobId);
  }

  async getJobStatus(jobId: string): Promise<JobMetadata | null> {
    const metadata = await this.memoryCacheService.getJobMetadata(jobId);
    
    if (!metadata) {
      throw new NotFoundException('Job not found');
    }

    return metadata;
  }

  async cancelJob(jobId: string) {
    const job = await this.genQueue.getJob(jobId);
    
    if (job) {
      await job.remove();
    }

    await this.memoryCacheService.deleteJobMetadata(jobId);
    await this.memoryCacheService.deleteJobResult(jobId);

    return { message: 'Job cancelled successfully' };
  }

  // Test method to check queue status
  async testQueue() {
    try {
      console.log('🧪 TEST: Testing queue connection...');
      
      const waiting = await this.genQueue.getWaiting();
      const active = await this.genQueue.getActive();
      const completed = await this.genQueue.getCompleted();
      const failed = await this.genQueue.getFailed();
      
      console.log('🧪 TEST: Queue status:', {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length
      });

      // Test adding a simple job
      const testJob = await this.genQueue.add('generate', {
        jobId: 'test-' + Date.now(),
        file: null,
        prompt: 'test',
        templateId: 'test'
      });

      console.log('🧪 TEST: Test job added:', testJob.id);
      
      return {
        queueStatus: { waiting: waiting.length, active: active.length, completed: completed.length, failed: failed.length },
        testJobId: testJob.id
      };
    } catch (error) {
      console.error('🧪 TEST: Queue test failed:', error);
      throw error;
    }
  }

  // Method to manually trigger queue processing
  async triggerQueueProcessing() {
    try {
      console.log('🔄 TRIGGER: Manually triggering queue processing...');
      
      // Get waiting jobs
      const waiting = await this.genQueue.getWaiting();
      console.log('🔄 TRIGGER: Waiting jobs:', waiting.length);
      
      if (waiting.length > 0) {
        console.log('🔄 TRIGGER: Found waiting jobs, attempting to process...');
        
        // Try to process the first waiting job
        const firstJob = waiting[0];
        console.log('🔄 TRIGGER: First waiting job:', firstJob.id, firstJob.data);
        
        // Check if job is still waiting
        const jobState = await firstJob.getState();
        console.log('🔄 TRIGGER: Job state:', jobState);
        
        return {
          message: 'Queue processing triggered',
          waitingJobs: waiting.length,
          firstJobId: firstJob.id,
          firstJobState: jobState
        };
      } else {
        console.log('🔄 TRIGGER: No waiting jobs found');
        return {
          message: 'No waiting jobs to process',
          waitingJobs: 0
        };
      }
    } catch (error) {
      console.error('🔄 TRIGGER: Failed to trigger queue processing:', error);
      throw error;
    }
  }

  // Clear all jobs from queue
  async clearQueue() {
    try {
      console.log('🧹 CLEAR: Clearing all jobs from queue...');
      
      // Get all jobs
      const waiting = await this.genQueue.getWaiting();
      const active = await this.genQueue.getActive();
      const completed = await this.genQueue.getCompleted();
      const failed = await this.genQueue.getFailed();
      
      console.log('🧹 CLEAR: Before clear - Waiting:', waiting.length, 'Active:', active.length, 'Completed:', completed.length, 'Failed:', failed.length);
      
      // Clear all jobs
      await this.genQueue.empty();
      
      // Verify clear
      const waitingAfter = await this.genQueue.getWaiting();
      const activeAfter = await this.genQueue.getActive();
      
      console.log('🧹 CLEAR: After clear - Waiting:', waitingAfter.length, 'Active:', activeAfter.length);
      
      return {
        message: 'Queue cleared successfully',
        before: { waiting: waiting.length, active: active.length, completed: completed.length, failed: failed.length },
        after: { waiting: waitingAfter.length, active: activeAfter.length }
      };
    } catch (error) {
      console.error('🧹 CLEAR: Failed to clear queue:', error);
      throw error;
    }
  }

  // Get pricing information
  async getPricingInfo() {
    try {
      console.log('💰 PRICING: Getting Gemini pricing information...');
      
      const pricingInfo = this.geminiService.getPricingInfo();
      
      return {
        message: 'Pricing information retrieved successfully',
        ...pricingInfo,
        lastUpdated: new Date().toISOString(),
        note: 'Prices are in USD and based on Google Gemini 2.5 Flash Image API pricing'
      };
    } catch (error) {
      console.error('💰 PRICING: Failed to get pricing info:', error);
      throw error;
    }
  }
}
