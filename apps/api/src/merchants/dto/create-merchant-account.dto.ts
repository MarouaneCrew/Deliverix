/**
 * DTO for attaching a login account to an existing merchant business record.
 *
 * Creates a new User with role MERCHANT and links it to the merchant via userId.
 * This allows the merchant to login and access their business data via /merchants/me.
 *
 * Validations:
 * - Email must be a valid email format
 * - Password must be at least 8 characters
 */
import { IsEmail, MinLength } from 'class-validator';

export class CreateMerchantAccountDto {
  /**
   * Email address for the merchant login account.
   * Must be valid email format and globally unique.
   */
  @IsEmail()
  email: string;

  /**
   * Password for the merchant login account.
   * Minimum 8 characters for security.
   */
  @MinLength(8)
  password: string;
}
