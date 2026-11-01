import { Injectable } from "@nestjs/common"
import { PassportStrategy } from "@nestjs/passport"
import { ExtractJwt, Strategy } from "passport-jwt"
import type { UserRole } from "@/generated/prisma/enums"
import type { ConfigService } from "@nestjs/config"
import type { PrismaService } from "@/prisma/prisma.service"
import { UnauthorizedException } from "@nestjs/common"

/**
 * JwtStrategy - validates JWT access tokens on every request.
 *
 * This strategy implements immediate token revocation:
 * - When a user is deactivated (isActive=false), their token is rejected
 * - When a user is soft-deleted (deletedAt is set), their token is rejected
 * - The database is queried on every request to check current user state
 *
 * This closes the "revoked token valid for 15 min" gap present in stateless JWT.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>("JWT_SECRET")!,
    })
  }

  /**
   * Validates the JWT payload by checking the user in the database.
   * Returns user info with companyId and hubId for authorization.
   *
   * Immediate revocation checks:
   * - User must exist
   * - User must be active (isActive=true)
   * - User must not be soft-deleted (deletedAt=null)
   *
   * @param payload - JWT payload containing sub (userId) and role
   * @returns User object with userId, role, companyId, hubId if valid
   * @throws UnauthorizedException if user not found, inactive, or soft-deleted
   */
  async validate(payload: { sub: string; role: UserRole }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        companyId: true,
        hubId: true,
        isActive: true,
        deletedAt: true,
      },
    })

    if (!user || !user.isActive || user.deletedAt) throw new UnauthorizedException()

    return {
      userId: user.id,
      role: user.role,
      companyId: user.companyId,
      hubId: user.hubId,
    }
  }
}
