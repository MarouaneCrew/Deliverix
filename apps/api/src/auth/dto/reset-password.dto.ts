import { ApiProperty } from "@nestjs/swagger"
import { IsNotEmpty, IsString, MinLength } from "class-validator"

export class ResetPasswordDto {
  @ApiProperty({
    description: "Opaque password-reset token received through the reset flow.",
    example: "a1b2c3d4... (128 hexadecimal characters)",
  })
  @IsString()
  @IsNotEmpty()
  token: string

  @ApiProperty({
    example: "NewPassword123!",
    description: "New password. Minimum 8 characters.",
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  newPassword: string
}
