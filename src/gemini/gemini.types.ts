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
