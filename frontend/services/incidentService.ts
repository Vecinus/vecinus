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
 * Como ahora son los mismos, solo normalizamos a mayúsculas y manejamos variaciones.
 */
const parseStatus = (status: BackendIncident['status']): IncidentStatus => {
  const raw = Array.isArray(status) ? status[0] : status;
  const normalized = String(raw || '').toUpperCase().replace('_', ' ');

  // Aseguramos que el valor sea uno de los permitidos por el tipo IncidentStatus
  switch (normalized) {
    case 'IN PROGRESS':
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
    if (typeof data?.detail === 'string') return data.detail;
  } catch { /* ignore */ }
  return `Error HTTP ${response.status}`;
};

const mapIncident = (
  item: BackendIncident,
  associationId: string,
  context: IncidentContext
): Incident => {
  const memberData = item.membership_id
    ? context.usersByMembershipId[item.membership_id]
    : undefined;

  const status = parseStatus(item.status);
  const typeKey = String(item.type || '').toUpperCase();

  return {
    id: String(item.id),
    communityId: associationId,
    reporterId: memberData?.userId || item.membership_id || 'unknown-user',
    title: BACK_TYPE_LABEL[typeKey] || 'Incidencia',
    description: item.description || '',
    reporterName: memberData?.userName || 'Vecino',
    createdAt: item.created_at || new Date().toISOString(),
    status, // Ya es un valor como 'PENDING'
  };
};

// --- FUNCIONES EXPORTADAS ---

async function requestIncidents(
  associationId: string,
  token: string,
  mine: boolean
): Promise<{ incidents: Incident[]; context: IncidentContext }> {
  const incidentsResponse = await fetch(
    `${INCIDENTS_BASE_URL}/${associationId}${mine ? '?mine=true' : ''}`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

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
  const formData = new FormData();
  formData.append('type', params.type);
  formData.append('description', params.description);

  if (params.image) {
    console.log('📸 Procesando imagen:', params.image.name);
    
    try {
      // Prioridad 1: Si DocumentPicker retornó un File object (Expo Web)
      if (params.image.file instanceof File) {
        console.log('✅ Usando File object directo');
        formData.append('file', params.image.file);
      } else if (params.image.uri) {
        // Prioridad 2: Para blob:// URLs en Expo Web, usar FileReader vía Blob
        // Crear un img temporal para cargar el blob y extraer datos
        if (params.image.uri.startsWith('blob:')) {
          console.log('🔄 Convirtiendo blob:// URL a Blob');
          const response = await fetch(params.image.uri).catch(err => {
            console.warn('⚠️ CORS issue con blob, enviando como fallback', err);
            return null;
          });
          
          if (response) {
            const blob = await response.blob();
            formData.append('file', blob, params.image.name);
            console.log('✅ Blob convertido exitosamente');
          } else {
            console.warn('⚠️ No se pudo acceder al blob, ignorando imagen');
          }
        } else {
          // URI local (mobile)
          formData.append('file', {
            uri: params.image.uri,
            name: params.image.name,
            type: params.image.mimeType || 'image/jpeg',
          } as any);
        }
      }
    } catch (error) {
      console.error('❌ Error procesando imagen:', error);
      // Continúa sin imagen si falla
    }
  }

  const response = await fetch(`${INCIDENTS_BASE_URL}/${params.associationId}`, {
    method: 'POST',
    headers: uploadHeaders(params.token),
    body: formData,
  });

  if (!response.ok) {
    const errorDetail = await parseErrorDetail(response);
    console.error('❌ Error en createIncident:', errorDetail);
    throw new Error(errorDetail);
  }

  const data = (await response.json()) as { incident_id?: string };
  console.log('✅ Incidencia creada:', data.incident_id);
  return data.incident_id || '';
};
export const updateIncidentStatus = async (params: {
  associationId: string;
  incidentId: string;
  status: IncidentStatus; // Se espera 'IN PROGRESS', 'SOLVED', etc.
  token: string;
}): Promise<void> => {
  const response = await fetch(
    `${INCIDENTS_BASE_URL}/${params.associationId}/${params.incidentId}/status?status=${encodeURIComponent(params.status)}`,
    {
      method: 'POST',
      headers: authHeaders(params.token),
    }
  );

  if (!response.ok) {
    throw new Error(await parseErrorDetail(response));
  }
};

export const getIncidentHistory = async (params: {
  associationId: string;
  incidentId: string;
  token: string;
}): Promise<IncidentHistoryEntry[]> => {
  const response = await fetch(`${INCIDENTS_BASE_URL}/${params.associationId}/${params.incidentId}`, {
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
  const response = await fetch(`${INCIDENTS_BASE_URL}/${params.associationId}/${params.incidentId}`, {
    method: 'GET',
    headers: authHeaders(params.token),
  });

  if (!response.ok) {
    throw new Error(await parseErrorDetail(response));
  }

  const data = (await response.json()) as BackendIncident;
  
  // Construir el objeto Incident
  const incident: Incident = {
    id: String(data.id),
    communityId: params.associationId,
    reporterId: data.membership_id || 'unknown-user',
    title: BACK_TYPE_LABEL[String(data.type || '').toUpperCase()] || 'Incidencia',
    description: data.description || '',
    reporterName: 'Vecino',
    createdAt: data.created_at || new Date().toISOString(),
    status: parseStatus(data.status),
    image_url: data.image_url || undefined,
  };

  // Construir el historial
  const states = Array.isArray(data.incident_states) ? data.incident_states : [];
  const history: IncidentHistoryEntry[] = states.length === 0
    ? [{ status: parseStatus(data.status), date: data.created_at || new Date().toISOString() }]
    : states
        .map((state) => ({
          status: parseStatus(state.status || null),
          date: state.created_at || new Date().toISOString(),
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return { incident, history };
};