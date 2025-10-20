import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateJobDto {
  @IsNotEmpty()
  file: Express.Multer.File;

  @IsOptional()
  face?: Express.Multer.File;

  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsString()
  @IsNotEmpty()
  templateId: string;
}
