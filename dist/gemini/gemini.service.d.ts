import { ConfigService } from '@nestjs/config';
export declare class GeminiService {
    private configService;
    private genAI;
    private readonly config;
    constructor(configService: ConfigService);
    private validateConfig;
    private createTextRequest;
    editImage(prompt: string, template: string, inputImage: string): Promise<Buffer>;
    enhancePrompt(prompt: string): Promise<string>;
}
