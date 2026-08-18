import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../generated/prisma/client';
import { createHash, randomBytes } from 'node:crypto';

@Injectable()
export class AuthService {
    constructor(private readonly prisma: PrismaService, private readonly jwtService: JwtService) { }

    async validateUser(email: string, password: string) {
        const user = await this.prisma.user.findUnique({
            where: { email }
        });

        if (!user || !user.isActive || user.deletedAt) {
            throw new UnauthorizedException("Invalid credentials");
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);

        if (!passwordMatches) throw new UnauthorizedException("Invalid credentials");

        return user;
    }

    async changePassword(userId: string, currentPassword: string, newPassword: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user || !user.isActive || user.deletedAt) throw new UnauthorizedException('Invalid Credentials');

        const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);

        if (!passwordMatches) throw new UnauthorizedException('Current password is incorrect');

        const passwordHash = await bcrypt.hash(newPassword, 10);

        await this.prisma.user.update({
            where: { id: userId },
            data: {
                passwordHash
            }
        });

        return { message: "Password changed successfully" };
    }

    async forgotPassword(email: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });

        if (!user || !user.isActive || user.deletedAt) return { message: 'If that email exists, a reset link has been sent' };

        const resetToken = this.generateOpaqueToken();
        const resetTokenHash = this.hashToken(resetToken);
        const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

        await this.prisma.user.update({
            where: { id: user.id },
            data: { resetTokenHash, resetTokenExpiresAt }
        });

        const response: { message: string; resetToken?: string; } = {
            message: "If that email exists, a reset link has been sent"
        };

        if (process.env.NODE_ENV !== 'production') response.resetToken = resetToken;

        return response;
    }

    async resetPassword(token: string, newPassword: string) {
        const resetTokenHash = this.hashToken(token);

        const user = await this.prisma.user.findFirst({
            where: {
                resetTokenHash,
                isActive: true,
                deletedAt: null
            }
        });

        if (!user) throw new UnauthorizedException('Invalid or expired reset token');

        if (!user.resetTokenExpiresAt || user.resetTokenExpiresAt <= new Date()) throw new UnauthorizedException('Invalid or expired reset token');

        const passwordHash = await bcrypt.hash(newPassword, 10);

        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash,
                resetTokenHash: null,
                resetTokenExpiresAt: null,
                refreshTokenHash: null,
                refreshTokenExpiresAt: null
            }
        });

        return { message: 'Password reset successfully' };
    }

    async login(user: { id: string; role: UserRole; }) {
        const payload = {
            sub: user.id,
            role: user.role,
        };

        const accessToken = await this.jwtService.signAsync(payload);

        const refreshToken = this.generateOpaqueToken();
        const refreshTokenHash = this.hashToken(refreshToken);

        const refreshTokenExpiresAt = new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000,
        );

        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                refreshTokenHash,
                refreshTokenExpiresAt,
            },
        });

        return {
            accessToken,
            refreshToken
        };
    }

    async logout(userId: string) {
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                refreshTokenHash: null,
                refreshTokenExpiresAt: null
            }
        });

        return { message: 'Logged out successfully' };
    }

    async refreshAccessToken(refreshToken: string) {
        const refreshTokenHash = this.hashToken(refreshToken);

        const user = await this.prisma.user.findFirst({
            where: {
                refreshTokenHash,
                isActive: true,
                deletedAt: null,
            },
        });

        if (!user) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        if (
            !user.refreshTokenExpiresAt ||
            user.refreshTokenExpiresAt <= new Date()
        ) {
            throw new UnauthorizedException('Refresh token expired');
        }

        const payload = {
            sub: user.id,
            role: user.role,
        };

        const accessToken = await this.jwtService.signAsync(payload);

        const newRefreshToken = this.generateOpaqueToken();
        const newRefreshTokenHash = this.hashToken(newRefreshToken);

        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                refreshTokenHash: newRefreshTokenHash,
            },
        });

        return {
            accessToken,
            refreshToken: newRefreshToken,
        };
    }

    private generateOpaqueToken(): string {
        return randomBytes(64).toString('hex');
    }

    private hashToken(token: string): string {
        return createHash('sha256').update(token).digest('hex');
    }
}
