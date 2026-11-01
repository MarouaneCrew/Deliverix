/**
 * AuthController - manages user authentication and session operations.
 *
 * Rate limiting is applied to sensitive endpoints (login, forgot-password).
 * All authenticated endpoints require JWT access token.
 *
 * Token revocation: When a user is deactivated or soft-deleted, their existing
 * access tokens are immediately rejected via JwtStrategy validation on every request.
 */
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiTooManyRequestsResponse,
  ApiTags,
  ApiOkResponse,
} from "@nestjs/swagger"
import { Body, Controller, Get, Post, UseGuards, HttpCode, HttpStatus } from "@nestjs/common"
import { AuthService } from "./auth.service"
import { LoginDto } from "./dto/login.dto"
import { JwtAuthGuard } from "./guards/jwt-auth.guard"
import { RefreshTokenDto } from "./dto/refresh-token.dto"
import { CurrentUser } from "./decorators/current-user.decorator"
import { ChangePasswordDto } from "./dto/change-password.dto"
import { ForgotPasswordDto } from "./dto/forgot-password.dto"
import { ResetPasswordDto } from "./dto/reset-password.dto"
import { Throttle } from "@nestjs/throttler"
import { FORGOT_PASSWORD_THROTTLE, LOGIN_THROTTLE } from "./constants/throttle.constants"
import {
  TokensResponseDto,
  MessageResponseDto,
  ForgotPasswordResponseDto,
  CurrentUserResponseDto,
} from "./dto/auth-response.dto"

/**
 * AuthController - manages user authentication and session operations.
 *
 * Rate limiting is applied to sensitive endpoints (login, forgot-password).
 * All authenticated endpoints require JWT access token.
 *
 * Token revocation: When a user is deactivated or soft-deleted, their existing
 * access tokens are immediately rejected via JwtStrategy validation on every request.
 */
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Refreshes the access token using a valid refresh token.
   * Returns new access token and new refresh token (rotation).
   * Public endpoint - no authentication required.
   * @param token - Refresh token DTO containing refreshToken
   * @returns New access token and refresh token
   * @throws UnauthorizedException if refresh token is invalid or expired
   */
  @Post("refresh")
  @ApiOperation({
    summary: "Refresh access token",
    description:
      "Public endpoint - no authentication required. Refreshes access token using a valid refresh token.",
  })
  @ApiBody({ type: RefreshTokenDto, description: "Refresh token DTO containing refreshToken" })
  @ApiCreatedResponse({
    description: "New access and refresh tokens returned",
    type: TokensResponseDto,
  })
  @ApiUnauthorizedResponse({ description: "Invalid or expired refresh token" })
  @ApiTooManyRequestsResponse({
    description: "Global rate limit of 20 requests per minute per IP applied",
  })
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
  @ApiOperation({
    summary: "User login",
    description:
      "Rate limited (5 req/min). Authenticates a user and creates a new session. Validates email and password, creates access token (15 min) and refresh token (7 days).",
  })
  @ApiBody({ type: LoginDto, description: "Login credentials (email, password)" })
  @ApiCreatedResponse({
    description: "Access and refresh tokens returned",
    type: TokensResponseDto,
  })
  @ApiBadRequestResponse({ description: "Request validation failed" })
  @ApiUnauthorizedResponse({ description: "Invalid credentials" })
  @ApiTooManyRequestsResponse({ description: "Global rate limit of 5 requests per minute applied" })
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
  @ApiOperation({
    summary: "Change password",
    description:
      "Requires current password for verification. Updates passwordHash with bcrypt hash (10 rounds). Requires authentication.",
  })
  @ApiBearerAuth()
  @ApiBody({
    type: ChangePasswordDto,
    description: "Change password request (currentPassword, newPassword)",
  })
  @ApiOkResponse({ description: "Password changed successfully", type: MessageResponseDto })
  @ApiUnauthorizedResponse({ description: "User not authenticated or password incorrect" })
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
  @ApiOperation({
    summary: "Forgot password",
    description:
      "Rate limited (5 req/min). Initiates password reset flow. Generates a secure opaque token and sends to user email (dev only). Does NOT reveal whether email exists (prevents user enumeration).",
  })
  @ApiBody({ type: ForgotPasswordDto, description: "Forgot password request (email)" })
  @ApiOkResponse({
    description: "Generic response; resetToken may be returned in development",
    type: ForgotPasswordResponseDto,
  })
  @ApiTooManyRequestsResponse({
    description: "Global rate limit of 5 requests per minute per IP applied",
  })
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
  @ApiOperation({
    summary: "Reset password",
    description:
      "Completes password reset using a valid reset token. Validates token hash and expiry. Updates password and invalidates all existing tokens.",
  })
  @ApiBody({ type: ResetPasswordDto, description: "Reset password request (token, newPassword)" })
  @ApiOkResponse({ description: "Password reset successfully", type: MessageResponseDto })
  @ApiUnauthorizedResponse({ description: "Invalid or expired reset token" })
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
  @ApiOperation({
    summary: "Logout",
    description:
      "Terminates the authenticated user's session by revoking the refresh token. Clears the refresh token hash and expiry from the user record. Requires authentication.",
  })
  @ApiBearerAuth()
  @ApiOkResponse({ description: "Logged out successfully", type: MessageResponseDto })
  @ApiUnauthorizedResponse({ description: "User not authenticated" })
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
  @ApiOperation({
    summary: "Get current user",
    description:
      "Returns the authenticated user's profile information. Includes userId, role, companyId, hubId, isActive, deletedAt. JwtStrategy validates user exists and is active on every request.",
  })
  @ApiBearerAuth()
  @ApiOkResponse({ description: "Authenticated user's profile", type: CurrentUserResponseDto })
  @ApiUnauthorizedResponse({ description: "User not authenticated" })
  getMe(@CurrentUser() user: Express.User) {
    return user
  }
}
