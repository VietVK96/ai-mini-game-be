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
      console.log('🎨 GEMINI: Starting image editing with accurate pricing...');
      
      // Validate base64 data
      if (!this.isValidBase64(inputImage)) {
        throw new Error('Invalid input image base64 data');
      }

      // Build contents for API
      const contents = this.buildContents(inputImage, "image/jpeg", 
        `Using the provided image please edit it to match the following requirements: ${prompt}. Return only ONE edited image, no additional text or multiple images.`
      );

      // 1) Count input tokens first
      console.log('💰 GEMINI: Counting input tokens...');
      const { totalTokens = 0 } = await this.genAI.models.countTokens({ 
        model: "gemini-2.5-flash-image", 
        contents 
      });
      
      // 2) Estimate cost before making the request
      const preEstimate = this.estimatePreCost(totalTokens, 1);
      console.log('💰 GEMINI: Pre-estimate cost:', {
        inputTokens: preEstimate.inputTokens,
        inputCostUSD: `$${preEstimate.inputCostUSD.toFixed(6)}`,
        outputImagesCostUSD: `$${preEstimate.outputImagesCostUSD.toFixed(6)}`,
        totalUSD: `$${preEstimate.totalUSD.toFixed(6)}`
      });

      // 3) Make the API call
      console.log('🎨 GEMINI: Making API call...');
      const response = await this.genAI.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents,
        config: { responseModalities: ["IMAGE"] }
      });
      
      if (!response.candidates || response.candidates.length === 0) {
        throw new Error('No response candidates from Gemini API');
      }
      console.log(response?.text);
      

      // 4) Get usage metadata and calculate actual cost
      const usage = (response as any).usageMetadata || {};
      const candidates = (response as any)?.candidates ?? [];
      const imagesOutActual = candidates.flatMap((c: any) => c?.content?.parts ?? [])
        .filter((p: any) => p?.inlineData?.data).length || 1;

      const actualCost = this.calculateActualCost(usage, imagesOutActual);
      console.log('💰 GEMINI: Actual cost after API call:', {
        promptTokens: actualCost.promptTokens,
        outputTokens: actualCost.outputTokens,
        imagesOut: actualCost.imagesOut,
        inputCostUSD: `$${actualCost.inputCostUSD.toFixed(6)}`,
        outputImagesCostUSD: `$${actualCost.outputImagesCostUSD.toFixed(6)}`,
        outputTextCostUSD: `$${actualCost.outputTextCostUSD.toFixed(6)}`,
        totalUSD: `$${actualCost.totalUSD.toFixed(6)}`
      });

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
          console.log('🎨 GEMINI: Image generated successfully, size:', buffer.length, 'bytes');
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

  async editImageWithBackground(
    prompt: string, 
    inputImage: string, 
    backgroundImage: string
  ): Promise<Buffer> {
    try {
      console.log('🎨 GEMINI: Starting image editing with background replacement...');
      
      // Validate base64 data
      if (!this.isValidBase64(inputImage)) {
        throw new Error('Invalid input image base64 data');
      }
      if (!this.isValidBase64(backgroundImage)) {
        throw new Error('Invalid background image base64 data');
      }

      // Build contents for API with both images
      const contents = this.buildContentsWithBackground(
        inputImage, 
        backgroundImage,
        `You are given two images: 
1. The main image (first image) - this is the image that needs to be edited
2. The background image (second image) - this is the desired background style

Please edit the main image according to the following requirements: ${prompt}
Then replace the background of the edited main image to match the style and appearance of the background image provided.

Return only ONE final edited image with the new background, no additional text or multiple images.`
      );

      // 1) Count input tokens first
      console.log('💰 GEMINI: Counting input tokens...');
      const { totalTokens = 0 } = await this.genAI.models.countTokens({ 
        model: "gemini-2.5-flash-image", 
        contents 
      });
      
      // 2) Estimate cost before making the request
      const preEstimate = this.estimatePreCost(totalTokens, 1);
      console.log('💰 GEMINI: Pre-estimate cost:', {
        inputTokens: preEstimate.inputTokens,
        inputCostUSD: `$${preEstimate.inputCostUSD.toFixed(6)}`,
        outputImagesCostUSD: `$${preEstimate.outputImagesCostUSD.toFixed(6)}`,
        totalUSD: `$${preEstimate.totalUSD.toFixed(6)}`
      });

      // 3) Make the API call
      console.log('🎨 GEMINI: Making API call with both images...');
      const response = await this.genAI.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents,
        config: { responseModalities: ["IMAGE"] }
      });
      
      if (!response.candidates || response.candidates.length === 0) {
        throw new Error('No response candidates from Gemini API');
      }
      console.log(response?.text);
      

      // 4) Get usage metadata and calculate actual cost
      const usage = (response as any).usageMetadata || {};
      const candidates = (response as any)?.candidates ?? [];
      const imagesOutActual = candidates.flatMap((c: any) => c?.content?.parts ?? [])
        .filter((p: any) => p?.inlineData?.data).length || 1;

      const actualCost = this.calculateActualCost(usage, imagesOutActual);
      console.log('💰 GEMINI: Actual cost after API call:', {
        promptTokens: actualCost.promptTokens,
        outputTokens: actualCost.outputTokens,
        imagesOut: actualCost.imagesOut,
        inputCostUSD: `$${actualCost.inputCostUSD.toFixed(6)}`,
        outputImagesCostUSD: `$${actualCost.outputImagesCostUSD.toFixed(6)}`,
        outputTextCostUSD: `$${actualCost.outputTextCostUSD.toFixed(6)}`,
        totalUSD: `$${actualCost.totalUSD.toFixed(6)}`
      });

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
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to edit image with background: ${error.message}`);
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
   * Build contents for Gemini API
   */
  private buildContents(base64Image: string, mime = "image/jpeg", instruction: string) {
    return [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: mime, data: base64Image } },
          { text: instruction },
        ],
      },
    ];
  }

  /**
   * Build contents for Gemini API with both main image and background image
   */
  private buildContentsWithBackground(
    mainImage: string, 
    backgroundImage: string, 
    instruction: string,
    mainMime = "image/jpeg",
    backgroundMime = "image/jpeg"
  ) {
    return [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: mainMime, data: mainImage } },
          { inlineData: { mimeType: backgroundMime, data: backgroundImage } },
          { text: instruction },
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
