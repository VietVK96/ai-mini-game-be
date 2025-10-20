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
exports.JobsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const jobs_service_1 = require("./jobs.service");
let JobsController = class JobsController {
    constructor(jobsService) {
        this.jobsService = jobsService;
    }
    async createJob(files, body) {
        if (!files || files.length === 0) {
            throw new common_1.BadRequestException('No files uploaded');
        }
        const file = files[0];
        const createJobDto = {
            file: file,
            prompt: body.prompt || '',
            templateId: body.templateId || '',
        };
        return await this.jobsService.createJob(createJobDto);
    }
    async streamJob(id, res) {
        try {
            console.log(`🌊 SSE: Starting SSE stream for job: ${id}`);
            const stream = await this.jobsService.getJobStream(id);
            console.log(`🌊 SSE: Stream created for job: ${id}`);
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.write(`data: ${JSON.stringify({ type: 'connected', data: { jobId: id } })}\n\n`);
            stream.pipe(res);
            res.on('close', () => {
                console.log(`SSE stream closed for job: ${id}`);
                stream.destroy();
            });
        }
        catch (error) {
            console.error(`SSE stream error for job ${id}:`, error);
            res.status(500).json({ error: 'Failed to create stream' });
        }
    }
    async getJobResult(id) {
        const result = await this.jobsService.getJobResult(id);
        if (!result) {
            throw new common_1.NotFoundException('Job result not found or expired');
        }
        return new common_1.StreamableFile(result.buffer, {
            type: result.mimeType,
            disposition: `attachment; filename="ai-generated-${id}.webp"`,
        });
    }
    async getJobStatus(id) {
        return this.jobsService.getJobStatus(id);
    }
    async cancelJob(id) {
        return this.jobsService.cancelJob(id);
    }
    async testQueue() {
        return this.jobsService.testQueue();
    }
    async clearQueue() {
        return this.jobsService.clearQueue();
    }
};
exports.JobsController = JobsController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('file', 1)),
    __param(0, (0, common_1.UploadedFiles)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object]),
    __metadata("design:returntype", Promise)
], JobsController.prototype, "createJob", null);
__decorate([
    (0, common_1.Get)(':id/stream'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], JobsController.prototype, "streamJob", null);
__decorate([
    (0, common_1.Get)(':id/result'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], JobsController.prototype, "getJobResult", null);
__decorate([
    (0, common_1.Get)(':id/status'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], JobsController.prototype, "getJobStatus", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], JobsController.prototype, "cancelJob", null);
__decorate([
    (0, common_1.Get)('test/queue'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], JobsController.prototype, "testQueue", null);
__decorate([
    (0, common_1.Delete)('test/queue'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], JobsController.prototype, "clearQueue", null);
exports.JobsController = JobsController = __decorate([
    (0, common_1.Controller)('jobs'),
    __metadata("design:paramtypes", [jobs_service_1.JobsService])
], JobsController);
//# sourceMappingURL=jobs.controller.js.map