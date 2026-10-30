/**
 * DTO for updating merchant business information.
 *
 * All fields are optional. When provided, values are validated:
 * - name: trimmed string, max 120 chars
 * - phone: optional E.164 format phone number (8-15 digits with optional + prefix)
 * - address: optional string, max 255 chars
 * - isActive: optional boolean
 */
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  Matches,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateMerchantDto {
  /**
   * Updated business name (optional).
   * Auto-trimmed. Max 120 characters.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

  /**
   * Updated city ID (optional).
   * Must reference an existing city in the system.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cityId?: string;

  /**
   * Updated business phone number (optional).
   * Optional E.164 format: +[country code][number], 8-15 digits total.
   * Example: +212539999999
   */
  @IsOptional()
  @Matches(/^\+?[0-9]{8,15}$/)
  phone?: string;

  /**
   * Updated business address (optional).
   * Max 255 characters.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  /**
   * Updated active status (optional).
   * When false, merchant is soft-deleted and cannot login.
   */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
