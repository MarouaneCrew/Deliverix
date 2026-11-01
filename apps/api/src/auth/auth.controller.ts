/**
 * AuthController - manages user authentication and session operations.
 *
 * Rate limiting is applied to sensitive endpoints (login, forgot-password).
 * All authenticated endpoints require JWT access token.
 *
 * Token revocation: When a user is deactivated or soft-deleted, their existing
 * access tokens are immediately rejected via JwtStrategy validation on every request.
 */
import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common"
import type { AuthService } from "./auth.service"
import type { LoginDto } from "./dto/login.dto"
import { JwtAuthGuard } from "./guards/jwt-auth.guard"
import type { RefreshTokenDto } from "./dto/refresh-token.dto"
import { CurrentUser } from "./decorators/current-user.decorator"
import type { ChangePasswordDto } from "./dto/change-password.dto"
import type { ForgotPasswordDto } from "./dto/forgot-password.dto"
import type { ResetPasswordDto } from "./dto/reset-password.dto"
import { Throttle } from "@nestjs/throttler"
import { FORGOT_PASSWORD_THROTTLE, LOGIN_THROTTLE } from "./constants/throttle.constants"

/**
 * Refreshes the access token using a valid refresh token.
 * Returns new access token and new refresh token (rotation).
 * Public endpoint - no authentication required.
 * @param token - Refresh token DTO containing refreshToken
 * @returns New access token and refresh token
 * @throws UnauthorizedException if refresh token is invalid or expired
 */
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("refresh")
  async refreshAccessToken(@Body() token: RefreshTokenDto) {
    return this.authService.refreshAccessToken(token.refreshToken)
  }

  /**
   * Authenticates a user and creates a new session.
   * Rate limited (default: 5 requests per minute).
   * Validates email and password, creates access token (15 min) and refresh token (7 days).
   * @param loginDto - Login credentials (email, password)
   * @returns Access token and refresh token
   * @throws UnauthorizedException if credentials are invalid
   * @throws TooManyRequestsException if rate limit exceeded
   */
  @Post("login")
  @Throttle(LOGIN_THROTTLE)
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password)

    return this.authService.login(user)
  }

  /**
   * Changes the authenticated user's password.
   * Requires current password for verification.
   * Updates passwordHash with bcrypt hash (10 rounds).
   * @param user - Authenticated user (from JWT token)
   * @param dto - Change password request (currentPassword, newPassword)
   * @returns Success message
   * @throws UnauthorizedException if user not authenticated or password incorrect
   */
  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  async changePassword(@CurrentUser() user: Express.User, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(
      user.userId,
      user.companyId,
      dto.currentPassword,
      dto.newPassword,
    )
  }

  /**
   * Initiates password reset flow for a user.
   * Rate limited (default: 5 requests per minute).
   * Generates a secure opaque token and sends to user email (dev only).
   * Does NOT reveal whether email exists (prevents user enumeration).
   * @param dto - Forgot password request (email)
   * @returns Generic success message (or reset token in dev)
   * @throws TooManyRequestsException if rate limit exceeded
   */
  @Post("forgot-password")
  @Throttle(FORGOT_PASSWORD_THROTTLE)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email)
  }

  /**
   * Completes password reset using a valid reset token.
   * Validates token hash and expiry.
   * Updates password and invalidates all existing tokens.
   * @param dto - Reset password request (token, newPassword)
   * @returns Success message
   * @throws UnauthorizedException if token is invalid or expired
   */
  @Post("reset-password")
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword)
  }

  /**
   * Terminates the authenticated user's session by revoking the refresh token.
   * Clears the refresh token hash and expiry from the user record.
   * @param user - Authenticated user (from JWT token)
   * @returns Success message
   */
  @Post("logout")
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: Express.User) {
    return this.authService.logout(user.userId)
  }

  /**
   * Returns the authenticated user's profile information.
   * Includes userId, role, companyId, hubId, isActive, deletedAt.
   * JwtStrategy validates user exists and is active on every request.
   * @param user - Authenticated user (from JWT token, validated by JwtStrategy)
   * @returns User profile object
   */
  @Get("me")
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: Express.User) {
    return user
  }
}
