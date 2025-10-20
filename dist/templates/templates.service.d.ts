import { Template } from './templates.types';
export declare class TemplatesService {
    constructor();
    private getFilesPath;
    getTemplates(): Promise<Template[]>;
    getTemplate(id: string): Promise<Template | null>;
}
