import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Modality } from "@google/genai";
import { GeminiConfig } from '../config/gemini.interface';
import { GeminiRequest, GeminiPart } from './gemini.types';
import * as fs from 'fs';

/** ===== Pricing for Gemini 2.5 Flash Image ===== */
const PRICING = {
  INPUT_PER_MTOK_USD: 0.30,  // $ / 1,000,000 input tokens
  OUTPUT_IMAGE_PER_UNIT_USD: 0.039, // $ / ảnh (Standard)
  OUTPUT_TEXT_PER_MTOK_USD: 0.0,    // $0 - Text output is FREE for image models
};

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



  async editImageWithReferenceTemplate(
    prompt: string,
    inputImage: string,
    referenceTemplateImage: string,
    inputMimeType: string = 'image/jpeg',
    referenceMimeType: string = 'image/jpeg',
    logoImage: string,
    logoMimeType: string = 'image/png',
    aspectRatio: string = '1:1'
  ): Promise<Buffer> {
    try {
      console.log('🎨 GEMINI: Starting image editing with reference template...');

      // Validate base64 data
      if (!this.isValidBase64(inputImage)) {
        throw new Error('Invalid input image base64 data');
      }
      if (!this.isValidBase64(referenceTemplateImage)) {
        throw new Error('Invalid reference template image base64 data');
      }

      // Check image sizes (base64 is ~33% larger than binary)
      const inputImageSize = (inputImage.length * 3) / 4;
      const referenceImageSize = (referenceTemplateImage.length * 3) / 4;
      const totalSizeMB = (inputImageSize + referenceImageSize) / (1024 * 1024);
      
      console.log('📏 GEMINI: Image sizes - Input:', (inputImageSize / (1024 * 1024)).toFixed(2), 'MB, Reference:', (referenceImageSize / (1024 * 1024)).toFixed(2), 'MB, Total:', totalSizeMB.toFixed(2), 'MB');
      
      // Warn if images are very large (Gemini API typically has limits around 20MB total)
      if (totalSizeMB > 15) {
        console.warn('⚠️ GEMINI: Total image size is very large (' + totalSizeMB.toFixed(2) + 'MB). This may cause API errors.');
      }

      // Build contents for API with both images - instruction first to ensure AI reads it before processing images
      const instruction = `Bạn nhận 2 ảnh: 
        1) Ảnh gốc có khuôn mặt người dùng 
        2) Ảnh template nền thương hiệu ZAPP
        3) Ảnh logo thương hiệu ZAPP

        Tạo 1 ảnh mới:
        - Giữ nguyên y hệt khuôn mặt từ ảnh gốc 100%, không được vẽ khuôn mặt mới.
        - Giữ nguyên background template.
        - Đặt người mẫu vào đúng vị trí như ảnh ví dụ: 
        đứng giữa khung hình, khung từ ngang hông trở lên.
        - Tạo trang phục/vibe theo phong cách, sẽ có có phong cách cho nam và nữ:  "${prompt}".
        - Thêm logo “ZAPP” từ ảnh logo thương hiệu ZAPP, ở ngực trái áo, đúng vị trí như ảnh ví dụ.

        Ảnh cuối phải chân thực, sắc nét; luôn ưu tiên giữ khuôn mặt gốc và bố cục/background template.
        - Nếu có mâu thuẫn, LUÔN ưu tiên giữ khuôn mặt giống Ảnh 1 và phông nền giống Ảnh 2.
        - Ảnh trả ra có tỷ lệ khung hình là: ${aspectRatio}
          `;

      const contents = this.buildContentsWithBackground(
        inputImage,
        referenceTemplateImage,
        instruction,
        logoImage,
        logoMimeType,
        inputMimeType,
        referenceMimeType,
      );

      // 3) Make the API call
      console.log('🎨 GEMINI: Making API call with both images...');
      const response = await this.genAI.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents,
        config: { 
          responseModalities: ["IMAGE"], 
          imageConfig:{
            aspectRatio: aspectRatio,
          }
         }
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
          console.log('🎨 GEMINI: Image with background generated successfully, size:', buffer.length, 'bytes');
          return buffer;
        }
      }

      throw new Error('No image data found in Gemini response');

    } catch (error) {
      console.error('AI image editing with background error:', error);
      
      // Log more detailed error information
      if (error.status) {
        console.error('API Error Status:', error.status);
      }
      if (error.response) {
        console.error('API Error Response:', JSON.stringify(error.response, null, 2));
      }
      if (error.message) {
        console.error('Error Message:', error.message);
      }
      
      // Check for specific error types
      if (error.status === 500) {
        const errorMsg = error.message || 'Internal server error from Gemini API';
        console.error('⚠️ GEMINI: 500 Internal Server Error - This could be due to:');
        console.error('  1. Image size too large (check if images exceed API limits)');
        console.error('  2. Invalid image format or corrupted data');
        console.error('  3. Temporary API issue - try again later');
        console.error('  4. Request format issue');
        throw new Error(`Gemini API Internal Error: ${errorMsg}. Please check image sizes and formats.`);
      }
      
      throw new Error(`Failed to edit image with background: ${error.message || 'Unknown error'}`);
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



  /**
   * Build contents for Gemini API with both main image and background image
   * Instruction is placed FIRST so AI reads requirements before processing images
   */
  private buildContentsWithBackground(
    mainImage: string,
    backgroundImage: string,
    instruction: string,
    logoImage: string,
    logoMimeType: string = 'image/png',
    mainMime = "image/jpeg",
    backgroundMime = "image/jpeg"
  ) {
    return [
      {
        role: "user",
        parts: [
          { text: instruction },
          { text: "FIRST IMAGE (MAIN PERSON):" },
          { inlineData: { mimeType: mainMime, data: mainImage } },
          { text: "SECOND IMAGE (BACKGROUND ONLY):" },
          { inlineData: { mimeType: backgroundMime, data: backgroundImage } },
          { text: "THIRD IMAGE (LOGO):" },
          { inlineData: { mimeType: logoMimeType, data: logoImage } },
        ],
      },
    ];
  }

  /**
   * Estimate cost before making the request
   */
  private estimatePreCost(inputTokens: number, imagesOutRequested = 1) {
    const inputCost = (inputTokens / 1000000) * PRICING.INPUT_PER_MTOK_USD;
    const outputImagesCost = imagesOutRequested * PRICING.OUTPUT_IMAGE_PER_UNIT_USD;
    return {
      inputTokens,
      inputCostUSD: inputCost,
      outputImagesCostUSD: outputImagesCost,
      totalUSD: inputCost + outputImagesCost
    };
  }

  /**
   * Calculate actual cost from usage metadata
   */
  private calculateActualCost(usage: any, imagesOutActual: number) {
    const promptTok = usage.promptTokenCount ?? 0;
    const outputTok = usage.candidatesTokenCount ?? 0;

    const inputCostUSD = (promptTok / 1000000) * PRICING.INPUT_PER_MTOK_USD;
    const outputImagesCostUSD = imagesOutActual * PRICING.OUTPUT_IMAGE_PER_UNIT_USD;
    const outputTextCostUSD = (outputTok / 1000000) * PRICING.OUTPUT_TEXT_PER_MTOK_USD;
    const totalUSD = inputCostUSD + outputImagesCostUSD + outputTextCostUSD;

    return {
      promptTokens: promptTok,
      outputTokens: outputTok,
      imagesOut: imagesOutActual,
      inputCostUSD,
      outputImagesCostUSD,
      outputTextCostUSD,
      totalUSD,
    };
  }



  /**
   * Get pricing information for Gemini 2.5 Flash Image
   */
  getPricingInfo() {
    return {
      model: "gemini-2.5-flash-image",
      pricing: PRICING,
      description: "Pricing for Gemini 2.5 Flash Image model",
      inputTokens: {
        price: `$${PRICING.INPUT_PER_MTOK_USD} per 1M tokens`,
        description: "Input text and image tokens"
      },
      outputImages: {
        price: `$${PRICING.OUTPUT_IMAGE_PER_UNIT_USD} per image`,
        description: "Generated images (Standard quality)"
      },
      outputText: {
        price: "FREE",
        description: "Text output is FREE for Gemini 2.5 Flash Image model"
      }
    };
  }
}
