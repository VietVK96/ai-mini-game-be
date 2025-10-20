"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageService = void 0;
const common_1 = require("@nestjs/common");
const path_1 = require("path");
const sharp = require("sharp");
let ImageService = class ImageService {
    async processImage(inputBuffer, template, faceBuffer) {
        try {
            if (!Buffer.isBuffer(inputBuffer)) {
                console.error('Invalid inputBuffer:', typeof inputBuffer, inputBuffer);
                throw new Error('inputBuffer must be a valid Buffer');
            }
            if (inputBuffer.length === 0) {
                throw new Error('inputBuffer is empty');
            }
            const filePath = (0, path_1.join)(process.cwd(), 'public', template.backgroundPath);
            const background = await sharp(filePath);
            let processedInput = await this.resizeToFitTemplate(inputBuffer, template.placement.width, template.placement.height);
            if (faceBuffer && template.faceSwap) {
                if (!Buffer.isBuffer(faceBuffer)) {
                    console.error('Invalid faceBuffer:', typeof faceBuffer, faceBuffer);
                    throw new Error('faceBuffer must be a valid Buffer');
                }
                processedInput = await this.applyFaceSwap(processedInput, faceBuffer);
            }
            const finalMetadata = await sharp(processedInput).metadata();
            console.log(`Final image size: ${finalMetadata.width}x${finalMetadata.height}`);
            console.log(`Template placement: ${template.placement.width}x${template.placement.height}`);
            if (finalMetadata.width > template.placement.width || finalMetadata.height > template.placement.height) {
                console.error(`Image size exceeds template! Forcing resize to template size.`);
                processedInput = await sharp(processedInput)
                    .resize(template.placement.width, template.placement.height, {
                    fit: 'cover',
                    position: 'center',
                })
                    .toBuffer();
                const forcedMetadata = await sharp(processedInput).metadata();
                console.log(`Forced resize to: ${forcedMetadata.width}x${forcedMetadata.height}`);
            }
            const result = await background
                .composite([
                {
                    input: processedInput,
                    left: template.placement.x,
                    top: template.placement.y,
                },
            ])
                .webp({ quality: 90 })
                .toBuffer();
            return result;
        }
        catch (error) {
            console.error('Image processing error:', error);
            throw new Error(`Failed to process image: ${error.message}`);
        }
    }
    async applyFaceSwap(inputBuffer, faceBuffer) {
        console.log('Face swap requested but not implemented');
        return inputBuffer;
    }
    async resizeImage(buffer, width, height, quality = 90) {
        return sharp(buffer)
            .resize(width, height, {
            fit: 'cover',
            position: 'center',
        })
            .webp({ quality })
            .toBuffer();
    }
    async convertToWebp(buffer, quality = 90) {
        return sharp(buffer)
            .webp({ quality })
            .toBuffer();
    }
    async getImageMetadata(buffer) {
        return sharp(buffer).metadata();
    }
    async resizeToFitTemplate(inputBuffer, templateWidth, templateHeight) {
        const metadata = await sharp(inputBuffer).metadata();
        console.log(`Original image: ${metadata.width}x${metadata.height}`);
        console.log(`Template size: ${templateWidth}x${templateHeight}`);
        const widthRatio = templateWidth / metadata.width;
        const heightRatio = templateHeight / metadata.height;
        const ratio = Math.min(widthRatio, heightRatio);
        let newWidth = Math.floor(metadata.width * ratio);
        let newHeight = Math.floor(metadata.height * ratio);
        newWidth = Math.min(newWidth, templateWidth);
        newHeight = Math.min(newHeight, templateHeight);
        console.log(`Calculated size: ${newWidth}x${newHeight}`);
        console.log(`Template limits: ${templateWidth}x${templateHeight}`);
        if (newWidth > templateWidth || newHeight > templateHeight) {
            console.warn('Calculated size exceeds template, forcing to template size');
            newWidth = templateWidth;
            newHeight = templateHeight;
        }
        console.log(`Final resize to: ${newWidth}x${newHeight}`);
        return sharp(inputBuffer)
            .resize(newWidth, newHeight, {
            fit: 'cover',
            position: 'center',
        })
            .toBuffer();
    }
};
exports.ImageService = ImageService;
exports.ImageService = ImageService = __decorate([
    (0, common_1.Injectable)()
], ImageService);
//# sourceMappingURL=image.service.js.map