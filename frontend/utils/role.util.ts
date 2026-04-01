export const ROLE_LABELS: Record<number, string> = {
  1: 'Administrador',
  2: 'Propietario',
  3: 'Inquilino',
  4: 'Presidente',
  5: 'Empleado',
};

export const isAdmin = (role: string | number | null) => {
  if (role === null) return false;
  return Number(role) === 1;
};

export const isPresident = (role: string | number | null) => {
  if (role === null) return false;
  return Number(role) === 4;
};

export const isAdminOrPresident = (role: string | number | null) => {
  return isAdmin(role) || isPresident(role);
};