import { ApiProperty } from "@nestjs/swagger"
import { IsNotEmpty, IsString } from "class-validator"

export class RefreshTokenDto {
  @ApiProperty({
    description: "Current opaque refresh token.",
    example: "a1b2c3d4... (128 hexadecimal characters)",
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string
}
