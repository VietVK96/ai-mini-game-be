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



  async editImage(prompt: string, template: string, inputImage: string): Promise<Buffer> {
    try {
      // Validate base64 data
      if (!this.isValidBase64(inputImage)) {
        throw new Error('Invalid input image base64 data');
      }
      if (!this.isValidBase64(template)) {
        throw new Error('Invalid template base64 data');
      }

      // Get image dimensions for better context
      const inputImageBuffer = Buffer.from(inputImage, 'base64');
      const templateBuffer = Buffer.from(template, 'base64');
      
      console.log('🎨 GEMINI: Input image size:', inputImageBuffer.length, 'bytes');
      console.log('🎨 GEMINI: Template size:', templateBuffer.length, 'bytes');

      // Preprocess images for better composition
      const { inputImage: processedInput, template: processedTemplate } = await this.preprocessImageForComposition(inputImage, template);

      const promptRequest = {
        contents: [{
          role: 'user',
          parts: [
            {
              text: `You have two images:
              1. First image (inputImage): The main subject image that needs to be edited according to the prompt: "${prompt}"
              2. Second image (template): A frame/template image that will serve as the background frame

              CRITICAL INSTRUCTIONS FOR PERFECT COMPOSITION:
              1. First, edit the first image according to the prompt requirements: ${prompt}
              2. Analyze the template image to identify the exact frame area where the edited image should be placed
              3. Resize the edited first image to match the template's frame dimensions EXACTLY:
                 - Calculate the exact width and height of the frame area in the template
                 - Resize the edited image to fit perfectly within those dimensions
                 - Maintain the aspect ratio while ensuring it fits the frame completely
              4. Composite the resized edited image into the template frame:
                 - Place the edited image exactly in the center of the frame area
                 - Ensure the edited image fills the entire frame without being cut off
                 - Make sure the edited image aligns perfectly with the template's frame boundaries
                 - The final result should look like the edited image was originally part of the template
              5. Return only the final composited image, no additional text or explanations.

              Remember: The key is to make the edited image look like it was originally designed to fit this specific template frame.`
            },
            {
              inlineData: {
                mimeType: "image/png",
                data: processedInput,
              },
            },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: processedTemplate,
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

  private async preprocessImageForComposition(inputImage: string, template: string): Promise<{ inputImage: string, template: string }> {
    try {
      // This method can be used to preprocess images if needed
      // For now, just return the original images
      return { inputImage, template };
    } catch (error) {
      console.error('Image preprocessing error:', error);
      return { inputImage, template };
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
