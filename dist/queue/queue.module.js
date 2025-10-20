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
exports.QueueModule = void 0;
const common_1 = require("@nestjs/common");
const bull_1 = require("@nestjs/bull");
const memory_cache_module_1 = require("../memory-cache/memory-cache.module");
const realtime_module_1 = require("../realtime/realtime.module");
const gemini_module_1 = require("../gemini/gemini.module");
const image_module_1 = require("../image/image.module");
const templates_module_1 = require("../templates/templates.module");
const gen_consumer_1 = require("./gen.consumer");
let QueueModule = class QueueModule {
    constructor() {
        console.log('📦 QUEUE: QueueModule initialized with GenConsumer');
        console.log('📦 QUEUE: Queue "gen" registered with BullModule');
    }
};
exports.QueueModule = QueueModule;
exports.QueueModule = QueueModule = __decorate([
    (0, common_1.Module)({
        imports: [
            bull_1.BullModule.registerQueue({
                name: 'gen',
                defaultJobOptions: {
                    removeOnComplete: 10,
                    removeOnFail: 5,
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000,
                    },
                },
            }),
            memory_cache_module_1.MemoryCacheModule,
            realtime_module_1.RealtimeModule,
            gemini_module_1.GeminiModule,
            image_module_1.ImageModule,
            templates_module_1.TemplatesModule,
        ],
        providers: [gen_consumer_1.GenConsumer],
        exports: [bull_1.BullModule, gen_consumer_1.GenConsumer],
    }),
    __metadata("design:paramtypes", [])
], QueueModule);
//# sourceMappingURL=queue.module.js.map