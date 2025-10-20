import { BadRequestException, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { join } from 'path';
import { Template } from './templates.types';
import { tryCatch } from 'bullmq';

@Injectable()
export class TemplatesService {

  constructor() {
    
  }

  private async getFilesPath():Promise<Template[]> {
    try {
      const templatesPath = join(process.cwd(), 'public', 'templates', 'templates.json');
      const templatesData = await fs.promises.readFile(templatesPath, 'utf8');
      return JSON.parse(templatesData);
    } catch (error) {
      console.error('Failed to load templates:', error);
      return [];
    }
  }

  async getTemplates(): Promise<Template[]> {
     const files = await this.getFilesPath();
     for (const file of files) {
      try {
       const filePath = join(process.cwd(), 'public',file?.backgroundPath);
        const fileImage = await fs.promises.readFile(filePath);
        const base64Image = Buffer.from(fileImage).toString('base64');
        file.file = `data:image/jpeg;base64,${base64Image}`;
      } catch (error) {
        console.error('Failed to load template:', error);
        continue;
      }
     }
     return files;
  }

  async getTemplate(id: string): Promise<Template | null> {
    const files = await this.getFilesPath();
    const file = files.find(file => file.id === id);
    if (!file) {
       throw new BadRequestException('Template not found');
    }
    const filePath = join(process.cwd(), 'public',file?.backgroundPath);
    const fileImage = await fs.promises.readFile(filePath);
    const base64Image = Buffer.from(fileImage).toString('base64');
    file.file = base64Image;
    return file;
  }

}
