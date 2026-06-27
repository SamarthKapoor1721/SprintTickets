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
  if (currentUser.role === UserRole.super_admin || currentUser.role === UserRole.ceo) return true;
  return currentUser.id === ownerId;
}

export function canManageTask(currentUser: { id: number; role: UserRole }, projectOwnerId: number | null): boolean {
  if (currentUser.role === UserRole.super_admin || currentUser.role === UserRole.ceo) return true;
  return currentUser.id === projectOwnerId;
}

export function projectAccessWhere(currentUser: { id: number; role: UserRole }) {
  if (hasMinimumRole(currentUser.role, UserRole.ceo)) {
    return {};
  }

  return {
    OR: [
      { ownerId: currentUser.id },
      { memberships: { some: { userId: currentUser.id } } },
    ],
  };
}

export function taskAccessWhere(currentUser: { id: number; role: UserRole }) {
  if (hasMinimumRole(currentUser.role, UserRole.ceo)) {
    return {};
  }

  if (currentUser.role === UserRole.manager) {
    return {
      project: projectAccessWhere(currentUser),
    };
  }

  return {
    OR: [
      { assigneeId: currentUser.id },
      { creatorId: currentUser.id },
      { project: { memberships: { some: { userId: currentUser.id } } } },
      { project: { ownerId: currentUser.id } },
    ],
  };
}

export function reportAccessWhere(currentUser: { id: number; role: UserRole }) {
  if (hasMinimumRole(currentUser.role, UserRole.ceo)) {
    return {};
  }

  if (currentUser.role === UserRole.manager) {
    return {
      OR: [
        { submitterId: currentUser.id },
        { project: projectAccessWhere(currentUser) },
      ],
    };
  }

  return { submitterId: currentUser.id };
}

export function canManageUser(currentUserRole: UserRole, targetUserRole: UserRole): boolean {
  if (currentUserRole === UserRole.super_admin) return true;
  if (currentUserRole === UserRole.ceo && targetUserRole !== UserRole.super_admin) return true;
  return false;
}
