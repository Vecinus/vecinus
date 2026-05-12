import {
  AlertTriangle,
  ArrowUp,
  CheckCircle2,
  Clock3,
  Droplet,
  HelpCircle,
  Lightbulb,
  Shield,
  Users,
  Waves,
  XCircle,
  Zap,
} from 'lucide-react-native';
import { type ComponentType } from 'react';
import { type IncidentStatus, type IncidentType } from '@/api/incidents';

type IconComponent = ComponentType<{ size?: number; color?: string }>;

export type StatusTone = { text: string; bg: string; border: string };

export const STATUS_TONE: Record<IncidentStatus, StatusTone> = {
  PENDING: { text: '#B54708', bg: '#FEF9C3', border: '#FDE68A' },
  'IN PROGRESS': { text: '#B54708', bg: '#FEF0C7', border: '#FEDF89' },
  SOLVED: { text: '#067647', bg: '#D1FADF', border: '#A6F4C5' },
  DISCARDED: { text: '#991B1B', bg: '#FEE2E2', border: '#FECACA' },
};

export const STATUS_ICON: Record<IncidentStatus, IconComponent> = {
  PENDING: AlertTriangle,
  'IN PROGRESS': Clock3,
  SOLVED: CheckCircle2,
  DISCARDED: XCircle,
};

export const TYPE_META: Record<IncidentType, { icon: IconComponent; color: string; bg: string }> = {
  LIGHTING: { icon: Lightbulb, color: '#B54708', bg: '#FFF7ED' },
  ELECTRICITY: { icon: Zap, color: '#EA580C', bg: '#FFF7ED' },
  ELEVATOR: { icon: ArrowUp, color: '#1D4ED8', bg: '#EFF6FF' },
  PLUMBING: { icon: Droplet, color: '#0E7490', bg: '#ECFEFF' },
  SAFETY: { icon: Shield, color: '#B91C1C', bg: '#FEF2F2' },
  WORKERS: { icon: Users, color: '#6D28D9', bg: '#F5F3FF' },
  POOL: { icon: Waves, color: '#0369A1', bg: '#F0F9FF' },
  OTHER: { icon: HelpCircle, color: '#64748B', bg: '#F8FAFC' },
};

export const formatDate = (isoDate: string) => {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
};

export const formatDateTime = (isoDate: string) => {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
};

export const getAllowedStatusTransitions = (currentStatus: IncidentStatus): IncidentStatus[] => {
  switch (currentStatus) {
    case 'PENDING':
      return ['IN PROGRESS', 'DISCARDED'];
    case 'IN PROGRESS':
      return ['SOLVED', 'DISCARDED'];
    default:
      return [];
  }
};
