import { Queue } from 'bull';
import { CreateJobDto } from './dto/create-job.dto';
import { MemoryCacheService } from 'src/memory-cache/memory-cache.service';
import { RealtimeService } from 'src/realtime/realtime.service';
import { JobResult, JobMetadata } from 'src/memory-cache/memory-cache.types';
export declare class JobsService {
    private genQueue;
    private memoryCacheService;
    private realtimeService;
    constructor(genQueue: Queue, memoryCacheService: MemoryCacheService, realtimeService: RealtimeService);
    createJob(createJobDto: CreateJobDto): Promise<{
        jobId: string;
        status: string;
        message: string;
    }>;
    getJobStream(jobId: string): Promise<import("stream").Readable>;
    getJobResult(jobId: string): Promise<JobResult | null>;
    getJobStatus(jobId: string): Promise<JobMetadata | null>;
    cancelJob(jobId: string): Promise<{
        message: string;
    }>;
    testQueue(): Promise<{
        queueStatus: {
            waiting: number;
            active: number;
            completed: number;
            failed: number;
        };
        testJobId: import("bull").JobId;
    }>;
    clearQueue(): Promise<{
        message: string;
        before: {
            waiting: number;
            active: number;
            completed: number;
            failed: number;
        };
        after: {
            waiting: number;
            active: number;
        };
    }>;
}
