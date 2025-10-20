"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.geminiConfig = void 0;
const config_1 = require("@nestjs/config");
exports.geminiConfig = (0, config_1.registerAs)('gemini', () => ({
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '1000', 10),
    temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.7'),
}));
//# sourceMappingURL=gemini.config.js.map