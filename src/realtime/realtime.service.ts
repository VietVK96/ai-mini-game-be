import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';

@Injectable()
export class RealtimeService {
  private jobStreams = new Map<string, Readable>();

  createJobStream(jobId: string): Readable {
    if (this.jobStreams.has(jobId)) {
      console.log(`Reusing existing stream for job: ${jobId}`);
      return this.jobStreams.get(jobId)!;
    }

    console.log(`Creating new stream for job: ${jobId}`);
    const stream = new Readable({
      objectMode: false, // Changed to false for proper SSE format
      read() {
        // Stream will be controlled by external events
      },
    });

    this.jobStreams.set(jobId, stream);
    return stream;
  }

  emitJobProgress(jobId: string, data: any): void {
    const stream = this.jobStreams.get(jobId);
    console.log(`📡 REALTIME: Attempting to emit progress for job ${jobId}`);
    console.log(`📡 REALTIME: Stream exists: ${!!stream}`);
    console.log(`📡 REALTIME: Active streams: ${this.jobStreams.size}`);
    
    if (stream) {
      console.log(`📡 REALTIME: Emitting progress for job ${jobId}:`, data);
      stream.push(`data: ${JSON.stringify({ type: 'progress', data })}\n\n`);
    } else {
      console.warn(`📡 REALTIME: No stream found for job: ${jobId}`);
      console.log(`📡 REALTIME: Available streams:`, Array.from(this.jobStreams.keys()));
    }
  }

  emitJobComplete(jobId: string, data: any): void {
    const stream = this.jobStreams.get(jobId);
    if (stream) {
      console.log(`Emitting complete for job ${jobId}:`, data);
      stream.push(`data: ${JSON.stringify({ type: 'complete', data })}\n\n`);
      stream.push(null); // End stream
      this.jobStreams.delete(jobId);
    } else {
      console.warn(`No stream found for job: ${jobId}`);
    }
  }

  emitJobError(jobId: string, error: string): void {
    const stream = this.jobStreams.get(jobId);
    if (stream) {
      console.log(`Emitting error for job ${jobId}:`, error);
      stream.push(`data: ${JSON.stringify({ type: 'error', data: { error } })}\n\n`);
      stream.push(null); // End stream
      this.jobStreams.delete(jobId);
    } else {
      console.warn(`No stream found for job: ${jobId}`);
    }
  }

  closeJobStream(jobId: string): void {
    const stream = this.jobStreams.get(jobId);
    if (stream) {
      stream.push(null);
      this.jobStreams.delete(jobId);
    }
  }
}
