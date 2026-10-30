import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../generated/prisma/client';
import { createHash, randomBytes } from 'node:crypto';

/**
 * AuthService - manages user authentication and security.
 *
 * Token revocation is immediate via JwtStrategy validation on every request.
 * When a user is deactivated or soft-deleted, their existing access tokens
 * are immediately rejected (not valid for 15 minutes).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Validates user credentials during login.
   * Checks that user exists, is active, not deleted, and password matches.
   * @param email - User email address
   * @param password - Plain text password
   * @returns User object with id and role if valid
   * @throws UnauthorizedException if credentials are invalid or user is inactive/deleted
   */
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches)
      throw new UnauthorizedException('Invalid credentials');

    return user;
  }

  /**
   * Changes the authenticated user's password.
   * Requires current password for verification.
   * Updates passwordHash with bcrypt hash (10 rounds).
   * @param userId - User ID (from authenticated session)
   * @param currentPassword - Existing password for verification
   * @param newPassword - New password to set
   * @returns Success message
   * @throws UnauthorizedException if user not found, inactive, deleted, or current password incorrect
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive || user.deletedAt)
      throw new UnauthorizedException('Invalid Credentials');

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!passwordMatches)
      throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
      },
    });

    return { message: 'Password changed successfully' };
  }

  /**
   * Initiates password reset flow for a user.
   * Generates a secure opaque token, stores its hash, and sets expiry (1 hour).
   * In production, returns generic message; in development, returns raw token.
   * Does NOT reveal whether email exists (prevents user enumeration).
   * @param email - User email address requesting password reset
   * @returns Message indicating if email exists and optionally the reset token
   */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive || user.deletedAt)
      return { message: 'If that email exists, a reset link has been sent' };

    const resetToken = this.generateOpaqueToken();
    const resetTokenHash = this.hashToken(resetToken);
    const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetTokenHash, resetTokenExpiresAt },
    });

    const response: { message: string; resetToken?: string } = {
      message: 'If that email exists, a reset link has been sent',
    };

    if (process.env.NODE_ENV !== 'production') response.resetToken = resetToken;

    return response;
  }

  /**
   * Completes password reset using a valid reset token.
   * Validates token hash, checks expiry, and updates password.
   * Invalidates all existing tokens (refresh and reset) for security.
   * @param token - Raw reset token (received via email in dev)
   * @param newPassword - New password to set
   * @returns Success message
   * @throws UnauthorizedException if token is invalid or expired
   */
  async resetPassword(token: string, newPassword: string) {
    const resetTokenHash = this.hashToken(token);

    const user = await this.prisma.user.findFirst({
      where: {
        resetTokenHash,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!user)
      throw new UnauthorizedException('Invalid or expired reset token');

    if (!user.resetTokenExpiresAt || user.resetTokenExpiresAt <= new Date())
      throw new UnauthorizedException('Invalid or expired reset token');

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    });

    return { message: 'Password reset successfully' };
  }

  /**
   * Creates a new authenticated session for a validated user.
   * Generates access token (15 min expiry) and refresh token (7 days).
   * Stores refresh token hash in database for revocation.
   * @param user - User object with id and role
   * @returns Access token and refresh token
   */
  async login(user: { id: string; role: UserRole }) {
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
      refreshToken,
    };
  }

  /**
   * Terminates the authenticated user's session by revoking the refresh token.
   * Clears the refresh token hash and expiry from the user record.
   * @param userId - User ID to logout
   * @returns Success message
   */
  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    });

    return { message: 'Logged out successfully' };
  }

  /**
   * Refreshes an access token using a valid refresh token.
   * Validates refresh token hash and expiry.
   * Generates new access token and new refresh token (rotation).
   * @param refreshToken - Current refresh token
   * @returns New access token and new refresh token
   * @throws UnauthorizedException if refresh token is invalid or expired
   */
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

  /**
   * Generates a cryptographically secure opaque token.
   * Used for refresh tokens and password reset tokens.
   * @returns 128-character hex string (64 bytes)
   */
  private generateOpaqueToken(): string {
    return randomBytes(64).toString('hex');
  }

  /**
   * Creates a SHA-256 hash of a token for secure storage.
   * Tokens are never stored in plain text.
   * @param token - Raw token to hash
   * @returns 64-character hex string (SHA-256 hash)
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
