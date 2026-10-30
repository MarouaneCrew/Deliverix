/**
 * DTO for updating staff user information.
 *
 * All fields are optional. hubId can only be set for DISPATCHER users.
 */
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsNotEmpty,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  /**
   * Updated email address (optional).
   * Must be valid email format and globally unique.
   */
  @IsOptional()
  @IsEmail()
  email?: string;

  /**
   * Updated password (optional).
   * New password must be at least 8 characters.
   */
  @IsOptional()
  @MinLength(8)
  password?: string;

  /**
   * Updated hub ID (optional).
   * Only applicable for DISPATCHER users.
   * Hub must belong to the same company as the user.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  hubId?: string;

  /**
   * Updated active status (optional).
   * When false, user is soft-deleted and cannot authenticate.
   */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
