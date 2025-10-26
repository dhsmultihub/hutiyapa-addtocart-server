import { IsArray, IsString, IsInt, Min, IsOptional, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkAddItemDto {
  @IsString()
  productId!: string;

  @IsString()
  @IsOptional()
  variantId?: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  metadata?: Record<string, string>;
}

export class BulkUpdateItemDto {
  @IsString()
  itemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  metadata?: Record<string, string>;
}

export class BulkOperationsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkAddItemDto)
  items?: BulkAddItemDto[];

  @IsArray()
  @IsString({ each: true })
  itemIds?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateItemDto)
  updates?: BulkUpdateItemDto[];

  @IsBoolean()
  @IsOptional()
  clearCart?: boolean;
}

export class BulkOperationResult {
  success!: boolean;
  itemId?: string;
  error?: string;
  data?: any;
}

export class BulkOperationsResponseDto {
  success!: boolean;
  totalItems!: number;
  successfulItems!: number;
  failedItems!: number;
  results!: BulkOperationResult[];
  errors!: string[];
}
