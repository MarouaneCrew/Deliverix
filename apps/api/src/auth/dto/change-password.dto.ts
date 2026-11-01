import { ApiProperty } from "@nestjs/swagger"
import { IsNotEmpty, IsString, MinLength } from "class-validator"

export class ChangePasswordDto {
  @ApiProperty({ example: "OldPassword123!", description: "Current account password." })
  @IsString()
  @IsNotEmpty()
  currentPassword: string

  @ApiProperty({
    example: "NewPassword123!",
    description: "New password. Minimum 8 characters.",
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  newPassword: string
}
