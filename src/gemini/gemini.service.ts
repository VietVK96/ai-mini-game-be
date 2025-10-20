import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Modality } from "@google/genai";
import { GeminiConfig } from '../config/gemini.interface';
import { GeminiRequest, GeminiPart } from './gemini.types';
import * as fs from 'fs';

@Injectable()
export class GeminiService {
  private genAI: GoogleGenAI;
  private readonly config: GeminiConfig;

  constructor(private configService: ConfigService) {
    this.config = this.configService.get<GeminiConfig>('gemini');
    this.validateConfig();
    this.genAI = new GoogleGenAI({
      apiKey: this.config.apiKey,
    });
  }

  private validateConfig(): void {
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

  private createTextRequest(text: string): GeminiRequest {
    return {
      contents: [{
        role: 'user',
        parts: [{
          text: text,
        }],
      }],
    };
  }



  async editImage(prompt: string, inputImage: string): Promise<Buffer> {
    try {
      // Validate base64 data
      if (!this.isValidBase64(inputImage)) {
        throw new Error('Invalid input image base64 data');
      }

      const promptRequest = {
        contents: [{
          role: 'user',
          parts: [
            {
             text: `Using the provided image please edit it to match the following requirements: ${prompt}. Return only the edited image, no additional text.` },
            {
              inlineData: {
                mimeType: "image/png",
                data: inputImage,
              },
            },
          ]
        }]
      }; 
      const response = await this.genAI.models.generateContent({
        model: "gemini-2.5-flash-image",
        ...promptRequest
      });
      
      if (!response.candidates || response.candidates.length === 0) {
        throw new Error('No response candidates from Gemini API');
      }

      const candidate = response.candidates[0];
      if (!candidate.content || !candidate.content.parts) {
        throw new Error('Invalid response structure from Gemini API');
      }

      for (const part of candidate.content.parts) {
        if (part.text) {
          console.log('🎨 GEMINI: Text response:', part.text);
        } else if (part.inlineData) {
          const imageData = part.inlineData.data;
          const buffer = Buffer.from(imageData, "base64");
          return buffer;
        }
      }

      throw new Error('No image data found in Gemini response');

    } catch (error) {
      console.error('AI image editing error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to edit image: ${error.message}`);
    }
  }

  private isValidBase64(str: string): boolean {
    try {
      // Check if string is valid base64
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(str)) {
        return false;
      }
      
      // Try to decode
      const decoded = Buffer.from(str, 'base64');
      const reencoded = decoded.toString('base64');
      return reencoded === str;
    } catch (error) {
      return false;
    }
  }


  async enhancePrompt(prompt: string): Promise<string> {
    try {
      const requestText = `Enhance this image generation prompt to be more detailed and specific: "${prompt}". 
                            Return only the enhanced prompt, no additional text.`;

      const result = await this.genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: requestText
      });
      const response = result.text;

      return response;

    } catch (error) {

      throw new Error(`Failed to enhance prompt: ${error.message}`);
    }
  }
}
