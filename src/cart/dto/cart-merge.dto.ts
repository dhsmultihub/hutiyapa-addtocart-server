import { IsString, IsBoolean, IsOptional, IsEnum } from 'class-validator';

export enum ConflictResolution {
  GUEST = 'guest',
  USER = 'user',
  COMBINED = 'combined',
  NEWER = 'newer'
}

export class CartMergeDto {
  @IsBoolean()
  @IsOptional()
  combineQuantities?: boolean = true;

  @IsBoolean()
  @IsOptional()
  preserveMetadata?: boolean = true;

  @IsBoolean()
  @IsOptional()
  preferGuestPrice?: boolean = false;

  @IsBoolean()
  @IsOptional()
  preferUserPrice?: boolean = false;

  @IsEnum(ConflictResolution)
  @IsOptional()
  conflictResolution?: ConflictResolution = ConflictResolution.COMBINED;

  @IsString()
  @IsOptional()
  mergeReason?: string;
}

export class MergeConflict {
  productId!: string;
  variantId?: string;
  guestQuantity!: number;
  userQuantity!: number;
  guestPrice!: number;
  userPrice!: number;
  resolution!: 'guest' | 'user' | 'combined';
}

export class CartMergeResponseDto {
  success!: boolean;
  userCartId!: string;
  guestCartId!: string;
  itemsAdded!: number;
  itemsUpdated!: number;
  conflicts!: MergeConflict[];
  message!: string;
}

export class MergePreviewDto {
  guestCartId!: string;
  userCartId!: string;
  mergeOptions!: CartMergeDto;
}

export class MergePreviewResponseDto {
  conflicts!: MergeConflict[];
  itemsToAdd!: number;
  itemsToUpdate!: number;
  estimatedTotal!: number;
  estimatedSavings?: number;
}
