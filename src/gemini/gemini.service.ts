import { GoogleGenAI } from "@google/genai";
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiConfig } from '../config/gemini.interface';
import { BuildContentsWithBackgroundParams, EditImageWithReferenceTemplateParams } from './gemini.types';

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



  public editImageWithReferenceTemplate = async (
    params: EditImageWithReferenceTemplateParams
  ): Promise<Buffer> => {
    const {
      prompt,
      inputImage,
      backgroundTemplateImage,
      logoImage,
      inputMimeType = 'image/jpeg',
      backgroundMimeType = 'image/jpeg',
      logoMimeType = 'image/png',
      aspectRatio = '1:1',
      referenceImage = null,
      referenceImageMimeType = 'image/jpeg'
    } = params;

    try {
      console.log('🎨 GEMINI: Starting image editing with reference template...');

      // Validate base64 data
      if (!this.isValidBase64(inputImage)) {
        throw new Error('Invalid input image base64 data');
      }
      if (!this.isValidBase64(backgroundTemplateImage)) {
        throw new Error('Invalid reference template image base64 data');
      }

      // Check image sizes (base64 is ~33% larger than binary)
      const inputImageSize = (inputImage.length * 3) / 4;
      const backgroundTemplateImageSize = (backgroundTemplateImage.length * 3) / 4;
      const totalSizeMB = (inputImageSize + backgroundTemplateImageSize) / (1024 * 1024);
      
      console.log('📏 GEMINI: Image sizes - Input:', (inputImageSize / (1024 * 1024)).toFixed(2), 'MB, Reference:', (backgroundTemplateImageSize / (1024 * 1024)).toFixed(2), 'MB, Total:', totalSizeMB.toFixed(2), 'MB');
      
      // Warn if images are very large (Gemini API typically has limits around 20MB total)
      if (totalSizeMB > 15) {
        console.warn('⚠️ GEMINI: Total image size is very large (' + totalSizeMB.toFixed(2) + 'MB). This may cause API errors.');
      }

      // Build contents for API with both images - instruction first to ensure AI reads it before processing images
      const instruction = `
      CRITICAL TASK — READ CAREFULLY.
You are given EXACTLY 3 images:
- IMAGE 1 (FACE/IDENTITY): the user’s real face/identity reference.
- IMAGE 2 (ZAPP TEMPLATE BACKGROUND): the fixed final canvas with 4 composition strings/lines/tapes and brand background.
- IMAGE 3 (ZAPP LOGO): the official “ZAPP” logo (yellow + white, transparent background).

GOAL: Create ONE photorealistic final image by compositing:
- Keep IMAGE 2 as the base canvas (do NOT change its colors, tapes/strings count, shape, position, blur, or layout).
- Place the person (from IMAGE 1) into IMAGE 2, centered between the tapes, framed from waist/hip up.

POSITION (normalized to the template canvas):
- Subject centered: face center at (x=50%, y=28–32%).
- Eyes line at y≈28–30%.
- Waist-up crop: waist/crop line at y≈78–82%.
- Subject width spans x≈20%..80%.
- Keep headroom ~6–10% from the top edge.
Do NOT reposition any template elements to fit the subject. Fit/scale the subject to match the coordinates above.

HARD RULES (MUST FOLLOW):
1) FACE PRESERVATION (HIGHEST PRIORITY):
   - The face from IMAGE 1 must remain 100% identical (no redraw, no face swap, no beautify, no stylization).
   - Preserve facial features, identity, age, skin texture, moles/scars, expression as close as possible.

2) TEMPLATE LOCK + FOREGROUND OCCLUSION (SECOND PRIORITY):
   - IMAGE 2 must remain unchanged except where the subject overlays it.
   - The blurred foreground tapes/straps in IMAGE 2 are in FRONT of the subject.
   - Especially the blurred tape in the bottom-left quadrant must occlude the subject.
   - Do NOT remove, repaint, reshape, move, retype, or sharpen any tape; preserve their blur exactly.

   Composite order (MUST): template base (back) + subject (middle) + foreground tapes (top).

3) OUTFIT / VIBE:
   - Change ONLY clothing + styling of the person to match this style:
     "${prompt}"
   - Keep the person photorealistic, high-resolution, clean edges, natural lighting consistent with the template.

4) LOGO PLACEMENT:
   - Use ONLY the logo from IMAGE 3 (do NOT recreate or retype “ZAPP”).
   - Place it on the left chest of the outfit.
   - Allowed edits: scale up/down slightly; keep aspect ratio; no distortion/warping/rotation.
   - If needed for contrast, you may add a subtle outline/shadow, but keep logo colors (yellow/white) and readability.

NEGATIVE CONSTRAINTS:
- No extra text, no watermarks, no random symbols, no duplicated logos.
- No blur, no artifacts, no deformed hands/arms, no uncanny face.
- Do not change the template background or tapes.

OUTPUT:
- Return ONLY the final image (no explanation text).
If any conflict occurs, ALWAYS prioritize: (1) face from IMAGE 1, (2) template+tapes from IMAGE 2, (3) logo from IMAGE 3`;

      const contents = this.buildContentsWithBackground(
        {
          mainImage: inputImage,
          backgroundImage: backgroundTemplateImage,
          instruction: instruction,
          logoImage: logoImage,
          logoMimeType: logoMimeType,
          mainMime: inputMimeType,
          backgroundMime: backgroundMimeType,
          // referenceImage: referenceImage,
          // referenceImageMimeType: referenceImageMimeType,
        }
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
    params: BuildContentsWithBackgroundParams
  ) {
    const {
      mainImage,
      backgroundImage,
      instruction,
      logoImage,
      logoMimeType,
      mainMime,
      backgroundMime,
      referenceImage,
      referenceImageMimeType,
    } = params;
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
          // { text: "FOURTH IMAGE (REFERENCE):" },
          // { inlineData: { mimeType: referenceImageMimeType, data: referenceImage } },
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
