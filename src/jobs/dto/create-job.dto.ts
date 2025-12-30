import { IsString, IsOptional, IsNotEmpty, IsEnum } from 'class-validator';

export enum Style {
  COOL_NGAU = 'cool_ngau',
  NGHIEM_TUK = 'nghiem_tuk',
  HUONG_NGOAI = 'huong_ngoai',
  CHILL_GUY = 'chill_guy',
  FASHION = 'fashion',
  BEO_XINH = 'beo_xinh',
}

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

  @IsString()
  @IsNotEmpty()
  aspectRatio: string;

  @IsOptional()
  @IsEnum(Style)
  style?: Style = Style.COOL_NGAU;
}
