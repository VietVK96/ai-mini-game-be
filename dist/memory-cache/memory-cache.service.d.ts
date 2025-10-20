import { JobMetadata, JobResult, CacheStats } from './memory-cache.types';
export declare class MemoryCacheService {
    private jobMetadata;
    private jobResults;
    private readonly resultTtl;
    constructor();
    setJobMetadata(jobId: string, metadata: JobMetadata): Promise<void>;
    getJobMetadata(jobId: string): Promise<JobMetadata | null>;
    updateJobMetadata(jobId: string, updates: Partial<JobMetadata>): Promise<void>;
    deleteJobMetadata(jobId: string): Promise<void>;
    setJobResult(jobId: string, result: JobResult): Promise<void>;
    getJobResult(jobId: string): Promise<JobResult | null>;
    deleteJobResult(jobId: string): Promise<void>;
    private cleanupExpiredResults;
    getStats(): CacheStats;
}
