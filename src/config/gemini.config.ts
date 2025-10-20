import { registerAs } from '@nestjs/config';

export const geminiConfig = registerAs('gemini', () => ({
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '1000', 10),
  temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.7'),
}));
