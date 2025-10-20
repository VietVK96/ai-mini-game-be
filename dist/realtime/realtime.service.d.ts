import { Readable } from 'stream';
export declare class RealtimeService {
    private jobStreams;
    createJobStream(jobId: string): Readable;
    emitJobProgress(jobId: string, data: any): void;
    emitJobComplete(jobId: string, data: any): void;
    emitJobError(jobId: string, error: string): void;
    closeJobStream(jobId: string): void;
}
