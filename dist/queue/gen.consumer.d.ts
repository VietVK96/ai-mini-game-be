import { Job } from 'bull';
import { MemoryCacheService } from '../memory-cache/memory-cache.service';
import { RealtimeService } from '../realtime/realtime.service';
import { GeminiService } from '../gemini/gemini.service';
import { ImageService } from '../image/image.service';
import { TemplatesService } from 'src/templates/templates.service';
export declare class GenConsumer {
    private memoryCacheService;
    private realtimeService;
    private geminiService;
    private imageService;
    private templatesService;
    constructor(memoryCacheService: MemoryCacheService, realtimeService: RealtimeService, geminiService: GeminiService, imageService: ImageService, templatesService: TemplatesService);
    handleGenerate(job: Job): Promise<void>;
}
