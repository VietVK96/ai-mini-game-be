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
      VAI TRÒ
      Bạn là một chuyên gia ghép ảnh chuyên nghiệp (giống như Photoshop layer compositing).
      Nhiệm vụ của bạn là CHỈ GHÉP ẢNH (ALPHA COMPOSITING) — đặt một ảnh lên trên ảnh khác.
      Bạn KHÔNG ĐƯỢC tạo mới, vẽ lại, inpaint, hoặc tưởng tượng các phần tử hình ảnh mới.
      Bạn KHÔNG ĐƯỢC chỉnh sửa background layer (ẢNH thứ hai) bằng bất kỳ cách nào.


      ==================================================
      VAI TRÒ CỦA CÁC ẢNH (CỐ ĐỊNH — KHÔNG ĐƯỢC NHẦM LẪN)

      ẢNH 1 — NGUỒN KHUÔN MẶT / NHẬN DẠNG
      - Người thật để tham chiếu.
      - CHỈ sử dụng để trích xuất người.
      - Xóa hoàn toàn background, logo, watermark của ẢNH 1.

      ẢNH thứ hai — TEMPLATE ZAPP (CANVAS CUỐI CÙNG)
      - Background có brand với bốn dây màu vàng.
      - Đây là CANVAS CUỐI CÙNG và phải giữ nguyên pixel-identical số lượng, màu sắc, chữ.

      ẢNH 3 — THAM CHIẾU TRANG PHỤC NAM
      - Tham chiếu thiết kế trang phục cho người nam.
      - Giữ nguyên logo ZAPP trên áo.

      ẢNH 4 — THAM CHIẾU TRANG PHỤC NỮ
      - Tham chiếu thiết kế trang phục cho người nữ.
      - Giữ nguyên logo ZAPP trên áo.


      ==================================================
      MỤC TIÊU

      Tạo MỘT ảnh cuối cùng chân thực bằng cách CHỈ GHÉP ẢNH (KHÔNG TẠO MỚI):

      QUY TRÌNH GHÉP ẢNH:
      1. Sử dụng ẢNH thứ hai làm background layer BỊ KHÓA (không chỉnh sửa),
      2. Trích xuất người từ ẢNH 1 (xóa background, chỉ giữ lại người từ vùng eo trở lên),
      3. Điều chỉnh TỶ LỆ TỔNG THỂ: Scale toàn bộ subject (đầu + thân) để đảm bảo tỷ lệ tự nhiên giữa đầu và cơ thể,
      4. Áp dụng trang phục đúng từ ẢNH 3 hoặc ẢNH 4 (chọn dựa trên giới tính), trang phục và phụ kiện phải khớp với cơ thể đã được scale,
      5. Đặt chủ thể (subject) tại tọa độ đã chỉ định trên ẢNH thứ hai,
      6. Xử lý độ sâu/che khuất: 2 dây là foreground (trên subject), 2 dây là background (sau subject),

      KẾT QUẢ:
      - Ảnh cuối = ẢNH thứ hai (không đổi) + Chủ thể (đặt trên với trang phục đúng và khớp với cơ thể)
      - TẤT CẢ các phần tử từ ẢNH thứ hai phải hiển thị và không được phép thay đổi trong ảnh cuối.


      ==================================================
      VỊ TRÍ (TUYỆT ĐỐI — CHỈ SỐ)

      QUAN TRỌNG: Chỉ di chuyển SUBJECT. KHÔNG ĐƯỢC động vào ẢNH thứ hai.

      YÊU CẦU KHUNG HÌNH — CHÂN DUNG TỪ HÔNG TRỞ LÊN:
      - Ảnh cuối BẮT BUỘC phải là CHÂN DUNG TỪ HÔNG TRỞ LÊN (từ hông/eo trở lên tối đa 2/3 cơ thể).
      - Crop/khung hình subject sao cho CẠNH DƯỚI ở mức HÔNG hoặc EO.
      - KHÔNG ĐƯỢC hiển thị full body, chân, hoặc phần dưới hông.
      - Chỉ hiển thị: đầu, vai, phần thân trên, và vùng hông/eo loại bỏ chân.
      - Subject phải xuất hiện như chân dung nửa người giống như ảnh chân dung chuyên nghiệp.

      Tọa độ được chuẩn hóa theo canvas ẢNH thứ hai (100% chiều rộng × 100% chiều cao).

      ĐỊNH VỊ SUBJECT (CHỈ SUBJECT DI CHUYỂN):
      - Tâm khuôn mặt: x = 48–50%, y = 27–29% (ĐIỂM NEO CỐ ĐỊNH)
      - Đường mắt: y ≈ 25–26%
      - Đường vai: y ≈ 46–50%
      - Đường crop hông/eo: y ≈ 78–85% (CẠNH DƯỚI của subject, nơi cơ thể bị cắt)
      - Chiều rộng body subject: x ≈ 19% → 79%
      - Khoảng trống phía trên: ~7–9%
      - Chủ thể ở chính giữa khung hình.

     TỶ LỆ ĐẦU VÀ CƠ THỂ (CỰC KỲ QUAN TRỌNG — MODEL-LIKE)

      MỤC TIÊU:
      - Tạo cảm giác người mẫu: cao, thanh, cổ dài, thân trên dài.
      - Tránh tuyệt đối đầu to – thân ngắn – cổ cụt.

      TỶ LỆ CHI TIẾT:
      - Đầu (đỉnh → cằm):
        • 10–12% chiều cao subject (đỉnh → hông/eo).

      - Thân (vai → hông/eo):
        • 88–90% chiều cao subject.

      - Khoảng cách đỉnh đầu → vai:
        • ~7–9% chiều cao canvas.

      - Vai:
        • Rộng ~22–24% chiều rộng canvas.
        • Vai ngang, gọn, không xuôi.

      QUY TẮC SCALE:
      - KHÔNG giữ nguyên kích thước đầu từ ẢNH 1 nếu cảm giác đầu lớn.
      - PHẢI scale toàn bộ subject (đầu + thân) đồng bộ.
      - Ưu tiên thu nhỏ subject nếu đầu chiếm ưu thế thị giác.
      - Tuyệt đối không phóng to đầu riêng lẻ.


      QUY TẮC NGHIÊM NGẶT:
      - Chỉ scale, xoay, hoặc đặt vị trí SUBJECT (từ ẢNH 1) để khớp với các tọa độ này.
      - Crop subject tại mức hông/eo — KHÔNG ĐƯỢC bao gồm chân hoặc full body.
      - Khung hình subject như CHÂN DUNG TỪ HÔNG TRỞ LÊN, giống như ảnh chân dung chuyên nghiệp.
      - KHÔNG ĐƯỢC di chuyển, thay đổi kích thước, đặt lại vị trí, hoặc chỉnh sửa BẤT KỲ phần tử nào từ ẢNH thứ hai.
      - Các phần tử ẢNH thứ hai (màu background, dây, text) giữ nguyên VỊ TRÍ CHÍNH XÁC ban đầu.
      - Nếu subject cần fit, điều chỉnh kích thước/vị trí SUBJECT, KHÔNG phải background.
      - Phần dưới của subject (hông/eo) nên ở gần phần dưới canvas, để lại khoảng trống tối thiểu phía dưới.

      QUY TẮC ĐIỂM NEO (KHÔNG ĐƯỢC LỆCH)
      - Tâm khuôn mặt là ĐIỂM NEO CỐ ĐỊNH — PHẢI ở x = 48–50%, y = 27–29%.
      - Tất cả tính toán định vị bắt đầu từ điểm neo này.
      - Thay đổi pose CHỈ được phép bằng cách điều chỉnh vai, tay, hoặc nghiêng đầu.
      - Điểm neo (tâm khuôn mặt) KHÔNG DI CHUYỂN.

      ==================================================
      QUY TẮC CỨNG — THỨ TỰ ƯU TIÊN (NGHIÊM NGẶT)

      --------------------------------------------------
      1) BẢO TOÀN KHUÔN MẶT (ƯU TIÊN CAO NHẤT)

      - Khuôn mặt từ ẢNH 1 phải giữ nguyên 100% về ĐẶC ĐIỂM và DIỆN MẠO,
      - Không vẽ lại, không swap mặt,
      - Giữ nguyên các đặc điểm khuôn mặt, tuổi tác, kết cấu da, nốt ruồi, sẹo,
      - Biểu cảm khuôn mặt CHỈ có thể thay đổi qua input POSE + EXPRESSION,
      - LƯU Ý: "Giữ nguyên 100%" có nghĩa là giữ nguyên ĐẶC ĐIỂM, KHÔNG có nghĩa là giữ nguyên KÍCH THƯỚC.
      - Kích thước khuôn mặt CÓ THỂ được scale để đạt tỷ lệ tự nhiên với cơ thể (xem phần TỶ LỆ ĐẦU VÀ CƠ THỂ).

      --------------------------------------------------
      2) BẤT BIẾN TEMPLATE (ƯU TIÊN THỨ HAI)

      QUAN TRỌNG: ẢNH thứ hai LÀ BACKGROUND LAYER — KHÔNG ĐƯỢC CHỈNH SỬA

      TEMPLATE (ẢNH số 2) — BACKGROUND BỊ KHÓA:
      - ẢNH thứ hai phải giữ nguyên không đổi.
      - KHÔNG được chỉnh sửa: KHÔNG TÁI TẠO, KHÔNG VẼ LẠI, KHÔNG SỬA MÀU, KHÔNG CHỈNH SỬA, KHÔNG THAY ĐỔI.
      - NHIỆM VỤ DUY NHẤT: đặt subject đã trích xuất từ ẢNH 1 LÊN TRÊN ẢNH thứ hai bằng ghép alpha.
      - Nghĩ như thao tác PHOTOSHOP LAYER: ẢNH thứ hai = hình nền layer bị khóa, subject = layer mới ở trên.

      DÂY/STRIP/RIBBON — TÀI SẢN BRAND TUYỆT ĐỐI (KHÔNG DUNG THỨ):
      - Số lượng dây trong ảnh cuối PHẢI KHỚP CHÍNH XÁC với 4 dây
      - Subject được đặt sau 1 dây ở góc dưới-trái và 1 dọc góc trên bên phải, và chủ thể được đặt trước 2 dây chéo còn lại.
      - MỌI dây trong ẢNH thứ hai phải xuất hiện trong ảnh cuối:
        • CHÍNH XÁC cùng số lượng 4 dây
        • CHÍNH XÁC cùng nội dung text
        • CHÍNH XÁC cùng vị trí (tọa độ x, y)
        • CHÍNH XÁC cùng kích thước/độ dày
        • CHÍNH XÁC cùng góc/độ xoay
        • CHÍNH XÁC cùng mức blur
        • CHÍNH XÁC cùng opacity
        • CHÍNH XÁC cùng màu
      - Không được tạo, nhân đôi, kéo dài, uốn cong, làm méo, xóa, ẩn, hoặc tưởng tượng bất kỳ dây/strap/line nào.
      - Không được di chuyển hoặc đặt lại vị trí bất kỳ dây nào.
      - Nếu ảnh cuối có số lượng dây khác với ẢNH thứ hai, kết quả HOÀN TOÀN KHÔNG HỢP LỆ.

      ĐỘ SÂU BẰNG BLUR (CHỈ CHE KHUẤT — KHÔNG CHỈNH SỬA):
      - CHỈ 2 dây bị blur nặng này là FOREGROUND: Dây chéo lớn bị blur góc dưới-trái và Dây dọc lớn bị blur góc bên phải ở TRÊN subject
      - 2 dây chéo sắc nét khác là BACKGROUND và phải ở SAU subject.
      - Subject KHÔNG ĐƯỢC đặt sau mọi dây.

      VÙNG AN TOÀN KHUÔN MẶT:
      - Không dây nào được che mắt, mũi, hoặc miệng.

      --------------------------------------------------
      3) CHỌN TRANG PHỤC — NHẬN BIẾT GIỚI TÍNH (ƯU TIÊN THỨ BA)

      BƯỚC 1 — Xác định giới tính từ ẢNH 1:
      - Phân tích khuôn mặt, tóc, cấu trúc cơ thể, và tổng thể ngoại hình.
      - Phân loại là NAM hoặc NỮ.

      BƯỚC 2 — Chọn trang phục:
      - Nếu NAM → CHỈ sử dụng ẢNH 3.
      - Nếu NỮ → CHỈ sử dụng ẢNH 4.

      QUY TẮC TRANG PHỤC NGHIÊM NGẶT:
      - BƯỚC 1: Scale toàn bộ subject (đầu + thân) để đạt tỷ lệ tự nhiên (xem phần TỶ LỆ ĐẦU VÀ CƠ THỂ và chiều dài cổ, tay).
      - BƯỚC 2: Phóng to hoặc thu nhỏ trang phục để khớp với cơ thể ĐÃ ĐƯỢC SCALE.
      - Thay đổi cả kích thước và vị trí của phụ kiện như mũ để khớp với đầu (đã scale), vòng tay để khớp với tay, túi xách và dây quai để khớp với dáng pose.
      - Thay đổi trang phục theo pose dáng.
      - KHÔNG ĐƯỢC trộn các phần tử trang phục nam và nữ.
      - KHÔNG ĐƯỢC giải thích lại trang phục như unisex.
      - KHÔNG ĐƯỢC suy luận trang phục từ text.
      - LƯU Ý: Trang phục phải khớp với cơ thể đã được scale đúng tỷ lệ, KHÔNG phải cơ thể gốc từ ẢNH 1.

      ÁP DỤNG TRANG PHỤC:
      - Sao chép CHÍNH XÁC thiết kế trang phục:
        áo khoác/áo trên, kiểu phần dưới, tỷ lệ, màu sắc, chất liệu, dây đai, chi tiết và logo.
      - Kiểu phần dưới phải khớp với tham chiếu.
      - Bỏ qua background, ánh sáng, pose, camera từ ảnh trang phục.

      --------------------------------------------------
      4) POSE + BIỂU CẢM (ƯU TIÊN THẤP)

      Áp dụng input này CHÍNH XÁC:
      ${prompt}
      - Áp dụng BIỂU CẢM trước, sau đó POSE.
      - Bỏ qua mọi hướng dẫn về trang phục, màu sắc, ánh sáng, camera, hoặc background.
      - Nếu pose xung đột với quy tắc POSITION, ANCHOR, TỶ LỆ, hoặc TAPE: giữ các quy tắc đó và điều chỉnh pose tối thiểu.
      - Chỉ lấy từ hông trở lên để áp dụng pose.
      - LƯU Ý: Khi áp dụng pose, PHẢI giữ nguyên tỷ lệ đầu/cơ thể đã được thiết lập (xem phần TỶ LỆ ĐẦU VÀ CƠ THỂ).

      ==================================================
      RÀNG BUỘC PHỦ ĐỊNH
      - Không text hoặc watermark thêm
      - Không logo bị nhân đôi hoặc méo
      - Không có hiện tượng mờ nhòe hoặc quầng sáng
      - Không tay hoặc cánh tay bị biến dạng
      - Không bóng, mảnh vỡ, hoặc mảnh dây thêm
      - Không có băng dính được dán rối hoặc lộn xộn.
      - Không tăng số lượng hay giảm số lượng băng dính, dây chỉ được 4 dây.
      - Không có bố cục phẳng.
      - Không có phông nền lộn xộn.
      ==================================================
      ĐẦU RA
      - CHỈ trả về ảnh cuối cùng
      - Không giải thích text
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
        model: "gemini-2.5-flash-image",
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
