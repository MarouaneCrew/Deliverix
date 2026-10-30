/**
 * JwtAuthGuard - protects endpoints with JWT authentication.
 *
 * This guard validates that:
 * - A valid JWT access token is present in the Authorization header
 * - The token has not expired
 * - The token was signed with the correct secret
 *
 * Upon successful validation, the decoded payload is attached to the request
 * object and passed to JwtStrategy for database validation (which also checks
 * if the user is still active and not soft-deleted).
 */
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
