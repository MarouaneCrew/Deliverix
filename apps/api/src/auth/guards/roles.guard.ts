import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common"
import type { Reflector } from "@nestjs/core"
import type { UserRole } from "@/generated/prisma/enums"
import { ROLES_KEY } from "@/auth/constants/roles.constant"

/**
 * RolesGuard - enforces role-based authorization on endpoints.
 *
 * This guard reads the required roles from the handler's @Roles() decorator
 * and checks if the authenticated user has one of those roles.
 *
 * Key behaviors:
 * - If no @Roles() decorator is present on the handler, access is granted (open endpoint)
 * - If @Roles() is present, user's role must be in the required roles list
 * - If user is missing or has wrong role, throws 403 ForbiddenException
 *
 * Note: Class-level @Roles() is silently ignored - only handler-level metadata is read.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /**
   * Checks if the authenticated user has the required role(s) for the endpoint.
   *
   * @param context - Request execution context containing handler metadata
   * @returns true if user has required role(s), false otherwise
   */
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<UserRole[]>(ROLES_KEY, context.getHandler())

    if (!requiredRoles) return true

    const request = context.switchToHttp().getRequest<Express.Request>()
    const user = request.user

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException()
    }

    return true
  }
}
