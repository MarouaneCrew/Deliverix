import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Throttle } from '@nestjs/throttler';
import { FORGOT_PASSWORD_THROTTLE, LOGIN_THROTTLE } from './constants/throttle.constants';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('refresh')
    async refreshAccessToken(@Body() token: RefreshTokenDto) {
        return this.authService.refreshAccessToken(token.refreshToken);
    }

    @Post('login')
    @Throttle(LOGIN_THROTTLE)
    async login(@Body() loginDto: LoginDto) {
        const user = await this.authService.validateUser(
            loginDto.email,
            loginDto.password
        );

        return this.authService.login(user);
    }

    @Post('change-password')
    @UseGuards(JwtAuthGuard)
    async changePassword(@CurrentUser() user: Express.User, @Body() dto: ChangePasswordDto) {
        return this.authService.changePassword(user.userId, dto.currentPassword, dto.newPassword);
    }

    @Post('forgot-password')
    @Throttle(FORGOT_PASSWORD_THROTTLE)
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authService.forgotPassword(dto.email);
    }

    @Post('reset-password')
    async resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto.token, dto.newPassword);
    }

    @Post('logout')
    @UseGuards(JwtAuthGuard)
    async logout(@CurrentUser() user: Express.User) {
        return this.authService.logout(user.userId);
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    getMe(@CurrentUser() user: Express.User) {
        return user;
    }
}
