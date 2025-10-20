import { IsOptional, IsString, IsNumber } from 'class-validator';

export class BaseDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsNumber()
  createdAt?: number;

  @IsOptional()
  @IsNumber()
  updatedAt?: number;
}
