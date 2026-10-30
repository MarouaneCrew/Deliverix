/**
 * DTO for creating a new merchant business record.
 *
 * Creates a merchant as a business entity without requiring a login.
 * The merchant can exist independently; a login can be attached later via /merchants/:id/account.
 *
 * Validation rules:
 * - name: required string, max 120 chars, auto-trimmed
 * - cityId: required reference to an existing city
 * - phone: optional E.164 format phone (8-15 digits with optional +)
 * - address: optional string, max 255 chars
 */
import { IsString, IsNotEmpty, IsOptional, MaxLength, Matches } from "class-validator"
import { Transform } from "class-transformer"

export class CreateMerchantDto {
  /**
   * Business name (required).
   * Max 120 characters. Auto-trimmed on input.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  name: string

  /**
   * Reference to the city where the merchant operates (required).
   * Must match an existing city in the global reference data.
   */
  @IsString()
  @IsNotEmpty()
  cityId: string

  /**
   * Business phone number (optional).
   * E.164 format: +[country code][number], 8-15 digits total.
   * Example: +212539999999
   */
  @IsOptional()
  @Matches(/^\+?[0-9]{8,15}$/)
  phone?: string

  /**
   * Business address (optional).
   * Max 255 characters.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string
}
