export interface GeminiPart {
  text?: string;
  inlineData?: {
    data: string;
    mimeType: string;
  };
}

export interface GeminiContent {
  role?: string;
  parts: GeminiPart[];
}

export interface GeminiRequest {
  contents: GeminiContent[];
}

export interface GeminiGenerationConfig {
  maxOutputTokens: number;
  temperature: number;
}

export interface GeminiModelConfig {
  model: string;
  generationConfig?: GeminiGenerationConfig;
}

export interface EditImageWithReferenceTemplateParams {
  prompt: string;
  inputImage: string;
  maleOutfitImage: string;
  femaleOutfitImage: string;
  inputMimeType?: string;
  maleOutfitMimeType?: string;
  femaleOutfitMimeType?: string;
  aspectRatio?: string;
  style?: string;
  referenceImage?: string;
  referenceImageMimeType?: string;
}

export interface BuildContentsWithBackgroundParams {
  mainImage: string,
  instruction: string,
  maleOutfitImage: string,
  femaleOutfitImage: string,
  maleOutfitMimeType: string,
  femaleOutfitMimeType: string,
  mainMime: string ,
  referenceImage?: string,
  referenceImageMimeType?: string
}