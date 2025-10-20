"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplatesService = void 0;
const common_1 = require("@nestjs/common");
const fs = require("fs");
const path_1 = require("path");
let TemplatesService = class TemplatesService {
    constructor() {
    }
    async getFilesPath() {
        try {
            const templatesPath = (0, path_1.join)(process.cwd(), 'public', 'templates', 'templates.json');
            const templatesData = await fs.promises.readFile(templatesPath, 'utf8');
            return JSON.parse(templatesData);
        }
        catch (error) {
            console.error('Failed to load templates:', error);
            return [];
        }
    }
    async getTemplates() {
        const files = await this.getFilesPath();
        for (const file of files) {
            try {
                const filePath = (0, path_1.join)(process.cwd(), 'public', file?.backgroundPath);
                const fileImage = await fs.promises.readFile(filePath);
                const base64Image = Buffer.from(fileImage).toString('base64');
                file.file = `data:image/jpeg;base64,${base64Image}`;
            }
            catch (error) {
                console.error('Failed to load template:', error);
                continue;
            }
        }
        return files;
    }
    async getTemplate(id) {
        const files = await this.getFilesPath();
        const file = files.find(file => file.id === id);
        if (!file) {
            throw new common_1.BadRequestException('Template not found');
        }
        const filePath = (0, path_1.join)(process.cwd(), 'public', file?.backgroundPath);
        const fileImage = await fs.promises.readFile(filePath);
        const base64Image = Buffer.from(fileImage).toString('base64');
        file.file = base64Image;
        return file;
    }
};
exports.TemplatesService = TemplatesService;
exports.TemplatesService = TemplatesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], TemplatesService);
//# sourceMappingURL=templates.service.js.map