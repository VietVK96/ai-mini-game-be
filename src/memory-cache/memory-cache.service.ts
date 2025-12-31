import { Injectable } from '@nestjs/common';
import { JobMetadata, JobResult, CacheStats } from './memory-cache.types';

@Injectable()
export class MemoryCacheService {
  private jobMetadata = new Map<string, JobMetadata>();
  private jobResults = new Map<string, JobResult>();
  private readonly resultTtl: number;

  constructor() {
    this.resultTtl = parseInt(process.env.RESULT_TTL || '300', 10) * 1000; // Convert to milliseconds
    
    // Cleanup expired results every minute
    setInterval(() => {
      this.cleanupExpiredResults();
    }, 60000);
  }

  async setJobMetadata(jobId: string, metadata: JobMetadata): Promise<void> {
    this.jobMetadata.set(jobId, metadata);
  }

  async getJobMetadata(jobId: string): Promise<JobMetadata | null> {
    return this.jobMetadata.get(jobId) || null;
  }

  async updateJobMetadata(jobId: string, updates: Partial<JobMetadata>): Promise<void> {
    const existing = this.jobMetadata.get(jobId);
    if (existing) {
      this.jobMetadata.set(jobId, { ...existing, ...updates });
    }
  }

  async deleteJobMetadata(jobId: string): Promise<void> {
    this.jobMetadata.delete(jobId);
  }

  async setJobResult(jobId: string, result: JobResult): Promise<void> {
    this.jobResults.set(jobId, result);
  }

  async getJobResult(jobId: string): Promise<JobResult | null> {
    return this.jobResults.get(jobId) || null;
  }

  async deleteJobResult(jobId: string): Promise<void> {
    this.jobResults.delete(jobId);
  }

  private cleanupExpiredResults(): void {
    const now = Date.now();
    
    // Clean up expired results
    for (const [jobId, result] of this.jobResults.entries()) {
      if (now - result.createdAt.getTime() > this.resultTtl) {
        this.jobResults.delete(jobId);
        this.jobMetadata.delete(jobId);
      }
    }

    // Also clean up expired metadata without results (older than 1 hour)
    const metadataTtl = 3600000; // 1 hour in milliseconds
    for (const [jobId, metadata] of this.jobMetadata.entries()) {
      const age = now - metadata.createdAt.getTime();
      // Clean up if metadata is old and has no associated result
      if (age > metadataTtl && !this.jobResults.has(jobId)) {
        this.jobMetadata.delete(jobId);
      }
    }
  }

  // Clear all memory cache
  clearAll(): { deletedMetadata: number; deletedResults: number } {
    const metadataCount = this.jobMetadata.size;
    const resultsCount = this.jobResults.size;
    
    this.jobMetadata.clear();
    this.jobResults.clear();
    
    return {
      deletedMetadata: metadataCount,
      deletedResults: resultsCount,
    };
  }

  // Get cache statistics
  getStats(): CacheStats {
    return {
      jobMetadataCount: this.jobMetadata.size,
      jobResultsCount: this.jobResults.size,
      resultTtl: this.resultTtl,
    };
  }
}
