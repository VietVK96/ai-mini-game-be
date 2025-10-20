"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
async function bootstrap() {
    console.log('🚀 MAIN: Starting application...');
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    console.log('🚀 MAIN: AppModule created');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.enableCors({
        origin: process.env.NODE_ENV === 'production'
            ? ['https://yourdomain.com']
            : [
                'http://localhost:3000',
                'http://localhost:3001',
                'http://localhost:8001',
                'http://localhost:8002',
                /^http:\/\/192\.168\.\d+\.\d+:(8001|8002)$/,
                /^http:\/\/10\.\d+\.\d+\.\d+:(8001|8002)$/,
                /^http:\/\/172\.\d+\.\d+\.\d+:(8001|8002)$/,
                /^http:\/\/58\.187\.175\.79:(8001|8002)$/,
            ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    });
    app.setGlobalPrefix('api/v1');
    const port = parseInt(process.env.API_PORT || '3001', 10);
    await app.listen(port, '0.0.0.0');
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(`📚 API Documentation: http://localhost:${port}/api/v1`);
}
bootstrap();
//# sourceMappingURL=main.js.map