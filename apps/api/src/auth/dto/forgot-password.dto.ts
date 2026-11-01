import { ApiProperty } from "@nestjs/swagger"
import { IsEmail, IsNotEmpty } from "class-validator"

export class ForgotPasswordDto {
  @ApiProperty({ example: "admin@deliverix.ma", description: "Email associated with the account." })
  @IsEmail()
  @IsNotEmpty()
  email: string
}
