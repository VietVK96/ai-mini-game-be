import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';

@Injectable()
export class RealtimeService {
  private jobStreams = new Map<string, Readable>();

  createJobStream(jobId: string): Readable {
    if (this.jobStreams.has(jobId)) {
      return this.jobStreams.get(jobId)!;
    }

    const stream = new Readable({
      objectMode: true,
      read() {
        // Stream will be controlled by external events
      },
    });

    this.jobStreams.set(jobId, stream);
    return stream;
  }

  emitJobProgress(jobId: string, data: any): void {
    const stream = this.jobStreams.get(jobId);
    if (stream) {
      stream.push(`data: ${JSON.stringify({ type: 'progress', data })}\n\n`);
    }
  }

  emitJobComplete(jobId: string, data: any): void {
    const stream = this.jobStreams.get(jobId);
    if (stream) {
      stream.push(`data: ${JSON.stringify({ type: 'complete', data })}\n\n`);
      stream.push(null); // End stream
      this.jobStreams.delete(jobId);
    }
  }

  emitJobError(jobId: string, error: string): void {
    const stream = this.jobStreams.get(jobId);
    if (stream) {
      stream.push(`data: ${JSON.stringify({ type: 'error', data: { error } })}\n\n`);
      stream.push(null); // End stream
      this.jobStreams.delete(jobId);
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
