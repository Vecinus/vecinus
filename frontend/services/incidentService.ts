import { Platform } from 'react-native';
import { API_URL } from '../constants/api';
import type { Incident, IncidentStatus } from '../data/mock-incidencias';

// --- TIPOS ---

type BackendIncident = {
  id: string;
  type?: string;
  description?: string | null;
  created_at?: string;
  image_url?: string | null;
  membership_id?: string;
  status?: string | [string, string?] | null;
  incident_states?: Array<{ status?: string; created_at?: string }>;
};

type IncidentUpload = {
  uri: string;
  name: string;
  mimeType?: string | null;
  file?: File; // En Expo Web, DocumentPicker puede retornar el File object
};

export interface IncidentContext {
  currentUserId: string | null;
  currentUserName: string;
  currentMembershipId: string | null;
  usersByMembershipId: Record<string, { userId: string; userName: string }>;
}

export interface IncidentHistoryEntry {
  status: IncidentStatus;
  date: string;
}

// --- CONSTANTES DE UI ---
// Solo dejamos este mapa para mostrar etiquetas bonitas en la interfaz, 
// pero la lógica usará las llaves en mayúsculas.
const BACK_TYPE_LABEL: Record<string, string> = {
  LIGHTING: 'Iluminación',
  ELECTRICITY: 'Electricidad',
  ELEVATOR: 'Ascensor',
  PLUMBING: 'Fontanería',
  SAFETY: 'Seguridad',
  WORKERS: 'Trabajadores',
  POOL: 'Piscina',
  OTHER: 'Otros',
};

const INCIDENTS_BASE_URL = `${API_URL}/incidents`;

const EMPTY_CONTEXT: IncidentContext = {
  currentUserId: null,
  currentUserName: 'Vecino',
  currentMembershipId: null,
  usersByMembershipId: {},
};

// --- HELPERS ---

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

const uploadHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

/**
 * Convierte el estado del backend al tipo IncidentStatus del frontend.
 * Backend usa STATUS_ALIASES para convertir valores.
 * Convierte IN_PROGRESS → IN PROGRESS, RESOLVED → SOLVED
 */
const parseStatus = (status: BackendIncident['status']): IncidentStatus => {
  const raw = Array.isArray(status) ? status[0] : status;
  const normalized = String(raw || '').toUpperCase();

  // Aseguramos que el valor sea uno de los permitidos por el tipo IncidentStatus
  // Backend puede enviar: PENDING, IN PROGRESS, SOLVED, DISCARDED
  // O también: IN_PROGRESS, RESOLVED (que convertimos)
  switch (normalized) {
    case 'IN PROGRESS':
    case 'IN_PROGRESS':
      return 'IN PROGRESS';
    case 'SOLVED':
    case 'RESOLVED':
      return 'SOLVED';
    case 'DISCARDED':
      return 'DISCARDED';
    case 'PENDING':
    default:
      return 'PENDING';
  }
};

const parseErrorDetail = async (response: Response): Promise<string> => {
  try {
    const data = await response.json();
    if (typeof data?.detail === 'string') {
      // Incluir el código de estado y el mensaje
      return `${response.status}:${data.detail}`;
    }
  } catch { /* ignore */ }
  return `${response.status}`;
};

const mapIncident = (
  item: BackendIncident,
  associationId: string,
  context: IncidentContext
): Incident => {
  const memberData = item.membership_id
    ? context.usersByMembershipId[item.membership_id]
    : undefined;

  // Calcular el status: si item.status es null, usar el último estado de incident_states
  let calculatedStatus = parseStatus(item.status);
  const states = Array.isArray(item.incident_states) ? item.incident_states : [];
  
  if (!item.status && states.length > 0) {
    // Obtener el último estado
    const lastState = states[states.length - 1];
    calculatedStatus = parseStatus(lastState.status);
  }

  const typeKey = String(item.type || 'OTHER').toUpperCase() as unknown as string;

  return {
    id: String(item.id),
    communityId: associationId,
    reporterId: memberData?.userId || item.membership_id || 'unknown-user',
    title: (BACK_TYPE_LABEL[typeKey as keyof typeof BACK_TYPE_LABEL]) || 'Incidencia',
    description: item.description || '',
    reporterName: memberData?.userName || 'Vecino',
    createdAt: item.created_at || new Date().toISOString(),
    status: calculatedStatus,
    type: typeKey,
    image: item.image_url || undefined,
  };
};

// --- FUNCIONES EXPORTADAS ---

async function requestIncidents(
  associationId: string,
  token: string,
  mine: boolean
): Promise<{ incidents: Incident[]; context: IncidentContext }> {
  // Validar que associationId sea seguro - solo alfanuméricos, guiones y guiones bajos
  if (!associationId || typeof associationId !== 'string' || associationId.length === 0) {
    throw new Error('Invalid association ID');
  }
  if (!/^[a-zA-Z0-9\-_]+$/.test(associationId)) {
    throw new Error('Invalid association ID format');
  }

  const url = new URL(`incidents/${associationId}`, INCIDENTS_BASE_URL);
  if (mine) {
    url.searchParams.append('mine', 'true');
  }

  // Validación de whitelist: asegurar que la URL pertenece al dominio permitido
  if (!url.toString().startsWith(INCIDENTS_BASE_URL)) {
    throw new Error('URL does not belong to allowed domain');
  }

  const incidentsResponse = await fetch(url, {
    method: 'GET',
    headers: authHeaders(token),
  });

  if (!incidentsResponse.ok) {
    throw new Error(await parseErrorDetail(incidentsResponse));
  }

  const rawIncidents = (await incidentsResponse.json()) as BackendIncident[];
  const context = EMPTY_CONTEXT; // Aquí podrías cargar datos reales del usuario si el API los diera

  const incidents = rawIncidents
    .map((item) => mapIncident(item, associationId, context))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return { incidents, context };
}

export const listIncidents = (associationId: string, token: string) => 
  requestIncidents(associationId, token, false);

export const listMyIncidents = (associationId: string, token: string) => 
  requestIncidents(associationId, token, true);

export const createIncident = async (params: {
  associationId: string;
  token: string;
  type: string;
  description: string;
  image?: IncidentUpload | null;
}): Promise<string> => {
  // Validar que associationId sea seguro - solo alfanuméricos, guiones y guiones bajos
  if (!params.associationId || typeof params.associationId !== 'string' || params.associationId.length === 0) {
    throw new Error('Invalid association ID');
  }
  if (!/^[a-zA-Z0-9\-_]+$/.test(params.associationId)) {
    throw new Error('Invalid association ID format');
  }

  const formData = new FormData();
  formData.append('type', params.type);
  formData.append('description', params.description);

  if (params.image) {
    try {
      // Prioridad 1: Si DocumentPicker retornó un File object (Expo Web)
      if (params.image.file instanceof File) {
        formData.append('file', params.image.file);
      } else if (params.image.uri) {
        // Prioridad 2: Para blob:// URLs en Expo Web, usar FileReader vía Blob
        if (params.image.uri.startsWith('blob:')) {
          const response = await fetch(params.image.uri).catch(() => null);
          
          if (response) {
            const blob = await response.blob();
            formData.append('file', blob, params.image.name);
          }
        } else {
          // URI local (mobile)
          formData.append('file', {
            uri: params.image.uri,
            name: params.image.name,
            type: params.image.mimeType || 'image/jpeg',
          } as unknown as Blob);
        }
      }
    } catch (error) {
      throw new Error(`404:Imagen no válida - ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  const url = new URL(params.associationId, INCIDENTS_BASE_URL);
  
  // Validación de whitelist: asegurar que la URL pertenece al dominio permitido
  if (!url.toString().startsWith(INCIDENTS_BASE_URL)) {
    throw new Error('URL does not belong to allowed domain');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: uploadHeaders(params.token),
    body: formData,
  });

  if (!response.ok) {
    const errorDetail = await parseErrorDetail(response);
    
    // Mejorar mensajes de error específicos
    if (response.status === 404) {
      throw new Error('404:Comunidad no encontrada o no tienes acceso');
    } else if (response.status === 500) {
      throw new Error('500:Error del servidor al procesar la incidencia');
    } else if (response.status === 403) {
      throw new Error(errorDetail);
    }
    
    throw new Error(errorDetail);
  }

  const data = (await response.json()) as { incident_id?: string };
  return data.incident_id || '';
};
/**
 * Convierte IncidentStatus del frontend a formato backend.
 * Backend espera exactamente: 'PENDING', 'IN PROGRESS', 'SOLVED', 'DISCARDED'
 */
const statusToBackendFormat = (status: IncidentStatus): string => {
  switch (status) {
    case 'IN PROGRESS':
      return 'IN PROGRESS'; // Con espacio, tal como espera el backend
    case 'SOLVED':
      return 'SOLVED';
    case 'DISCARDED':
      return 'DISCARDED';
    case 'PENDING':
    default:
      return 'PENDING';
  }
};

export const updateIncidentStatus = async (params: {
  associationId: string;
  incidentId: string;
  status: IncidentStatus; // Se espera 'IN PROGRESS', 'SOLVED', etc.
  token: string;
}): Promise<void> => {
  // Validar que associationId e incidentId sean seguros - solo alfanuméricos, guiones y guiones bajos
  if (!params.associationId || typeof params.associationId !== 'string' || params.associationId.length === 0) {
    throw new Error('Invalid association ID');
  }
  if (!/^[a-zA-Z0-9\-_]+$/.test(params.associationId)) {
    throw new Error('Invalid association ID format');
  }
  if (!params.incidentId || typeof params.incidentId !== 'string' || params.incidentId.length === 0) {
    throw new Error('Invalid incident ID');
  }
  if (!/^[a-zA-Z0-9\-_]+$/.test(params.incidentId)) {
    throw new Error('Invalid incident ID format');
  }

  const backendStatus = statusToBackendFormat(params.status);
  const url = new URL(`${params.associationId}/${params.incidentId}/status`, INCIDENTS_BASE_URL);
  url.searchParams.append('status', backendStatus);
  
  // Validación de whitelist: asegurar que la URL pertenece al dominio permitido
  if (!url.toString().startsWith(INCIDENTS_BASE_URL)) {
    throw new Error('URL does not belong to allowed domain');
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: uploadHeaders(params.token),
  });

  if (!response.ok) {
    throw new Error(await parseErrorDetail(response));
  }
};

export const getIncidentHistory = async (params: {
  associationId: string;
  incidentId: string;
  token: string;
}): Promise<IncidentHistoryEntry[]> => {
  // Validar que associationId e incidentId sean seguros - solo alfanuméricos, guiones y guiones bajos
  if (!params.associationId || typeof params.associationId !== 'string' || params.associationId.length === 0) {
    throw new Error('Invalid association ID');
  }
  if (!/^[a-zA-Z0-9\-_]+$/.test(params.associationId)) {
    throw new Error('Invalid association ID format');
  }
  if (!params.incidentId || typeof params.incidentId !== 'string' || params.incidentId.length === 0) {
    throw new Error('Invalid incident ID');
  }
  if (!/^[a-zA-Z0-9\-_]+$/.test(params.incidentId)) {
    throw new Error('Invalid incident ID format');
  }

  const url = new URL(`${params.associationId}/${params.incidentId}`, INCIDENTS_BASE_URL);
  
  // Validación de whitelist: asegurar que la URL pertenece al dominio permitido
  if (!url.toString().startsWith(INCIDENTS_BASE_URL)) {
    throw new Error('URL does not belong to allowed domain');
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: authHeaders(params.token),
  });

  if (!response.ok) {
    throw new Error(await parseErrorDetail(response));
  }

  const data = (await response.json()) as BackendIncident;
  const states = Array.isArray(data.incident_states) ? data.incident_states : [];

  if (states.length === 0) {
    return [{ 
      status: parseStatus(data.status), 
      date: data.created_at || new Date().toISOString() 
    }];
  }

  return states
    .map((state) => ({
      status: parseStatus(state.status || null),
      date: state.created_at || new Date().toISOString(),
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

export const getIncidentDetail = async (params: {
  associationId: string;
  incidentId: string;
  token: string;
}): Promise<{
  incident: Incident;
  history: IncidentHistoryEntry[];
}> => {
  // Validar que associationId e incidentId sean seguros - solo alfanuméricos, guiones y guiones bajos
  if (!params.associationId || typeof params.associationId !== 'string' || params.associationId.length === 0) {
    throw new Error('Invalid association ID');
  }
  if (!/^[a-zA-Z0-9\-_]+$/.test(params.associationId)) {
    throw new Error('Invalid association ID format');
  }
  if (!params.incidentId || typeof params.incidentId !== 'string' || params.incidentId.length === 0) {
    throw new Error('Invalid incident ID');
  }
  if (!/^[a-zA-Z0-9\-_]+$/.test(params.incidentId)) {
    throw new Error('Invalid incident ID format');
  }

  const urlObj = new URL(`${params.associationId}/${params.incidentId}`, INCIDENTS_BASE_URL);
  
  // Validación de whitelist: asegurar que la URL pertenece al dominio permitido
  if (!urlObj.toString().startsWith(INCIDENTS_BASE_URL)) {
    throw new Error('URL does not belong to allowed domain');
  }

  try {
    const response = await fetch(urlObj, {
      method: 'GET',
      headers: authHeaders(params.token),
    });

    if (!response.ok) {
      const errorDetail = await parseErrorDetail(response);
      throw new Error(errorDetail);
    }

    const data = (await response.json()) as BackendIncident;
    
    // Calcular el status: si data.status es null, usar el último estado de incident_states
    let calculatedStatus = parseStatus(data.status);
    const states = Array.isArray(data.incident_states) ? data.incident_states : [];
    
    if (!data.status && states.length > 0) {
      // Obtener el último estado
      const lastState = states[states.length - 1];
      calculatedStatus = parseStatus(lastState.status);
    }
    
    // Construir el objeto Incident
    const typeKey = String(data.type || 'OTHER').toUpperCase() as unknown as string;
    const incident: Incident = {
      id: String(data.id),
      communityId: params.associationId,
      reporterId: data.membership_id || 'unknown-user',
      title: (BACK_TYPE_LABEL[typeKey as keyof typeof BACK_TYPE_LABEL]) || 'Incidencia',
      description: data.description || '',
      reporterName: 'Vecino',
      createdAt: data.created_at || new Date().toISOString(),
      status: calculatedStatus,
      type: typeKey,
      image: data.image_url || undefined,
    };

    // Construir el historial
    const history: IncidentHistoryEntry[] = states.length === 0
      ? [{ status: calculatedStatus, date: data.created_at || new Date().toISOString() }]
      : states
          .map((state) => ({
            status: parseStatus(state.status || null),
            date: state.created_at || new Date().toISOString(),
          }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return { incident, history };
  } catch (error) {
    throw error;
  }
};