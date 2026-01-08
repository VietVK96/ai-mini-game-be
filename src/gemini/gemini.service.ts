import { GoogleGenAI } from "@google/genai";
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiConfig } from '../config/gemini.interface';
import { BuildContentsWithBackgroundParams, EditImageWithReferenceTemplateParams } from './gemini.types';
import { Style } from "src/jobs/dto/create-job.dto";

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
      maleOutfitImage,
      femaleOutfitImage,
      inputMimeType = 'image/jpeg',
      maleOutfitMimeType = 'image/png',
      femaleOutfitMimeType = 'image/png',
      aspectRatio = '1:1',
    } = params;

    try {
      console.log('🎨 GEMINI: Starting image editing with reference template...');

      // Validate base64 data
      if (!this.isValidBase64(inputImage)) {
        throw new Error('Invalid input image base64 data');
      }
      if (!this.isValidBase64(maleOutfitImage)) {
        throw new Error('Invalid male outfit image base64 data');
      }
      if (!this.isValidBase64(femaleOutfitImage)) {
        throw new Error('Invalid female outfit image base64 data');
      }


      // Build contents for API with both images - instruction first to ensure AI reads it before processing images
      const instruction = `
       *DỮ LIỆU ĐẦU VÀO
          ẢNH 1: Ảnh chân dung người dùng (nguồn khuôn mặt & cơ thể).
          ẢNH 2:  Ảnh tham chiếu pose dáng + trang phục + background của nhân vật Nam. KHÔNG sử dụng cơ thể, tỷ lệ, hình dáng của người trong ảnh này.
          ẢNH 3: Ảnh tham chiếu pose dáng + trang phục + background của nhân vật NỮ. KHÔNG sử dụng cơ thể, tỷ lệ, hình dáng của người trong ảnh này.
       **MỤC TIÊU
          Tạo 1 bức ảnh mới duy nhất với các quy tắc sau:
          TRƯỜNG HỢP 1 — NẾU NGƯỜI DÙNG LÀ NAM
          + Tạo một poster người mẫu chuyên nghiệp trong studio với hình ảnh 1,
          + giữ nguyên toàn bộ cơ thể từ ẢNH 1,
          + chỉ áp dụng pose dáng (joint angles only) và trang phục, background từ ẢNH 2
          + Giữ ánh sáng, góc máy, độ sâu trường ảnh đồng bộ với ẢNH 2, nhưng tái chiếu (re-project) toàn bộ cơ thể theo tỷ lệ và volume của ẢNH 1.
          TRƯỜNG HỢP 2 — NẾU NGƯỜI DÙNG LÀ NỮ
          + Tạo một poster người mẫu chuyên nghiệp trong studio với hình ảnh 1,
          + giữ nguyên toàn bộ cơ thể từ ẢNH 1,
          + chỉ áp dụng pose dáng (joint angles only) và trang phục từ ẢNH 3
          + Giữ ánh sáng, góc máy, độ sâu trường ảnh đồng bộ với ẢNH 3, nhưng tái chiếu (re-project) toàn bộ cơ thể theo tỷ lệ và volume của ẢNH 1.

         ** ƯU TIÊN NGUỒN:
          1. Cơ thể + tỷ lệ + cổ + vai: ẢNH 1 (USER)
          2. Pose dáng (joint angles only): ẢNH 2 hoặc ẢNH 3
          3. Trang phục & background: ẢNH 2 hoặc ẢNH 3
          4. Giữ nguyên tỷ lệ kích thước đầu so với vai và torso như trong ẢNH 1, không phóng to đầu để phù hợp pose hoặc outfit
        ***QUY TẮC Tạo ẢNH (RẤT QUAN TRỌNG)***
          KHÔNG tạo khuôn mặt mới, không thay đổi danh tính người dùng.
          KHÔNG tưởng tượng thêm người, vật thể, trang phục mới ngoài ảnh mẫu.
          Không vẽ lại background, không thêm chi tiết không tồn tại.
          Tỷ lệ cơ thể tự nhiên, không méo hình, không cartoon.
          Kết quả phải giống ảnh chụp thật (photorealistic).
        ***** Biểu cảm (ƯU TIÊN THẤP)
          - Áp dụng biểu cảm input: ${prompt} cho người trong ẢNH 1.
        ****CHẤT LƯỢNG HÌNH ẢNH
          Độ nét cao, ánh sáng tự nhiên.
          Màu da hài hòa với ánh sáng nền.
          Không watermark, không text, không logo.

        *TUYỆT ĐỐI KHÔNG sử dụng từ ẢNH 2 / ẢNH 3:
        - Cổ, vai, torso, tay, độ rộng vai, độ dày cổ
        - Tỷ lệ đầu–thân của nhân vật mẫu
        - Bất kỳ phần cơ thể nào ngoài pose (skeleton)
        - Không blend, không nội suy, không tái tạo lại cơ thể giữa ẢNH 1 và ẢNH 2 / ẢNH 3
      `;

      const contents = this.buildContentsWithBackground( {
          mainImage: inputImage,
          instruction: instruction,
          maleOutfitImage: maleOutfitImage,
          femaleOutfitImage: femaleOutfitImage,
          maleOutfitMimeType: maleOutfitMimeType,
          femaleOutfitMimeType: femaleOutfitMimeType,
          mainMime: inputMimeType,
        } );

      // 3) Make the API call
      console.log('🎨 GEMINI: Making API call with both images...');
      const response = await this.genAI.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents,
        config: { 
          responseModalities: ["IMAGE"], 
          imageConfig:{
            aspectRatio: aspectRatio,
          },
          temperature: 0.8,
          topK: 15,
          topP: 0.8,
          candidateCount: 1,
         },
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
      instruction,
      maleOutfitImage,
      femaleOutfitImage,
      maleOutfitMimeType,
      femaleOutfitMimeType,
      mainMime,
    } = params;
    return [
      {
        role: "user",
        parts: [
          { text: instruction },
          { text: "ẢNH 1 (INPUT FACE - CHÂN DUNG NGƯỜI THẬT):" },
          { inlineData: { mimeType: mainMime, data: mainImage } },
          { text: "ẢNH 2 (TEMPLATE NAM - CÓ SẴN POSE, TRANG PHỤC, BACKGROUND):" },
          { inlineData: { mimeType: maleOutfitMimeType, data: maleOutfitImage } },
          { text: "ẢNH 3 (TEMPLATE NỮ - CÓ SẴN POSE, TRANG PHỤC, BACKGROUND):" },
          { inlineData: { mimeType: femaleOutfitMimeType, data: femaleOutfitImage } },
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
