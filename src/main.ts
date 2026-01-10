import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';


async function bootstrap() {
  console.log('🚀 MAIN: Starting application...');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  console.log('🚀 MAIN: AppModule created');
  
  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // CORS configuration
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://zapp-khoidaychatdzieng.vn'] 
      : [
          'http://localhost:3000', 
          'http://localhost:3001',
          'http://localhost:8001',
          'http://localhost:8002',
          /^http:\/\/192\.168\.\d+\.\d+:(8001|8002)$/,  // Allow local network IPs
          /^http:\/\/10\.\d+\.\d+\.\d+:(8001|8002)$/,   // Allow 10.x.x.x network
          /^http:\/\/172\.\d+\.\d+\.\d+:(8001|8002)$/,
          /^http:\/\/172\.24\.0\.1:(8001|8002)$/,
          /^http:\/\/58\.186\.98\.56:(8001|8002)$/,
          /^http:\/\/42\.119\.155\.107:(8001|8002)$/,
          /^http:\/\/image-ai\.ddns\.net:(8001|8002)$/,
          'https://zapp-khoidaychatdzieng.vn',
          
            // Allow specific IP
        ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Serve static files from public directory
  app.useStaticAssets(join(process.cwd(), 'public'), {
    prefix: '/',
    setHeaders: (res, path) => {
      // Set cache headers for images in shares directory
      if (path.includes('/shares/')) {
        if (path.endsWith('_og.jpg') || path.endsWith('_og.jpeg')) {
          // OG images: longer cache but with revalidation for Facebook
          res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate'); // 1 hour
          res.setHeader('Content-Type', 'image/jpeg');
        } else if (path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.png')) {
          // Original images: shorter cache
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
        }
      }
    },
  });

  // Global prefix - exclude share page routes
  app.setGlobalPrefix('api/v1', {
    exclude: ['/s/(.*)'], // Exclude share page routes from prefix (pattern matching)
  });

  const port = parseInt(process.env.API_PORT || '3001', 10);
  await app.listen(port,'0.0.0.0');
  
  console.log(`[${new Date().toISOString()}] 🚀 Server running on http://localhost:${port}`);
  console.log(`[${new Date().toISOString()}] 📚 API Documentation: http://localhost:${port}/api/v1`);
}

bootstrap();
