import * as React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldAlert } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/context/AuthContext';
import type { CommunityBlockedDetail } from '@/types/payments.types';

const ADMIN_ROLE = 1;
const PRESIDENT_ROLE = 4;

type Props = {
  detail: CommunityBlockedDetail | null;
  onClose: () => void;
};

function formatSince(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

export function CommunityBlockedModal({ detail, onClose }: Props) {
  const { user } = useAuth();
  const router = useRouter();

  const visible = detail !== null;

  const membership = React.useMemo(() => {
    if (!user || !detail) return null;
    return user.CommunitiesAndRole.find(
      (entry) => entry.community.id === detail.association_id,
    ) ?? null;
  }, [user, detail]);

  const roleId = membership ? Number(membership.role) : null;
  const isAdmin = roleId === ADMIN_ROLE;
  const isPresident = roleId === PRESIDENT_ROLE;
  const canManage = isAdmin || isPresident;

  const title = detail?.code === 'community_no_subscription'
    ? 'Sin suscripción activa'
    : 'Comunidad bloqueada por impago';

  const message = detail?.message
    ?? 'No es posible operar en esta comunidad hasta que se regularice el pago de la suscripción.';

  const since = formatSince(detail?.since);
  const communityName = membership?.community.name;

  const handleOpenAdmin = React.useCallback(() => {
    if (!detail) return;
    onClose();

    router.push((`/${detail.association_id}/subscription`) as never);
  }, [detail, onClose, router]);


  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) onClose();
    },
    [onClose],
  );

  return (
    <Dialog open={visible} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <View className="mb-3 size-14 items-center justify-center rounded-full bg-destructive/10">
            <Icon as={ShieldAlert} size={28} className="text-destructive" />
          </View>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {communityName
              ? `${message} (Comunidad: ${communityName})`
              : message}
          </DialogDescription>
        </DialogHeader>

        {since ? (
          <View className="rounded-md bg-muted/50 px-3 py-2">
            <Text className="text-xs text-muted-foreground">
              Desde: <Text className="text-xs font-medium text-foreground">{since}</Text>
            </Text>
          </View>
        ) : null}

        {!canManage ? (
          <Text className="text-sm text-muted-foreground">
            Avisa al administrador de la comunidad para que regularice la suscripción
            desde el panel de pagos.
          </Text>
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onPress={onClose}>
            <Text>Entendido</Text>
          </Button>

          {canManage ? (
            <Button onPress={handleOpenAdmin}>
              <Text className="text-primary-foreground font-semibold">
                {isAdmin ? 'Abrir panel de administración' : 'Ver estado de la suscripción'}
              </Text>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
