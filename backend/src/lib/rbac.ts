import { UserRole } from "@prisma/client";

export const ROLE_RANKS: Record<UserRole, number> = {
  [UserRole.employee]: 1,
  [UserRole.manager]: 2,
  [UserRole.ceo]: 3,
  [UserRole.super_admin]: 4,
};

export function hasMinimumRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_RANKS[userRole] >= ROLE_RANKS[requiredRole];
}

export function isSuperAdmin(userRole: UserRole): boolean {
  return userRole === UserRole.super_admin;
}

export function canManageProject(currentUser: { id: number; role: UserRole }, ownerId: number | null): boolean {
  if (hasMinimumRole(currentUser.role, UserRole.ceo)) return true;
  return currentUser.id === ownerId;
}

export function canManageTask(currentUser: { id: number; role: UserRole }, projectOwnerId: number | null): boolean {
  if (hasMinimumRole(currentUser.role, UserRole.ceo)) return true;
  return currentUser.id === projectOwnerId;
}

export function canManageUser(currentUserRole: UserRole, targetUserRole: UserRole): boolean {
  if (currentUserRole === UserRole.super_admin) return true;
  if (currentUserRole === UserRole.ceo && (targetUserRole === UserRole.manager || targetUserRole === UserRole.employee)) return true;
  return false;
}
