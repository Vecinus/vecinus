import { apiClient } from './client';

export const INCIDENT_TYPES = {
  LIGHTING: 'LIGHTING',
  ELECTRICITY: 'ELECTRICITY',
  ELEVATOR: 'ELEVATOR',
  PLUMBING: 'PLUMBING',
  SAFETY: 'SAFETY',
  WORKERS: 'WORKERS',
  POOL: 'POOL',
  OTHER: 'OTHER',
} as const;

export type IncidentType = (typeof INCIDENT_TYPES)[keyof typeof INCIDENT_TYPES];

export const INCIDENT_STATUSES = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN PROGRESS',
  SOLVED: 'SOLVED',
  DISCARDED: 'DISCARDED',
} as const;

export type IncidentStatus = (typeof INCIDENT_STATUSES)[keyof typeof INCIDENT_STATUSES];

export const INCIDENT_TYPE_LABEL: Record<IncidentType, string> = {
  LIGHTING: 'Iluminacion',
  ELECTRICITY: 'Electricidad',
  ELEVATOR: 'Ascensor',
  PLUMBING: 'Fontaneria',
  SAFETY: 'Seguridad',
  WORKERS: 'Trabajadores',
  POOL: 'Piscina',
  OTHER: 'Otros',
};

export const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  PENDING: 'Pendiente',
  'IN PROGRESS': 'En proceso',
  SOLVED: 'Resuelta',
  DISCARDED: 'Rechazada',
};

type BackendIncidentState = {
  status?: string | null;
  created_at?: string | null;
};

type BackendProfile = {
  username?: string | null;
};

type BackendMembership = {
  profile_id?: string | null;
  role?: string | number | null;
  profiles?: BackendProfile | BackendProfile[] | null;
};

type BackendIncident = {
  id: string;
  type?: string | null;
  description?: string | null;
  created_at?: string | null;
  image_url?: string | null;
  membership_id?: string | null;
  status?: string | null;
  reporter_name?: string | null;
  reporter_profile_id?: string | null;
  memberships?: BackendMembership | BackendMembership[] | null;
  incident_states?: BackendIncidentState[];
};

export interface Incident {
  id: string;
  type: IncidentType;
  description: string;
  createdAt: string;
  imageUrl?: string;
  membershipId?: string;
  status: IncidentStatus;
  reporterName: string;
}

export interface IncidentHistoryEntry {
  status: IncidentStatus;
  date: string;
}

export interface IncidentDetail {
  incident: Incident;
  history: IncidentHistoryEntry[];
}

export interface IncidentUploadAsset {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
  file?: unknown;
}

export interface CreateIncidentPayload {
  type: IncidentType;
  description: string;
  image?: IncidentUploadAsset | null;
}

const TYPE_SET = new Set(Object.values(INCIDENT_TYPES));

const parseIncidentType = (value?: string | null): IncidentType => {
  const normalized = String(value ?? '').toUpperCase().trim();
  if (TYPE_SET.has(normalized as IncidentType)) {
    return normalized as IncidentType;
  }
  return INCIDENT_TYPES.OTHER;
};

const parseIncidentStatus = (value?: string | null): IncidentStatus => {
  const normalized = String(value ?? '')
    .toUpperCase()
    .replace(/_/g, ' ')
    .trim();

  switch (normalized) {
    case INCIDENT_STATUSES.PENDING:
      return INCIDENT_STATUSES.PENDING;
    case INCIDENT_STATUSES.IN_PROGRESS:
      return INCIDENT_STATUSES.IN_PROGRESS;
    case INCIDENT_STATUSES.SOLVED:
    case 'RESOLVED':
      return INCIDENT_STATUSES.SOLVED;
    case INCIDENT_STATUSES.DISCARDED:
      return INCIDENT_STATUSES.DISCARDED;
    default:
      return INCIDENT_STATUSES.PENDING;
  }
};

const getMembership = (item: BackendIncident): BackendMembership | null => {
  if (!item.memberships) return null;

  if (Array.isArray(item.memberships)) {
    return item.memberships[0] ?? null;
  }

  return item.memberships;
};

const getReporterName = (item: BackendIncident): string => {
  const reporterNameFromField = item.reporter_name?.trim();
  if (reporterNameFromField) return reporterNameFromField;

  const membership = getMembership(item);
  if (!membership) return 'Vecino';

  const profileRaw = membership.profiles;
  const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
  const username = profile?.username?.trim();

  return username || 'Vecino';
};

const mapIncident = (item: BackendIncident): Incident => {
  const latestStateStatus =
    Array.isArray(item.incident_states) && item.incident_states.length > 0
      ? item.incident_states[0]?.status
      : undefined;
  const status = parseIncidentStatus(item.status ?? latestStateStatus);

  return {
    id: String(item.id),
    type: parseIncidentType(item.type),
    description: item.description ?? '',
    createdAt: item.created_at ?? new Date().toISOString(),
    imageUrl: item.image_url ?? undefined,
    membershipId: item.membership_id ?? undefined,
    status,
    reporterName: getReporterName(item),
  };
};

const mapHistory = (item: BackendIncident, fallbackStatus: IncidentStatus): IncidentHistoryEntry[] => {
  const states = Array.isArray(item.incident_states) ? item.incident_states : [];

  if (states.length === 0) {
    return [
      {
        status: fallbackStatus,
        date: item.created_at ?? new Date().toISOString(),
      },
    ];
  }

  return states
    .map((state) => ({
      status: parseIncidentStatus(state.status),
      date: state.created_at ?? new Date().toISOString(),
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

const safeId = (value: string) => encodeURIComponent(value);

export const incidentsApi = {
  listIncidents: async (associationId: string, mine = false): Promise<Incident[]> => {
    const { data } = await apiClient.get<BackendIncident[]>(`/incidents/${safeId(associationId)}`, {
      params: mine ? { mine: true } : undefined,
    });

    const incidents = Array.isArray(data) ? data.map(mapIncident) : [];
    return incidents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getIncidentDetail: async (associationId: string, incidentId: string): Promise<IncidentDetail> => {
    const { data } = await apiClient.get<BackendIncident>(
      `/incidents/${safeId(associationId)}/${safeId(incidentId)}`
    );

    const incident = mapIncident(data);
    const history = mapHistory(data, incident.status);

    return { incident, history };
  },

  createIncident: async (associationId: string, payload: CreateIncidentPayload): Promise<{ incidentId?: string }> => {
    const formData = new FormData();
    formData.append('type', payload.type);
    formData.append('description', payload.description);

    if (payload.image) {
      const imageName = payload.image.name || 'incidencia.jpg';
      const mimeType = payload.image.mimeType || 'image/jpeg';
      const maybeFile = payload.image.file;

      if (typeof Blob !== 'undefined' && maybeFile instanceof Blob) {
        formData.append('file', maybeFile, imageName);
      } else {
        formData.append('file', {
          uri: payload.image.uri,
          name: imageName,
          type: mimeType,
        } as any);
      }
    }

    const { data } = await apiClient.post(`/incidents/${safeId(associationId)}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return {
      incidentId: data?.incident_id,
    };
  },

  updateIncidentStatus: async (associationId: string, incidentId: string, status: IncidentStatus): Promise<void> => {
    await apiClient.post(`/incidents/${safeId(associationId)}/${safeId(incidentId)}/status`, undefined, {
      params: { status },
    });
  },

  discardIncident: async (associationId: string, incidentId: string): Promise<void> => {
    await apiClient.delete(`/incidents/${safeId(associationId)}/${safeId(incidentId)}`);
  },
};
