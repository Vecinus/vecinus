export const ADMIN_ROLE_ID = 1;

export const ROLE_LABELS: Record<number, string> = {
  1: 'Administrador',
  2: 'Propietario',
  3: 'Inquilino',
  4: 'Presidente',
  5: 'Empleado',
};

export function toRoleId(role: string | number | null | undefined): number | null {
  if (typeof role === 'number' && Number.isFinite(role)) {
    return role;
  }

  if (typeof role === 'string') {
    const parsedRole = Number.parseInt(role, 10);
    return Number.isNaN(parsedRole) ? null : parsedRole;
  }

  return null;
}

export function isAdministratorRole(role: string | number | null | undefined): boolean {
  return toRoleId(role) === ADMIN_ROLE_ID;
}
