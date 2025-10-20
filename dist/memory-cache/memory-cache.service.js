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
exports.MemoryCacheService = void 0;
const common_1 = require("@nestjs/common");
let MemoryCacheService = class MemoryCacheService {
    constructor() {
        this.jobMetadata = new Map();
        this.jobResults = new Map();
        this.resultTtl = parseInt(process.env.RESULT_TTL || '300', 10) * 1000;
        setInterval(() => {
            this.cleanupExpiredResults();
        }, 60000);
    }
    async setJobMetadata(jobId, metadata) {
        this.jobMetadata.set(jobId, metadata);
    }
    async getJobMetadata(jobId) {
        return this.jobMetadata.get(jobId) || null;
    }
    async updateJobMetadata(jobId, updates) {
        const existing = this.jobMetadata.get(jobId);
        if (existing) {
            this.jobMetadata.set(jobId, { ...existing, ...updates });
        }
    }
    async deleteJobMetadata(jobId) {
        this.jobMetadata.delete(jobId);
    }
    async setJobResult(jobId, result) {
        this.jobResults.set(jobId, result);
    }
    async getJobResult(jobId) {
        return this.jobResults.get(jobId) || null;
    }
    async deleteJobResult(jobId) {
        this.jobResults.delete(jobId);
    }
    cleanupExpiredResults() {
        const now = Date.now();
        for (const [jobId, result] of this.jobResults.entries()) {
            if (now - result.createdAt.getTime() > this.resultTtl) {
                this.jobResults.delete(jobId);
                this.jobMetadata.delete(jobId);
            }
        }
    }
    getStats() {
        return {
            jobMetadataCount: this.jobMetadata.size,
            jobResultsCount: this.jobResults.size,
            resultTtl: this.resultTtl,
        };
    }
};
exports.MemoryCacheService = MemoryCacheService;
exports.MemoryCacheService = MemoryCacheService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], MemoryCacheService);
//# sourceMappingURL=memory-cache.service.js.map