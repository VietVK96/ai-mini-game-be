export interface Template {
  id: string;
  name: string;
  description?: string;
  backgroundPath: string;
  overlayPath?: string;
  placement: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  aspectRatio: string;
  category: string;
  tags: string[];
  previewUrl?: string;
  file: string;
}

export interface TemplatePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TemplateFilters {
  aspectRatio?: string;
  category?: string;
  search?: string;
}
