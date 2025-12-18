import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3001',
  shareTtlSeconds: parseInt(process.env.SHARE_TTL_SECONDS || '21600', 10),
  maxUploadMB: parseInt(process.env.MAX_UPLOAD_MB || '8', 10),
  appShareUrl: process.env.APP_SHARE_URL || 'https://zapp.vn',
  fbAppId: process.env.FB_APP_ID,
}));

