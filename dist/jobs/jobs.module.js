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
exports.JobsModule = void 0;
const common_1 = require("@nestjs/common");
const jobs_controller_1 = require("./jobs.controller");
const jobs_service_1 = require("./jobs.service");
const memory_cache_module_1 = require("../memory-cache/memory-cache.module");
const realtime_module_1 = require("../realtime/realtime.module");
const image_module_1 = require("../image/image.module");
const queue_module_1 = require("../queue/queue.module");
let JobsModule = class JobsModule {
    constructor() {
        console.log('💼 JOBS: JobsModule initialized');
    }
};
exports.JobsModule = JobsModule;
exports.JobsModule = JobsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            queue_module_1.QueueModule,
            memory_cache_module_1.MemoryCacheModule,
            realtime_module_1.RealtimeModule,
            image_module_1.ImageModule,
        ],
        controllers: [jobs_controller_1.JobsController],
        providers: [jobs_service_1.JobsService],
        exports: [jobs_service_1.JobsService],
    }),
    __metadata("design:paramtypes", [])
], JobsModule);
//# sourceMappingURL=jobs.module.js.map