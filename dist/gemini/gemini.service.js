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
exports.GeminiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const genai_1 = require("@google/genai");
let GeminiService = class GeminiService {
    constructor(configService) {
        this.configService = configService;
        this.config = this.configService.get('gemini');
        this.validateConfig();
        this.genAI = new genai_1.GoogleGenAI({
            apiKey: this.config.apiKey,
        });
    }
    validateConfig() {
        if (!this.config) {
            throw new Error('Gemini configuration not found');
        }
        if (!this.config.apiKey) {
            throw new Error('GEMINI_API_KEY is required');
        }
        if (!this.config.model) {
            throw new Error('GEMINI_MODEL is required');
        }
        if (this.config.maxTokens <= 0) {
            throw new Error('GEMINI_MAX_TOKENS must be greater than 0');
        }
        if (this.config.temperature < 0 || this.config.temperature > 1) {
            throw new Error('GEMINI_TEMPERATURE must be between 0 and 1');
        }
    }
    createTextRequest(text) {
        return {
            contents: [{
                    role: 'user',
                    parts: [{
                            text: text,
                        }],
                }],
        };
    }
    async editImage(prompt, template, inputImage) {
        try {
            const promptRequest = [
                {
                    text: `You have two images: 
          1. First image (inputImage): The main subject image that needs to be edited according to the prompt: "${prompt}"
          2. Second image (template): A frame/template image that will serve as the background frame

          Please:
          1. First, edit the first image according to the prompt requirements: ${prompt}
          2. Then, composite/merge the edited first image into the second image (template) as a frame
          3. The final result should be the edited image placed within the template frame
          4. Return only the final composited image, no additional text.`
                },
                {
                    inlineData: {
                        mimeType: "image/png",
                        data: inputImage,
                    },
                },
                {
                    inlineData: {
                        mimeType: "image/jpeg",
                        data: template,
                    },
                },
            ];
            const response = await this.genAI.models.generateContent({
                model: "gemini-2.5-flash-image",
                contents: promptRequest
            });
            console.log(response);
            for (const part of response.candidates[0].content.parts) {
                if (part.text) {
                    console.log(part.text);
                }
                else if (part.inlineData) {
                    const imageData = part.inlineData.data;
                    const buffer = Buffer.from(imageData, "base64");
                    return buffer;
                }
            }
        }
        catch (error) {
            console.error('AI image editing error:', error);
            throw new Error(`Failed to edit image: ${error.message}`);
        }
    }
    async enhancePrompt(prompt) {
        try {
            const requestText = `Enhance this image generation prompt to be more detailed and specific: "${prompt}". 
                            Return only the enhanced prompt, no additional text.`;
            const result = await this.genAI.models.generateContent({
                model: "gemini-2.5-flash",
                contents: requestText
            });
            const response = result.text;
            return response;
        }
        catch (error) {
            throw new Error(`Failed to enhance prompt: ${error.message}`);
        }
    }
};
exports.GeminiService = GeminiService;
exports.GeminiService = GeminiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GeminiService);
//# sourceMappingURL=gemini.service.js.map