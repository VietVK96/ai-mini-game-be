import { Controller, Get, Param, Query } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { Template } from './templates.types';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  async getTemplates(): Promise<Template[]> {
    return await this.templatesService.getTemplates();
  }

  @Get(':id')
  async getTemplate(@Param('id') id: string): Promise<Template | null> {
    return this.templatesService.getTemplate(id);
  }

}
