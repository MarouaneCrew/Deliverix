/**
 * DTO for creating a new hub within a company.
 *
 * Hubs are tenant-owned (companyId required).
 * Each hub belongs to one company and one city.
 */
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateHubDto {
  /**
   * Reference to the city where the hub is located (required).
   * Must match an existing city in the global reference data.
   */
  @IsString()
  @IsNotEmpty()
  cityId: string;

  /**
   * Hub name (required).
   * Max 120 characters. Auto-trimmed on input.
   * Unique per company (compound unique with companyId).
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name: string;

  /**
   * Hub physical address (optional).
   * Max 255 characters.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;
}
