import { IsString, IsOptional, IsNotEmpty, MaxLength, IsBoolean } from "class-validator"
import { Transform } from "class-transformer"

export class UpdateHubDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
