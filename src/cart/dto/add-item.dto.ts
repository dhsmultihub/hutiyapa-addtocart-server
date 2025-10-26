import { IsString, IsOptional, IsInt, Min, IsObject } from 'class-validator';
import { Transform } from 'class-transformer';

export class AddItemDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  quantity!: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}
