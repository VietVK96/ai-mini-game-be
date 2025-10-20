import { TemplatesService } from './templates.service';
import { Template } from './templates.types';
export declare class TemplatesController {
    private readonly templatesService;
    constructor(templatesService: TemplatesService);
    getTemplates(): Promise<Template[]>;
    getTemplate(id: string): Promise<Template | null>;
}
