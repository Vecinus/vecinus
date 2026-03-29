export type CommunityRole = string | number | null | undefined;

export const isAdminRole = (role: CommunityRole): boolean => {
  if (role === null || role === undefined) return false;

  if (typeof role === 'number') {
    return role === 1 || role === 4;
  }

  const normalizedRole = role.trim().toLowerCase();
  return (
    normalizedRole === '1' ||
    normalizedRole === '4' ||
    normalizedRole === 'administrador' ||
    normalizedRole === 'presidente'
  );
};
