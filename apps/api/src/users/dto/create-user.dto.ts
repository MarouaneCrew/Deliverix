/**
 * DTO for creating a new staff user account.
 *
 * Staff users are DISPATCHER users who need accounts but don't have profiles.
 * Drivers and merchants are created via their respective modules.
 *
 * Email must be globally unique.
 * Role is restricted to DISPATCHER only (via assignableRoles constant).
 */
import { IsEmail, IsString, IsNotEmpty, MinLength, IsEnum } from "class-validator"
import { assignableRoles, type AssignableUserRole } from "../constants/user-roles"

export class CreateUserDto {
  /**
   * Email address for the user account (required).
   * Must be valid email format and globally unique.
   */
  @IsEmail()
  email: string

  /**
   * Password for the user account (required).
   * Minimum 8 characters for security.
   */
  @IsNotEmpty()
  @MinLength(8)
  password: string

  /**
   * User role (required).
   * Currently only DISPATCHER is assignable via this endpoint.
   * Drivers and merchants are created via their respective modules.
   */
  @IsEnum(assignableRoles)
  role: AssignableUserRole

  /**
   * Hub ID the dispatcher is assigned to (required).
   * Hub must belong to the same company.
   */
  @IsString()
  @IsNotEmpty()
  hubId: string
}
