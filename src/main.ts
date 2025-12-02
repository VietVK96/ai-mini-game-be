import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';


async function bootstrap() {
  console.log('🚀 MAIN: Starting application...');
  const app = await NestFactory.create(AppModule);
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
      ? ['https://yourdomain.com'] 
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
          
            // Allow specific IP
        ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  const port = parseInt(process.env.API_PORT || '3001', 10);
  await app.listen(port,'0.0.0.0');
  
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/v1`);
}

bootstrap();
