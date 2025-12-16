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
  backgroundTemplateImage: string;
  logoImage: string;
  inputMimeType?: string;
  backgroundMimeType?: string;
  logoMimeType?: string;
  aspectRatio?: string;
  referenceImage?: string;
  referenceImageMimeType?: string;
}

export interface BuildContentsWithBackgroundParams {
  mainImage: string,
  backgroundImage: string,
  instruction: string,
  logoImage: string,
  logoMimeType: string,
  mainMime: string ,
  backgroundMime: string ,
  referenceImage?: string,
  referenceImageMimeType?: string
}