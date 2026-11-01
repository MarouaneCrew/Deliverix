import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"

export class TokensResponseDto {
  @ApiProperty({
    description: "JWT access token. Include it in the Authorization header as a Bearer token.",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  accessToken!: string

  @ApiProperty({
    description: "Opaque refresh token used to obtain a new access token.",
    example: "a1b2c3d4... (128 hexadecimal characters)",
  })
  refreshToken!: string
}

export class MessageResponseDto {
  @ApiProperty({ example: "Password changed successfully" })
  message!: string
}

export class ForgotPasswordResponseDto {
  @ApiProperty({
    description: "Generic response that does not reveal whether the email exists.",
    example: "If that email exists, a reset link has been sent",
  })
  message!: string

  @ApiPropertyOptional({
    description: "Reset token returned only outside production environments.",
    example: "a1b2c3d4... (128 hexadecimal characters)",
  })
  resetToken?: string
}

export class CurrentUserResponseDto {
  @ApiProperty({ example: "cm123abc456" })
  userId!: string

  @ApiProperty({
    enum: ["ADMIN", "DISPATCHER", "DRIVER", "MERCHANT"],
    example: "ADMIN",
  })
  role!: string

  @ApiProperty({ example: "cm123company456" })
  companyId!: string

  @ApiProperty({
    example: "cm123hub456",
    nullable: true,
    description: "Hub assigned to the user, or null if no hub is assigned.",
  })
  hubId!: string | null
}
