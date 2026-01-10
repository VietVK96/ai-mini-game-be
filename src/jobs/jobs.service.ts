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
  private eventListenersInitialized = false;

  constructor(
    @InjectQueue('gen') private genQueue: Queue,
    private memoryCacheService: MemoryCacheService,
    private realtimeService: RealtimeService,
    private geminiService: GeminiService,
  ) {
    // Initialize event listeners only once in constructor
    this.initializeQueueEventListeners();
  }

  private initializeQueueEventListeners(): void {
    if (this.eventListenersInitialized) {
      return;
    }

    this.genQueue.on('completed', (job, result) => {
      console.log(`[${new Date().toISOString()}] 🎉 QUEUE EVENT: Job ${job.id} completed with result:`, result);
    });
    
    this.genQueue.on('failed', (job, err) => {
      console.log(`[${new Date().toISOString()}] ❌ QUEUE EVENT: Job ${job.id} failed with error:`, err);
    });
    
    this.genQueue.on('active', (job) => {
      console.log(`[${new Date().toISOString()}] 🔄 QUEUE EVENT: Job ${job.id} is now active`);
    });

    this.eventListenersInitialized = true;
  }

  async createJob(createJobDto: CreateJobDto) {
    const jobId = uuidv4();
    
    try {
      // Don't load all queue status on every job creation - this causes memory issues
      // Only load when explicitly needed (e.g., in testQueue endpoint)
      
      const job = await this.genQueue.add('generate', {
        jobId,
        file: createJobDto.file,
        prompt: createJobDto.prompt,
        templateId: createJobDto.templateId,
        aspectRatio: createJobDto.aspectRatio,
        style: createJobDto.style || 'cool_ngau',
        id_request: createJobDto.id_request || '1-1',
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
    const metadata = await this.memoryCacheService.getJobMetadata(jobId);
    if (!metadata) {
      console.log(`[${new Date().toISOString()}] 🔍 JOBS: Job not found: ${jobId}`);
      throw new NotFoundException('Job not found');
    }

    const stream = this.realtimeService.createJobStream(jobId);
    return stream;
  }

  closeJobStream(jobId: string): void {
    this.realtimeService.closeJobStream(jobId);
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
      const waiting = await this.genQueue.getWaiting();
      const active = await this.genQueue.getActive();
      const completed = await this.genQueue.getCompleted();
      const failed = await this.genQueue.getFailed();
      
      // Test adding a simple job
      const testJob = await this.genQueue.add('generate', {
        jobId: 'test-' + Date.now(),
        file: null,
        prompt: 'test',
        templateId: 'test'
      });

      return {
        queueStatus: { waiting: waiting.length, active: active.length, completed: completed.length, failed: failed.length },
        testJobId: testJob.id
      };
    } catch (error) {
      throw error;
    }
  }

  // Method to manually trigger queue processing
  async triggerQueueProcessing() {
    try {
      // Get waiting jobs
      const waiting = await this.genQueue.getWaiting();
      if (waiting.length > 0) {
        // Try to process the first waiting job
        const firstJob = waiting[0];
        // Check if job is still waiting
        const jobState = await firstJob.getState();   
        
        return {
          message: 'Queue processing triggered',
          waitingJobs: waiting.length,
          firstJobId: firstJob.id,
          firstJobState: jobState
        };
      } else {
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

  // Clear everything: queue, memory cache, and streams
  async clearAll() {
    try {
      console.log('🧹 CLEAR ALL: Clearing everything...');
      
      // Get before stats (only counts, not full data)
      const waiting = await this.genQueue.getWaiting();
      const active = await this.genQueue.getActive();
      const completedCount = await this.genQueue.getCompletedCount();
      const failedCount = await this.genQueue.getFailedCount();
      const cacheStats = this.memoryCacheService.getStats();
      
      // Clear memory cache first (fastest)
      const cacheCleared = this.memoryCacheService.clearAll();
      
      // Clear all streams
      const streamsCleared = this.realtimeService.clearAllStreams();
      
      // Clear queue (waiting and active)
      await this.genQueue.empty();
      
      // Clear completed and failed jobs in batches to avoid memory issues
      // Process in small chunks instead of loading all at once
      const BATCH_SIZE = 50;
      let completedCleared = 0;
      let failedCleared = 0;
      
      // Clear completed jobs in batches
      while (true) {
        const batch = await this.genQueue.getCompleted(0, BATCH_SIZE - 1);
        if (batch.length === 0) break;
        
        for (const job of batch) {
          try {
            await job.remove();
            completedCleared++;
          } catch (error) {
            // Ignore errors for individual job removal
          }
        }
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Clear failed jobs in batches
      while (true) {
        const batch = await this.genQueue.getFailed(0, BATCH_SIZE - 1);
        if (batch.length === 0) break;
        
        for (const job of batch) {
          try {
            await job.remove();
            failedCleared++;
          } catch (error) {
            // Ignore errors for individual job removal
          }
        }
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      console.log('🧹 CLEAR ALL: Completed');
      
      return {
        message: 'All data cleared successfully',
        before: {
          queue: {
            waiting: waiting.length,
            active: active.length,
            completed: completedCount,
            failed: failedCount,
          },
          memory: {
            metadata: cacheStats.jobMetadataCount,
            results: cacheStats.jobResultsCount,
          },
          streams: streamsCleared,
        },
        cleared: {
          queue: {
            waiting: waiting.length,
            active: active.length,
            completed: completedCleared,
            failed: failedCleared,
          },
          memory: cacheCleared,
          streams: streamsCleared,
        },
        after: {
          queue: {
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
          },
          memory: {
            metadata: 0,
            results: 0,
          },
          streams: 0,
        },
      };
    } catch (error) {
      console.error('🧹 CLEAR ALL: Failed to clear everything:', error);
      throw error;
    }
  }
}
