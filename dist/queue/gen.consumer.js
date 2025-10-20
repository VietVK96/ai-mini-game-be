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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenConsumer = void 0;
const bull_1 = require("@nestjs/bull");
const memory_cache_service_1 = require("../memory-cache/memory-cache.service");
const realtime_service_1 = require("../realtime/realtime.service");
const gemini_service_1 = require("../gemini/gemini.service");
const image_service_1 = require("../image/image.service");
const templates_service_1 = require("../templates/templates.service");
const fs = require("fs");
const path_1 = require("path");
let GenConsumer = class GenConsumer {
    constructor(memoryCacheService, realtimeService, geminiService, imageService, templatesService) {
        this.memoryCacheService = memoryCacheService;
        this.realtimeService = realtimeService;
        this.geminiService = geminiService;
        this.imageService = imageService;
        this.templatesService = templatesService;
        console.log('🏭 CONSUMER: GenConsumer initialized and ready to process jobs');
        console.log('🏭 CONSUMER: Dependencies injected:', {
            memoryCache: !!this.memoryCacheService,
            realtime: !!this.realtimeService,
            gemini: !!this.geminiService,
            image: !!this.imageService,
            templates: !!this.templatesService,
        });
    }
    async handleGenerate(job) {
        console.log(`🔥🔥🔥 CONSUMER TRIGGERED! Job ID: ${job.id}`);
        console.log(`🔥🔥🔥 CONSUMER: Full job object:`, JSON.stringify(job, null, 2));
        const { jobId, file, prompt, templateId } = job.data;
        try {
            console.log(`🚀🚀🚀 CONSUMER: Processing job ${jobId} with prompt: ${prompt}`);
            console.log(`📊 CONSUMER: Job data:`, { jobId, prompt, templateId, hasFile: !!file });
            console.log(`📊 CONSUMER: Job ID from Bull:`, job.id);
            console.log(`📊 CONSUMER: Job attempts:`, job.attemptsMade);
            console.log(`📊 CONSUMER: Job progress:`, job.progress());
            console.log(`📊 CONSUMER: Job state:`, job.opts);
            await this.memoryCacheService.updateJobMetadata(jobId, {
                status: 'running',
                progress: 10,
                message: 'Starting image generation...',
            });
            this.realtimeService.emitJobProgress(jobId, {
                status: 'running',
                progress: 10,
                message: 'Starting image generation...',
            });
            const template = await this.templatesService.getTemplate(templateId);
            if (!template) {
                throw new Error('Template not found');
            }
            const templatePath = (0, path_1.join)(process.cwd(), 'public', template.backgroundPath);
            const templateFile = await fs.promises.readFile(templatePath);
            const templateBuffer = Buffer.from(templateFile);
            const templateBase64 = templateBuffer.toString('base64');
            await this.memoryCacheService.updateJobMetadata(jobId, {
                progress: 20,
                message: 'Enhancing prompt...',
            });
            this.realtimeService.emitJobProgress(jobId, {
                status: 'running',
                progress: 20,
                message: 'Enhancing prompt...',
            });
            await this.memoryCacheService.updateJobMetadata(jobId, {
                progress: 40,
                message: 'Tạo prompt nâng cao cho AI...',
            });
            this.realtimeService.emitJobProgress(jobId, {
                status: 'running',
                progress: 40,
                message: 'Tạo prompt nâng cao cho AI...',
            });
            let inputBuffer;
            if (Buffer.isBuffer(file.buffer)) {
                inputBuffer = file.buffer;
            }
            else if (file.buffer?.data && Array.isArray(file.buffer.data)) {
                inputBuffer = Buffer.from(file.buffer.data);
            }
            else {
                throw new Error('Invalid file buffer format');
            }
            await this.memoryCacheService.updateJobMetadata(jobId, {
                progress: 50,
                message: 'AI đang chỉnh sửa ảnh...',
            });
            this.realtimeService.emitJobProgress(jobId, {
                status: 'running',
                progress: 50,
                message: 'AI đang chỉnh sửa ảnh...',
            });
            const editedImage = await this.geminiService.editImage(prompt, templateBase64, inputBuffer.toString('base64'));
            await this.memoryCacheService.updateJobMetadata(jobId, {
                progress: 80,
                message: 'Saving result...',
            });
            this.realtimeService.emitJobProgress(jobId, {
                status: 'running',
                progress: 80,
                message: 'Saving result...',
            });
            await this.memoryCacheService.setJobResult(jobId, {
                buffer: editedImage,
                mimeType: 'image/webp',
                filename: `ai-generated-${jobId}.webp`,
                createdAt: new Date(),
            });
            await this.memoryCacheService.updateJobMetadata(jobId, {
                status: 'completed',
                progress: 100,
                message: 'Image generation completed!',
                completedAt: new Date(),
            });
            this.realtimeService.emitJobComplete(jobId, {
                status: 'completed',
                progress: 100,
                message: 'Image generation completed!',
            });
        }
        catch (error) {
            console.error(`Job processing error for job ${jobId}:`, error);
            const errorMessage = error.message || 'Unknown error occurred';
            const errorStack = error.stack || '';
            await this.memoryCacheService.updateJobMetadata(jobId, {
                status: 'failed',
                error: errorMessage,
                errorDetails: errorStack,
                failedAt: new Date(),
            });
            this.realtimeService.emitJobError(jobId, errorMessage);
            throw error;
        }
    }
};
exports.GenConsumer = GenConsumer;
__decorate([
    (0, bull_1.Process)('generate'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GenConsumer.prototype, "handleGenerate", null);
exports.GenConsumer = GenConsumer = __decorate([
    (0, bull_1.Processor)('gen'),
    __metadata("design:paramtypes", [memory_cache_service_1.MemoryCacheService,
        realtime_service_1.RealtimeService,
        gemini_service_1.GeminiService,
        image_service_1.ImageService,
        templates_service_1.TemplatesService])
], GenConsumer);
//# sourceMappingURL=gen.consumer.js.map