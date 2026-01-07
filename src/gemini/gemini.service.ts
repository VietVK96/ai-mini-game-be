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
      backgroundTemplateImage,
      maleOutfitImage,
      femaleOutfitImage,
      inputMimeType = 'image/jpeg',
      backgroundMimeType = 'image/jpeg',
      maleOutfitMimeType = 'image/png',
      femaleOutfitMimeType = 'image/png',
      aspectRatio = '1:1',
      style = 'cool_ngau',
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
      if (!this.isValidBase64(maleOutfitImage)) {
        throw new Error('Invalid male outfit image base64 data');
      }
      if (!this.isValidBase64(femaleOutfitImage)) {
        throw new Error('Invalid female outfit image base64 data');
      }

      // Check image sizes (base64 is ~33% larger than binary)
      const inputImageSize = (inputImage.length * 3) / 4;
      const backgroundTemplateImageSize = (backgroundTemplateImage.length * 3) / 4;
      const maleOutfitImageSize = (maleOutfitImage.length * 3) / 4;
      const femaleOutfitImageSize = (femaleOutfitImage.length * 3) / 4;
      const totalSizeMB = (inputImageSize + backgroundTemplateImageSize + maleOutfitImageSize + femaleOutfitImageSize) / (1024 * 1024);
      
      console.log('📏 GEMINI: Image sizes - Input:', (inputImageSize / (1024 * 1024)).toFixed(2), 'MB, Background:', (backgroundTemplateImageSize / (1024 * 1024)).toFixed(2), 'MB, Male Outfit:', (maleOutfitImageSize / (1024 * 1024)).toFixed(2), 'MB, Female Outfit:', (femaleOutfitImageSize / (1024 * 1024)).toFixed(2), 'MB, Total:', totalSizeMB.toFixed(2), 'MB');
      
      // Warn if images are very large (Gemini API typically has limits around 20MB total)
      if (totalSizeMB > 15) {
        console.warn('⚠️ GEMINI: Total image size is very large (' + totalSizeMB.toFixed(2) + 'MB). This may cause API errors.');
      }

      // Build contents for API with both images - instruction first to ensure AI reads it before processing images
      const instruction = `
       AI TRÒ CÁC ẢNH (CỐ ĐỊNH)
          ẢNH 1: ảnh chụp chân dung của tôi, sử dụng để trích xuất mặt.
          ẢNH 2: Template ZAPP = canvas cuối (LOCKED) → giữ pixel‑identical (màu, chữ, dây).
          ẢNH 3: Trang phục NAM (giữ logo ZAPP).
          ẢNH 4: Trang phục NỮ (giữ logo ZAPP).
        MỤC TIÊU
          Tạo một poster người mẫu trong studio chuyên nghiệp
          Giữ nguyên các đường nét đặc trưng của gương mặt, Giữ nguyên kiểu tóc
          Điều quan trọng: Duy trì sự nhất quán hoàn hảo về nhận dạng khuôn mặt với ẢNH 1. 
          Bảo toàn nhận dạng là ưu tiên hàng đầu.
          giữ nguyên các đường nét đặc trưng của gương mặt
          Dùng ẢNH 2 làm background khóa.
          Trích xuất khuôn mặt từ ẢNH 1.
          Scale toàn bộ subject (đầu + thân) để đạt tỷ lệ người thật.
          Áp dụng đúng trang phục từ ẢNH 3 (NAM) hoặc ẢNH 4 (NỮ) khớp với cơ thể đã scale.
          Đặt subject đúng tọa độ.
          Độ sâu dây: 2 dây foreground (blur) trước subject, 2 dây background sau subject.
          Kết quả = ẢNH 2 (không đổi) + subject đã ghép.

        **BỐ CỤC & TỶ LỆ (Nguyên tắc tự nhiên)**
        - Loại ảnh: Ảnh trung bình (chân dung từ eo trở lên).
        - Vị trí chủ thể: ở chính giữa khung hình. Mắt nằm ở 1/3 trên cùng (Nguyên tắc một phần ba)
        - Tỷ lệ cơ thể: Tỷ lệ đầu-vai chính xác về mặt giải phẫu. Đầu phải trông kết nối tự nhiên với cơ thể. Không phóng to đầu; điều chỉnh tỷ lệ cơ thể để phù hợp với kích thước đầu.
        
        **ÁNH SÁNG & PHA TRỘN (Quan trọng để đạt độ chân thực)**
        - Áp dụng "Chiếu sáng toàn cục" để hòa trộn chủ thể vào nền ZAPP.
        - Điều chỉnh hướng chiếu sáng và nhiệt độ màu của chủ thể sao cho phù hợp với môi trường nền.
        - Tạo bóng đổ chân thực từ các dải băng ở tiền cảnh lên quần áo/cơ thể để tạo chiều sâu.
        - Kết cấu da: Giữ nguyên lỗ chân lông, các khuyết điểm nhỏ và tông màu da tự nhiên từ [HÌNH 1]. Tránh vẻ ngoài da "nhựa" hoặc "sáp".
        
          QUY TẮC CỨNG (THỨ TỰ ƯU TIÊN)
          1) Bảo toàn khuôn mặt (cao nhất)
          giữ nguyên các đường nét đặc trưng của gương mặt: bao gồm: mắt,mũi,tai,má,màu tóc,da, lông mày,nốt ruồi, sẹo, môi
          2) Template bất biến
          ẢNH 2 tuyệt đối không chỉnh sửa. 4 dây phải giữ nguyên (số lượng, vị trí, góc, blur, opacity, màu, text).
          Foreground: 2 dây blur (chéo dưới góc trái, dọc trên bên phải) trước subject.
          Background: 2 dây sắc nét sau subject.
          Không được che mắt/mũi/miệng.2 dây background không che subject. 
          không tạo dây mới, không vẽ lại, không inpaint, không tưởng tượng, không chỉnh sửa background.
          3) Trang phục theo giới tính
          Xác định NAM/NỮ từ ẢNH 1.
          NAM → chỉ ẢNH 3; NỮ → chỉ ẢNH 4.
          Fit trang phục & phụ kiện theo pose.
          Sao chép chính xác thiết kế, màu, chất liệu, logo.
          Không trộn nam/nữ; không suy luận từ text.
          4) Pose & Biểu cảm (thấp)
          Áp dụng input: ${prompt}
          Ưu tiên biểu cảm → pose;
          Nếu xung đột với anchor/tỷ lệ/dây → giữ quy tắc, chỉnh pose tối thiểu.
          RÀNG BUỘC PHỦ ĐỊNH
          Không thêm text/watermark; không nhân đôi/méo logo.
          Không mờ nhòe/quầng sáng; không biến dạng tay.
          Không thêm/bớt dây (luôn 4 dây); không nền lộn xộn.
          ĐẦU RA
          Chỉ trả về ảnh cuối. Không giải thích.
      `;

      const contents = this.buildContentsWithBackground(
        {
          mainImage: inputImage,
          backgroundImage: backgroundTemplateImage,
          instruction: instruction,
          maleOutfitImage: maleOutfitImage,
          femaleOutfitImage: femaleOutfitImage,
          maleOutfitMimeType: maleOutfitMimeType,
          femaleOutfitMimeType: femaleOutfitMimeType,
          mainMime: inputMimeType,
          backgroundMime: backgroundMimeType,
          // referenceImage: referenceImage,
          // referenceImageMimeType: referenceImageMimeType,
        }
      );

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
      backgroundImage,
      instruction,
      maleOutfitImage,
      femaleOutfitImage,
      maleOutfitMimeType,
      femaleOutfitMimeType,
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
          { text: "THIRD IMAGE (MALE OUTFIT REFERENCE):" },
          { inlineData: { mimeType: maleOutfitMimeType, data: maleOutfitImage } },
          { text: "FOURTH IMAGE (FEMALE OUTFIT REFERENCE):" },
          { inlineData: { mimeType: femaleOutfitMimeType, data: femaleOutfitImage } },
          // { text: "FIFTH IMAGE (REFERENCE):" },
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
