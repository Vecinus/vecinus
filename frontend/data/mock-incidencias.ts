// Enums hardcoded from backend (WORKING VERSION)
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

export type IncidentType = typeof INCIDENT_TYPES[keyof typeof INCIDENT_TYPES];

// Status enum with SPACES (as backend accepts)
export const INCIDENT_STATUSES = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN PROGRESS',
  SOLVED: 'SOLVED',
  DISCARDED: 'DISCARDED',
} as const;

export type IncidentStatus = typeof INCIDENT_STATUSES[keyof typeof INCIDENT_STATUSES];

export interface Incident {
  id: string;
  communityId: string;
  reporterId: string;
  title: string;
  description: string;
  reporterName: string;
  createdAt: string;
  status: IncidentStatus;
  image?: string;
}

export const INCIDENT_TYPE_LABEL: Record<IncidentType, string> = {
  LIGHTING: 'Iluminación',
  ELECTRICITY: 'Electricidad',
  ELEVATOR: 'Ascensor',
  PLUMBING: 'Fontanería',
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

export const MOCK_INCIDENCIAS: Incident[] = [
  {
    id: 'inc-001',
    communityId: '6aa60a59-0135-4747-870d-c65e79326e13',
    reporterId: 'user-001',
    title: 'Ascensor bloque A',
    description:
      'Hace un ruido metalico entre plantas y se detiene durante unos segundos antes de abrir puertas.',
    reporterName: 'Miguel Sanchez',
    createdAt: '2026-03-14T11:30:00.000Z',
    status: 'IN PROGRESS',
  },
  {
    id: 'inc-002',
    communityId: '6aa60a59-0135-4747-870d-c65e79326e13',
    reporterId: 'user-002',
    title: 'Fuga en garaje',
    description:
      'Hay filtracion de agua en la zona de plazas 21 a 27 cuando llueve con intensidad.',
    reporterName: 'Lucia Ramos',
    createdAt: '2026-03-12T08:15:00.000Z',
    status: 'PENDING',
  },
  {
    id: 'inc-003',
    communityId: '6aa60a59-0135-4747-870d-c65e79326e13',
    reporterId: 'user-003',
    title: 'Luminaria portal 2',
    description:
      'La luz del portal 2 parpadea por la noche y reduce la visibilidad en la entrada.',
    reporterName: 'Carlos Gomez',
    createdAt: '2026-03-10T19:40:00.000Z',
    status: 'SOLVED',
  },
  {
    id: 'inc-004',
    communityId: '6aa60a59-0135-4747-870d-c65e79326e13',
    reporterId: 'user-004',
    title: 'Puerta acceso peatonal',
    description:
      'La cerradura del acceso peatonal no encaja correctamente y queda abierta.',
    reporterName: 'Sofia Martin',
    createdAt: '2026-03-11T09:00:00.000Z',
    status: 'PENDING',
  },
  {
    id: 'inc-005',
    communityId: '6aa60a59-0135-4747-870d-c65e79326e13',
    reporterId: 'user-001',
    title: 'Zona de trasteros',
    description:
      'Se solicita revisar cierre de trasteros. La incidencia anterior se marco como no procedente.',
    reporterName: 'Miguel Sanchez',
    createdAt: '2026-03-09T16:20:00.000Z',
    status: 'DISCARDED',
  },
];
