import { StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { JobsService } from './jobs.service';
export declare class JobsController {
    private readonly jobsService;
    constructor(jobsService: JobsService);
    createJob(files: Express.Multer.File[], body: any): Promise<{
        jobId: string;
        status: string;
        message: string;
    }>;
    streamJob(id: string, res: Response): Promise<void>;
    getJobResult(id: string): Promise<StreamableFile>;
    getJobStatus(id: string): Promise<import("../memory-cache/memory-cache.types").JobMetadata>;
    cancelJob(id: string): Promise<{
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
