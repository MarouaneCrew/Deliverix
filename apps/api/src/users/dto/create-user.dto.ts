import { IsEmail, IsEnum, IsNotEmpty, MinLength } from 'class-validator';
import { assignableRoles, AssignableUserRole } from '../constants/user-roles';

export class CreateUserDto {
    @IsEmail()
    email: string;

    @IsNotEmpty()
    @MinLength(8)
    password: string;

    @IsEnum(assignableRoles)
    role: AssignableUserRole;
}