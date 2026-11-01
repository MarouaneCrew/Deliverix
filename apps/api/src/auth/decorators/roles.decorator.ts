import { SetMetadata } from "@nestjs/common"
import type { UserRole } from "@/generated/prisma/enums"
import { ROLES_KEY } from "@/auth/constants/roles.constant"

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles)
