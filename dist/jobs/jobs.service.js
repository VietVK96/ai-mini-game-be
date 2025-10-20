"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobsService = void 0;
const common_1 = require("@nestjs/common");
const bull_1 = require("@nestjs/bull");
const uuid_1 = require("uuid");
const memory_cache_service_1 = require("../memory-cache/memory-cache.service");
const realtime_service_1 = require("../realtime/realtime.service");
let JobsService = class JobsService {
    constructor(genQueue, memoryCacheService, realtimeService) {
        this.genQueue = genQueue;
        this.memoryCacheService = memoryCacheService;
        this.realtimeService = realtimeService;
    }
    async createJob(createJobDto) {
        const jobId = (0, uuid_1.v4)();
        console.log(`📝 JOBS: Creating job ${jobId} with prompt: ${createJobDto.prompt}`);
        try {
            const waiting = await this.genQueue.getWaiting();
            const active = await this.genQueue.getActive();
            const completed = await this.genQueue.getCompleted();
            const failed = await this.genQueue.getFailed();
            console.log(`📊 QUEUE STATUS: Waiting: ${waiting.length}, Active: ${active.length}, Completed: ${completed.length}, Failed: ${failed.length}`);
            console.log(`📤 JOBS: Adding job to queue with data:`, {
                jobId,
                prompt: createJobDto.prompt,
                templateId: createJobDto.templateId,
                hasFile: !!createJobDto.file
            });
            const job = await this.genQueue.add('generate', {
                jobId,
                file: createJobDto.file,
                prompt: createJobDto.prompt,
                templateId: createJobDto.templateId,
            });
            console.log(`✅ JOBS: Job ${jobId} added to queue with Bull job ID: ${job.id}`);
            console.log(`✅ JOBS: Job options:`, job.opts);
            console.log(`✅ JOBS: Job data:`, job.data);
            const queueStatus = await this.genQueue.getJob(job.id);
            console.log(`🔍 JOBS: Job in queue:`, queueStatus ? 'YES' : 'NO');
            console.log(`🔍 JOBS: Job status:`, queueStatus?.opts);
            this.genQueue.on('completed', (job, result) => {
                console.log(`🎉 QUEUE EVENT: Job ${job.id} completed with result:`, result);
            });
            this.genQueue.on('failed', (job, err) => {
                console.log(`❌ QUEUE EVENT: Job ${job.id} failed with error:`, err);
            });
            this.genQueue.on('active', (job) => {
                console.log(`🔄 QUEUE EVENT: Job ${job.id} is now active`);
            });
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
        }
        catch (error) {
            console.error(`Failed to create job ${jobId}:`, error);
            throw error;
        }
    }
    async getJobStream(jobId) {
        console.log(`🔍 JOBS: Getting stream for job: ${jobId}`);
        const metadata = await this.memoryCacheService.getJobMetadata(jobId);
        console.log(`🔍 JOBS: Job metadata:`, metadata);
        if (!metadata) {
            console.log(`🔍 JOBS: Job not found: ${jobId}`);
            throw new common_1.NotFoundException('Job not found');
        }
        const stream = this.realtimeService.createJobStream(jobId);
        console.log(`🔍 JOBS: Stream created for job: ${jobId}`);
        return stream;
    }
    async getJobResult(jobId) {
        return this.memoryCacheService.getJobResult(jobId);
    }
    async getJobStatus(jobId) {
        const metadata = await this.memoryCacheService.getJobMetadata(jobId);
        if (!metadata) {
            throw new common_1.NotFoundException('Job not found');
        }
        return metadata;
    }
    async cancelJob(jobId) {
        const job = await this.genQueue.getJob(jobId);
        if (job) {
            await job.remove();
        }
        await this.memoryCacheService.deleteJobMetadata(jobId);
        await this.memoryCacheService.deleteJobResult(jobId);
        return { message: 'Job cancelled successfully' };
    }
    async testQueue() {
        try {
            console.log('🧪 TEST: Testing queue connection...');
            const waiting = await this.genQueue.getWaiting();
            const active = await this.genQueue.getActive();
            const completed = await this.genQueue.getCompleted();
            const failed = await this.genQueue.getFailed();
            console.log('🧪 TEST: Queue status:', {
                waiting: waiting.length,
                active: active.length,
                completed: completed.length,
                failed: failed.length
            });
            const testJob = await this.genQueue.add('generate', {
                jobId: 'test-' + Date.now(),
                file: null,
                prompt: 'test',
                templateId: 'test'
            });
            console.log('🧪 TEST: Test job added:', testJob.id);
            return {
                queueStatus: { waiting: waiting.length, active: active.length, completed: completed.length, failed: failed.length },
                testJobId: testJob.id
            };
        }
        catch (error) {
            console.error('🧪 TEST: Queue test failed:', error);
            throw error;
        }
    }
    async clearQueue() {
        try {
            console.log('🧹 CLEAR: Clearing all jobs from queue...');
            const waiting = await this.genQueue.getWaiting();
            const active = await this.genQueue.getActive();
            const completed = await this.genQueue.getCompleted();
            const failed = await this.genQueue.getFailed();
            console.log('🧹 CLEAR: Before clear - Waiting:', waiting.length, 'Active:', active.length, 'Completed:', completed.length, 'Failed:', failed.length);
            await this.genQueue.empty();
            const waitingAfter = await this.genQueue.getWaiting();
            const activeAfter = await this.genQueue.getActive();
            console.log('🧹 CLEAR: After clear - Waiting:', waitingAfter.length, 'Active:', activeAfter.length);
            return {
                message: 'Queue cleared successfully',
                before: { waiting: waiting.length, active: active.length, completed: completed.length, failed: failed.length },
                after: { waiting: waitingAfter.length, active: activeAfter.length }
            };
        }
        catch (error) {
            console.error('🧹 CLEAR: Failed to clear queue:', error);
            throw error;
        }
    }
};
exports.JobsService = JobsService;
exports.JobsService = JobsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bull_1.InjectQueue)('gen')),
    __metadata("design:paramtypes", [Object, memory_cache_service_1.MemoryCacheService,
        realtime_service_1.RealtimeService])
], JobsService);
//# sourceMappingURL=jobs.service.js.map