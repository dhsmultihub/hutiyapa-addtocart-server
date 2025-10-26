import { IsInt, Min, IsOptional, IsObject } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateItemDto {
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  quantity!: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}
