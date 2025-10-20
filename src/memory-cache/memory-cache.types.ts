export interface JobMetadata {
  status: string;
  progress: number;
  message: string;
  createdAt: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
  errorDetails?: string;
}

export interface JobResult {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  createdAt: Date;
}

export interface CacheStats {
  jobMetadataCount: number;
  jobResultsCount: number;
  resultTtl: number;
}

export interface JobStatus {
  queued: 'queued';
  running: 'running';
  completed: 'completed';
  failed: 'failed';
}
