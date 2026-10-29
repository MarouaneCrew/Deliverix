import { IsBoolean, IsEmail, IsOptional, IsString, IsNotEmpty, MinLength } from "class-validator";

export class UpdateUserDto {
    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @MinLength(8)
    password?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    hubId?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}