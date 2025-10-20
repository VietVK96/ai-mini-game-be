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
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bull_1 = require("@nestjs/bull");
const throttler_1 = require("@nestjs/throttler");
const jobs_module_1 = require("./jobs/jobs.module");
const templates_module_1 = require("./templates/templates.module");
const memory_cache_module_1 = require("./memory-cache/memory-cache.module");
const realtime_module_1 = require("./realtime/realtime.module");
const gemini_module_1 = require("./gemini/gemini.module");
const image_module_1 = require("./image/image.module");
const queue_module_1 = require("./queue/queue.module");
const gemini_config_1 = require("./config/gemini.config");
let AppModule = class AppModule {
    constructor() {
        console.log('🚀 APP: AppModule initialized');
        console.log('🚀 APP: All modules loaded successfully');
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                load: [gemini_config_1.geminiConfig],
            }),
            throttler_1.ThrottlerModule.forRoot([{
                    ttl: 60000,
                    limit: 10,
                }]),
            bull_1.BullModule.forRootAsync({
                useFactory: () => {
                    const redisConfig = {
                        host: process.env.REDIS_HOST || 'localhost',
                        port: parseInt(process.env.REDIS_PORT || '6379'),
                        password: process.env.REDIS_PASSWORD,
                        maxRetriesPerRequest: 3,
                        retryDelayOnFailover: 100,
                        enableReadyCheck: false,
                        lazyConnect: true,
                        onConnect: () => {
                            console.log('🔗 REDIS: Connected to Redis successfully');
                        },
                        onError: (error) => {
                            console.error('❌ REDIS: Connection failed:', error);
                            throw new Error(`Redis connection failed: ${error.message}`);
                        },
                        onReady: () => {
                            console.log('✅ REDIS: Redis is ready');
                        },
                        onClose: () => {
                            console.log('🔌 REDIS: Connection closed');
                        },
                    };
                    console.log(`🔗 REDIS: Attempting to connect to Redis at ${redisConfig.host}:${redisConfig.port}`);
                    return {
                        redis: redisConfig,
                        defaultJobOptions: {
                            removeOnComplete: 10,
                            removeOnFail: 5,
                            attempts: 3,
                            backoff: {
                                type: 'exponential',
                                delay: 2000,
                            },
                        },
                    };
                },
            }),
            queue_module_1.QueueModule,
            jobs_module_1.JobsModule,
            templates_module_1.TemplatesModule,
            memory_cache_module_1.MemoryCacheModule,
            realtime_module_1.RealtimeModule,
            gemini_module_1.GeminiModule,
            image_module_1.ImageModule,
        ],
    }),
    __metadata("design:paramtypes", [])
], AppModule);
//# sourceMappingURL=app.module.js.map