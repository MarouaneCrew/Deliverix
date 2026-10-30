import { UserRole } from "../../generated/prisma/enums"

// /users only creates staff that need no profile. Drivers and merchants are created via /drivers and /merchants.
export const assignableRoles = [UserRole.DISPATCHER]

export type AssignableUserRole = typeof UserRole.DISPATCHER
