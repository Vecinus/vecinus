import { CustomAlertDialog, AlertConfig, DetailItem } from '@/components/custom-alert';

import React, { useState, useEffect } from 'react';
import { View, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { Calendar as CalendarIcon, ChevronLeft, Clock, Users } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

import { useAuth } from '@/context/AuthContext';
import { bookingApi } from '@/api/booking';
import { guestPassApi } from '@/api/guestPass';

export default function DetalleReservaOPase() {
  const router = useRouter();
  const navigation = useNavigation();
  const { id, type } = useLocalSearchParams<{ id: string; type: 'reservation' | 'guest_pass' }>();
  const { activeCommunity } = useAuth();
  const associationId = activeCommunity ? activeCommunity.id : '';

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => router.push(`/${associationId}/mis-reservas`)}
          className="ml-2 mr-4 p-1"
        >
          <ChevronLeft size={26} className="text-foreground" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, router, associationId]);

  const [item, setItem] = useState<DetailItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    visible: false,
    title: '',
    message: '',
    type: 'confirm',
  });

  useEffect(() => {
    const fetchDetail = async () => {
      if (!associationId || !id || !type) return;
      try {
        setIsLoading(true);
        if (type === 'reservation') {
          const reservations = await bookingApi.listReservations(associationId);
          const found = reservations.find(r => r.id.toString() === id);
          if (found) {
            setItem({
              id: found.id,
              type: 'reservation',
              spaceName: found.space_name,
              startDate: found.start_at,
              endDate: found.end_at,
              statusId: found.status_id,
              qrToken: found.qr_token,
              guestsCount: found.guests_count,
            });
          }
        } else {
          const passes = await guestPassApi.listGuestPasses(associationId);
          const found = passes.find(p => p.id.toString() === id);
          if (found) {
            setItem({
              id: found.id,
              type: 'guest_pass',
              spaceName: found.space_name,
              startDate: found.valid_for_date,
              statusId: found.status_id,
              qrToken: found.qr_token,
            });
          }
        }
      } catch {
        setAlertConfig({
          visible: true,
          title: 'Error',
          message: 'No se pudo cargar la información.',
          type: 'error',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [associationId, id, type]);

  const handleCancelPress = () => {
    if (!item) return;
    setAlertConfig({
      visible: true,
      title: 'Cancelar',
      message: `¿Estás seguro de que deseas cancelar este ${item.type === 'reservation' ? 'reserva' : 'pase'}?`,
      type: 'confirm',
    });
  };

  const processCancel = async () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
    if (!item) return;
    try {
      if (item.type === 'reservation') {
        await bookingApi.cancelReservation(item.id);
      } else {
        await guestPassApi.cancelGuestPass(item.id);
      }
      setTimeout(() => {
        setAlertConfig({
          visible: true,
          title: 'Éxito',
          message: 'Cancelado correctamente.',
          type: 'success',
        });
      }, 300);
    } catch {
      setTimeout(() => {
        setAlertConfig({
          visible: true,
          title: 'Error',
          message: 'Hubo un problema al cancelar.',
          type: 'error',
        });
      }, 300);
    }
  };

  const handleAlertAcknowledge = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
    if (alertConfig.type === 'success') {
      router.push(`/${activeCommunity?.id}/mis-reservas`);
    }
  };

  const handleAlertCancel = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('es-ES', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('es-ES', {
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" className="text-primary" />
        <Text className="text-muted-foreground mt-4">Cargando detalles...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-5">
        <Text className="text-lg font-bold text-destructive mb-2">No encontrado</Text>
        <Text className="text-muted-foreground text-center mb-6">
          No pudimos encontrar los detalles de este elemento.
        </Text>
        <Button onPress={() => router.push(`/${activeCommunity?.id}/mis-reservas`)}>
          <Text>Volver atrás</Text>
        </Button>
      </View>
    );
  }

  const isActive = item.statusId === 1;

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerClassName="p-5 pb-10">
        <View className="flex-row justify-between items-start mb-6">
          <View>
            <Text className="text-3xl font-bold text-foreground mb-2">
              {item.type === 'reservation' ? 'Tu Reserva' : 'Pase de Invitado'}
            </Text>
            <Badge variant={isActive ? 'default' : 'destructive'}>
              <Text>{isActive ? 'Activo y Válido' : 'Inactivo / Cancelado'}</Text>
            </Badge>
          </View>
        </View>

        <Card className="mb-6 border-border">
          <CardHeader className="items-center bg-secondary/20 pb-8 pt-8 rounded-t-xl">
            <View className="bg-white p-4 rounded-xl shadow-sm border border-border">
              <QRCode
                value={item.qrToken || 'N/A'}
                size={180}
                color={isActive ? '#000000' : '#cccccc'}
                quietZone={10}
              />
            </View>
            <Text className="text-sm text-muted-foreground mt-4 font-mono">
              {item.qrToken}
            </Text>
          </CardHeader>

          <CardContent className="pt-6">
            <CardTitle className="text-2xl text-center mb-6">{item.spaceName}</CardTitle>
            <View className="space-y-4">
              <View className="flex-row items-center gap-3">
                <View className="bg-primary/10 p-2 rounded-full">
                  <CalendarIcon size={20} className="text-primary" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm text-muted-foreground">Fecha</Text>
                  <Text className="text-base font-medium capitalize">
                    {formatDate(item.startDate)}
                  </Text>
                </View>
              </View>

              <Separator className="bg-border" />

              {item.type === 'reservation' && item.endDate ? (
                <>
                  <View className="flex-row items-center gap-3">
                    <View className="bg-primary/10 p-2 rounded-full">
                      <Clock size={20} className="text-primary" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm text-muted-foreground">Horario</Text>
                      <Text className="text-base font-medium">
                        {formatTime(item.startDate)} - {formatTime(item.endDate)}
                      </Text>
                    </View>
                  </View>
                  <Separator className="bg-border" />
                </>
              ) : null}

              {item.guestsCount !== undefined ? (
                <View className="flex-row items-center gap-3">
                  <View className="bg-primary/10 p-2 rounded-full">
                    <Users size={20} className="text-primary" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm text-muted-foreground">Invitados permitidos</Text>
                    <Text className="text-base font-medium">{item.guestsCount}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          </CardContent>

          <CardFooter className="flex-col gap-3 pt-6 border-t border-border">
            {isActive ? (
              <Button variant="destructive" className="w-full" onPress={handleCancelPress}>
                <Text>Cancelar {item.type === 'reservation' ? 'Reserva' : 'Pase'}</Text>
              </Button>
            ) : null}
            <Button variant="outline" className="w-full" onPress={() => router.back()}>
              <Text>Volver a la lista</Text>
            </Button>
          </CardFooter>
        </Card>
      </ScrollView>

      <CustomAlertDialog
        config={alertConfig}
        onConfirm={processCancel}
        onCancel={handleAlertCancel}
        onAcknowledge={handleAlertAcknowledge}
      />
    </View>
  );
}
