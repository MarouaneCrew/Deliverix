import { UserRole } from "../../generated/prisma/enums";

export const assignableRoles = Object.values(UserRole).filter(
    (role) => role !== UserRole.ADMIN
);

export type AssignableUserRole = Exclude<UserRole, 'ADMIN'>;