import React, { useState, useCallback, useEffect } from 'react';
import { View, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { bookingApi } from '@/api/booking';
import { guestPassApi } from '@/api/guestPass';
import { useRouter, useNavigation } from 'expo-router';
import { AlertConfig, CustomAlertDialog, UnifiedBookingItem } from '@/components/custom-alert';
import { ChevronLeft } from 'lucide-react-native';




export default function MisReservas() {
  const router = useRouter();
  const navigation = useNavigation();
  const { activeCommunity } = useAuth();
  const associationId = activeCommunity ? activeCommunity.id : '';

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => router.push(`/${associationId}/booking`)}
          className="ml-2 mr-4 p-1"
        >
          <ChevronLeft size={26} className="text-foreground" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, router, associationId]);

  const [items, setItems] = useState<UnifiedBookingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [alertConfig, setAlertConfig] = useState<AlertConfig & { targetItem?: UnifiedBookingItem }>({
    visible: false,
    title: '',
    message: '',
    type: 'confirm',
  });

  const fetchData = useCallback(async (silent = false) => {
    if (!associationId) return;
    if (!silent) setIsLoading(true);
    try {
      const [reservations, guestPasses] = await Promise.all([
        bookingApi.listReservations(associationId),
        guestPassApi.listGuestPasses(associationId),
      ]);

      const mappedReservations: UnifiedBookingItem[] = reservations.map((r: any) => ({
        uniqueId: `res_${r.id}`,
        realId: r.id,
        type: 'reservation',
        spaceName: r.space_name,
        startDate: r.start_at,
        endDate: r.end_at,
        statusId: r.status_id,
        requiresQr: r.requires_qr,
      }));

      const mappedGuestPasses: UnifiedBookingItem[] = guestPasses.map((gp: any) => ({
        uniqueId: `gp_${gp.id}`,
        realId: gp.id,
        type: 'guest_pass',
        spaceName: gp.space_name,
        startDate: gp.valid_for_date,
        statusId: gp.status_id,
        requiresQr: gp.requires_qr,
      }));

      const combined = [...mappedReservations, ...mappedGuestPasses];
      combined.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
      setItems(combined);
    } catch {
      setAlertConfig({
        visible: true,
        title: 'Error',
        message: 'No se pudieron cargar tus reservas.',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [associationId]);

  useFocusEffect(
    useCallback(() => {
      void fetchData();
    }, [fetchData])
  );

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    void fetchData(true);
  }, [fetchData]);

  const handleCancelPress = (item: UnifiedBookingItem) => {
    setAlertConfig({
      visible: true,
      title: 'Cancelar',
      message: `¿Estás seguro de que deseas cancelar ${item.type === 'reservation' ? 'esta reserva' : 'este pase'} de "${item.spaceName}"?`,
      type: 'confirm',
      targetItem: item,
    });
  };

  const processCancel = async () => {
    const item = alertConfig.targetItem;
    setAlertConfig(prev => ({ ...prev, visible: false }));
    if (!item) return;

    setCancellingId(item.uniqueId);
    try {
      if (item.type === 'reservation') {
        await bookingApi.cancelReservation(item.realId);
      } else {
        await guestPassApi.cancelGuestPass(item.realId);
      }
      await fetchData(true);
      setTimeout(() => {
        setAlertConfig({
          visible: true,
          title: 'Cancelado',
          message: 'Se ha cancelado correctamente.',
          type: 'success',
        });
      }, 300);
    } catch {
      setTimeout(() => {
        setAlertConfig({
          visible: true,
          title: 'Error',
          message: 'Hubo un problema al cancelar. Inténtalo de nuevo.',
          type: 'error',
        });
      }, 300);
    } finally {
      setCancellingId(null);
    }
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('es-ES', {
      hour: '2-digit', minute: '2-digit',
    });
  };

  const activeItems = items.filter(i => i.statusId === 1);
  const pastItems = items.filter(i => i.statusId !== 1);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background p-5 gap-4">
        {[1, 2, 3].map(i => (
          <View key={i} className="bg-muted rounded-2xl h-36" />
        ))}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="p-5 pb-10"
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        {items.length === 0 ? (
          <View className="flex-1 items-center justify-center py-24 px-8">
            <Text className="text-xl font-bold text-foreground mb-2 text-center">
              Sin reservas ni pases
            </Text>
            <Text className="text-muted-foreground text-center">
              Cuando hagas una reserva o tengas un pase de invitado, aparecerá aquí.
            </Text>
          </View>
        ) : (
          <View className="gap-6">
            {activeItems.length > 0 && (
              <View className="gap-3">
                <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
                  Activas ({activeItems.length})
                </Text>
                {activeItems.map(item => (
                  <BookingCard
                    key={item.uniqueId}
                    item={item}
                    isCancelling={cancellingId === item.uniqueId}
                    onCancel={() => handleCancelPress(item)}
                    onViewQr={() => router.push(`/${associationId}/mis-reservas/${item.realId}?type=${item.type}`)}
                    formatDate={formatDate}
                    formatTime={formatTime}
                  />
                ))}
              </View>
            )}

            {pastItems.length > 0 && (
              <View className="gap-3">
                <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
                  Historial ({pastItems.length})
                </Text>
                {pastItems.map(item => (
                  <BookingCard
                    key={item.uniqueId}
                    item={item}
                    isCancelling={false}
                    onCancel={() => handleCancelPress(item)}
                    onViewQr={() => router.push(`/${associationId}/mis-reservas/${item.realId}?type=${item.type}`)}
                    formatDate={formatDate}
                    formatTime={formatTime}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <CustomAlertDialog
        config={alertConfig}
        onConfirm={processCancel}
        onCancel={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
        onAcknowledge={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

function BookingCard({
  item,
  isCancelling,
  onCancel,
  onViewQr,
  formatDate,
  formatTime,
}: {
  item: UnifiedBookingItem;
  isCancelling: boolean;
  onCancel: () => void;
  onViewQr: () => void;
  formatDate: (s: string) => string;
  formatTime: (s: string) => string;
}) {
  const isActive = item.statusId === 1;
  const isReservation = item.type === 'reservation';

  return (
    <Card className={`border-border overflow-hidden ${!isActive ? 'opacity-60' : ''}`}>
      <View className={`h-1 w-full ${isReservation ? 'bg-primary' : 'bg-violet-500'}`} />

      <CardHeader className="pb-2 pt-4">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1 gap-1">
            <Badge variant={isReservation ? 'default' : 'secondary'} className="self-start">
              <Text className="text-xs">
                {isReservation ? 'Reserva' : 'Pase Invitado'}
              </Text>
            </Badge>
            <CardTitle className="text-lg leading-tight">{item.spaceName}</CardTitle>
          </View>

          <Badge variant={isActive ? 'outline' : 'secondary'} className={isActive ? 'border-green-500' : ''}>
            <Text className={`text-xs ${isActive ? 'text-green-600' : 'text-muted-foreground'}`}>
              {isActive ? '● Activo' : 'Inactivo'}
            </Text>
          </Badge>
        </View>
      </CardHeader>

      <CardContent className="pb-3 gap-1">
        <Text className="text-sm text-muted-foreground">
          📅 {formatDate(item.startDate)}
        </Text>
        {isReservation && item.endDate && (
          <Text className="text-sm text-muted-foreground">
            🕒 {formatTime(item.startDate)} – {formatTime(item.endDate)}
          </Text>
        )}
      </CardContent>

      {isActive && (
        <CardFooter className="flex-row justify-end gap-2 pt-3 border-t border-border">
          <Button variant="ghost" size="sm" onPress={onCancel} disabled={isCancelling}>
            <Text className="text-destructive text-sm">
              {isCancelling ? 'Cancelando...' : 'Cancelar'}
            </Text>
          </Button>
          {item.requiresQr && (
            <Button variant="default" size="sm" onPress={onViewQr}>
              <Text className="text-primary-foreground text-sm">Ver QR</Text>
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
