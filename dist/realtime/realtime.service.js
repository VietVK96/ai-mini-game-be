"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeService = void 0;
const common_1 = require("@nestjs/common");
const stream_1 = require("stream");
let RealtimeService = class RealtimeService {
    constructor() {
        this.jobStreams = new Map();
    }
    createJobStream(jobId) {
        if (this.jobStreams.has(jobId)) {
            console.log(`Reusing existing stream for job: ${jobId}`);
            return this.jobStreams.get(jobId);
        }
        console.log(`Creating new stream for job: ${jobId}`);
        const stream = new stream_1.Readable({
            objectMode: false,
            read() {
            },
        });
        this.jobStreams.set(jobId, stream);
        return stream;
    }
    emitJobProgress(jobId, data) {
        const stream = this.jobStreams.get(jobId);
        console.log(`📡 REALTIME: Attempting to emit progress for job ${jobId}`);
        console.log(`📡 REALTIME: Stream exists: ${!!stream}`);
        console.log(`📡 REALTIME: Active streams: ${this.jobStreams.size}`);
        if (stream) {
            console.log(`📡 REALTIME: Emitting progress for job ${jobId}:`, data);
            stream.push(`data: ${JSON.stringify({ type: 'progress', data })}\n\n`);
        }
        else {
            console.warn(`📡 REALTIME: No stream found for job: ${jobId}`);
            console.log(`📡 REALTIME: Available streams:`, Array.from(this.jobStreams.keys()));
        }
    }
    emitJobComplete(jobId, data) {
        const stream = this.jobStreams.get(jobId);
        if (stream) {
            console.log(`Emitting complete for job ${jobId}:`, data);
            stream.push(`data: ${JSON.stringify({ type: 'complete', data })}\n\n`);
            stream.push(null);
            this.jobStreams.delete(jobId);
        }
        else {
            console.warn(`No stream found for job: ${jobId}`);
        }
    }
    emitJobError(jobId, error) {
        const stream = this.jobStreams.get(jobId);
        if (stream) {
            console.log(`Emitting error for job ${jobId}:`, error);
            stream.push(`data: ${JSON.stringify({ type: 'error', data: { error } })}\n\n`);
            stream.push(null);
            this.jobStreams.delete(jobId);
        }
        else {
            console.warn(`No stream found for job: ${jobId}`);
        }
    }
    closeJobStream(jobId) {
        const stream = this.jobStreams.get(jobId);
        if (stream) {
            stream.push(null);
            this.jobStreams.delete(jobId);
        }
    }
};
exports.RealtimeService = RealtimeService;
exports.RealtimeService = RealtimeService = __decorate([
    (0, common_1.Injectable)()
], RealtimeService);
//# sourceMappingURL=realtime.service.js.map