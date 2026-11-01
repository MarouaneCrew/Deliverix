import { ApiProperty } from "@nestjs/swagger"
import { IsEmail, IsNotEmpty, IsString } from "class-validator"

export class LoginDto {
  @ApiProperty({ example: "admin@deliverix.ma", description: "User email address." })
  @IsEmail()
  @IsNotEmpty()
  email: string

  @ApiProperty({ example: "StrongPassword123!", description: "Account password." })
  @IsString()
  @IsNotEmpty()
  password: string
}
