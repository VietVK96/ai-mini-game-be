import * as sharp from 'sharp';
export declare class ImageService {
    processImage(inputBuffer: Buffer, template: any, faceBuffer?: Buffer): Promise<Buffer>;
    private applyFaceSwap;
    resizeImage(buffer: Buffer, width: number, height: number, quality?: number): Promise<Buffer>;
    convertToWebp(buffer: Buffer, quality?: number): Promise<Buffer>;
    getImageMetadata(buffer: Buffer): Promise<sharp.Metadata>;
    resizeToFitTemplate(inputBuffer: Buffer, templateWidth: number, templateHeight: number): Promise<Buffer>;
}
