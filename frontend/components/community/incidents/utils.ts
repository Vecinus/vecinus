export const normalizeRoleToBackendToken = (role: string | number | null): string | null => {
  if (role === null || typeof role === 'undefined') return null;

  if (typeof role === 'number') {
    return String(role);
  }

  const raw = String(role).trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return String(Number.parseInt(raw, 10));

  const normalized = raw.toLowerCase();
  if (normalized === 'administrador' || normalized === 'admin') return '1';     
  if (normalized === 'presidente' || normalized === 'president') return '4';    
  if (normalized === 'empleado' || normalized === 'employee') return '5';       

  return null;
};

export const getErrorMessage = (error: any, fallback: string): string => {
  return error?.response?.data?.detail || error?.message || fallback;
};

export const getUserFacingErrorMessage = (error: any, fallback: string): string => {   
  const status = error?.response?.status;
  const detail = String(error?.response?.data?.detail ?? '').trim();

  if (status === 401) {
    return 'Tu sesion ha expirado. Cierra sesion y vuelve a iniciar sesion.';   
  }

  if (status === 403) {
    if (detail.includes('Admins cannot create incidents')) {
      return 'Como administrador no puedes crear incidencias en esta comunidad.';
    }
    if (detail.includes('Admin, president or employee access required for this action')) {
      return 'Tu rol actual no permite cambiar el estado de esta incidencia.';  
    }
    if (detail.includes('User does not own this incident')) {
      return 'Solo la persona que abrio esta incidencia puede eliminarla cuando esta revisada.';
    }
    if (detail.includes('User has no access to this association') || detail.includes('Access denied to this community')) {
      return 'No tienes acceso a la comunidad activa. Cambia de comunidad e intentalo de nuevo.';
    }
    return detail || 'No tienes permisos para realizar esta accion.';
  }

  if (status === 404) {
    return detail || 'No se encontro la incidencia solicitada.';
  }

  if (status === 400) {
    return detail || fallback;
  }

  return detail || getErrorMessage(error, fallback);
};
