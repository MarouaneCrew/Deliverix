import { IsBoolean, IsEmail, IsEnum, IsOptional, MinLength } from "class-validator";
import { assignableRoles, AssignableUserRole } from "../constants/user-roles";

export class UpdateUserDto {
    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @MinLength(8)
    password?: string;

    @IsOptional()
    @IsEnum(assignableRoles)
    role?: AssignableUserRole;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}