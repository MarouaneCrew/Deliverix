/**
 * DTO for creating a new city in the global reference data.
 *
 * Cities are shared reference data (NOT tenant-owned).
 * Name is case-insensitive unique.
 */
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCityDto {
  /**
   * City name (required).
   * Max 80 characters. Auto-trimmed on input.
   * Case-insensitive unique constraint enforced.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name: string;
}
