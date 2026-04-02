import { useState, useEffect } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CustomAlertDialog, AlertConfig } from '@/components/custom-alert';
import { CommonSpace } from '@/api/commonSpace';

export default function ZoneForm({
  initialData,
  onSubmit,
  onCancel,
}: {
  initialData: CommonSpace;
  onSubmit: (data: any) => Promise<void> | void;
  onCancel: () => void;
}) {
  const defaultName = initialData.name ?? '';
  const defaultStartTime = initialData.start_time?.substring(0, 5) ?? '09:00';
  const defaultEndTime = initialData.end_time?.substring(0, 5) ?? '21:00';
  const defaultRequiresQr = Boolean(initialData.requires_qr);
  const defaultCapacity = String(initialData.max_capacity ?? '1');
  const defaultUsageMode = (initialData as any).usage_mode ?? 'exclusive_reservation';
  const defaultMaxGuests = String((initialData as any).max_guests_per_reservation ?? '1');

  const [name, setName] = useState(defaultName);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);
  const [requiresQr, setRequiresQr] = useState(defaultRequiresQr);
  const [capacity, setCapacity] = useState(defaultCapacity);
  const [usageMode, setUsageMode] = useState<'exclusive_reservation' | 'guest_pass'>(
    defaultUsageMode
  );
  const [maxGuests, setMaxGuests] = useState(defaultMaxGuests);
  const [saving, setSaving] = useState(false);
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    visible: false,
    title: '',
    message: '',
    type: 'confirm',
  });

  useEffect(() => {
    setName(defaultName);
    setStartTime(defaultStartTime);
    setEndTime(defaultEndTime);
    setRequiresQr(defaultRequiresQr);
    setCapacity(defaultCapacity);
    setUsageMode(defaultUsageMode);
    setMaxGuests(defaultMaxGuests);
  }, [initialData.id]);

  const hasChanges =
    name !== defaultName ||
    startTime !== defaultStartTime ||
    endTime !== defaultEndTime ||
    requiresQr !== defaultRequiresQr ||
    capacity !== defaultCapacity ||
    usageMode !== defaultUsageMode ||
    maxGuests !== defaultMaxGuests;

  const handleSubmit = async () => {
    const capNum = parseInt(capacity);
    const guestNum = parseInt(maxGuests);
    if (!name.trim()) {
      return;
    }
    if (isNaN(capNum) || capNum < 1) {
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(startTime)) {
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(endTime)) {
      return;
    }
    if (isNaN(guestNum) || guestNum < 1) {
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        start_time: startTime,
        end_time: endTime,
        requires_qr: requiresQr,
        max_capacity: capNum,
        usage_mode: usageMode,
        max_guests_per_reservation: guestNum,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelClick = () => {
    if (hasChanges) {
      setAlertConfig({
        visible: true,
        title: 'Cancelar cambios',
        message:
          '¿Estás seguro de que deseas cancelar los cambios? Se perderán todos los cambios realizados.',
        type: 'confirm',
      });
    } else {
      onCancel();
    }
  };

  const handleConfirmCancel = () => {
    setName(defaultName);
    setStartTime(defaultStartTime);
    setEndTime(defaultEndTime);
    setRequiresQr(defaultRequiresQr);
    setCapacity(defaultCapacity);
    setUsageMode(defaultUsageMode);
    setMaxGuests(defaultMaxGuests);
    setAlertConfig((prev) => ({ ...prev, visible: false }));
    onCancel();
  };

  return (
    <>
      <View className="gap-5">
        <View className="gap-2">
          <Label nativeID="nombre">Nombre de la instalación</Label>
          <Input
            nativeID="nombre"
            value={name}
            onChangeText={setName}
            placeholder="Ej. Piscina Comunitaria"
          />
        </View>

        <View className="gap-2">
          <Label nativeID="capacity">Aforo máximo permitido</Label>
          <Input
            nativeID="capacity"
            value={capacity}
            onChangeText={setCapacity}
            keyboardType="numeric"
            placeholder="Ej. 50"
          />
        </View>

        <View className="gap-2">
          <Label>Modo de uso</Label>
          <View className="flex-row gap-2">
            <Button
              onPress={() => setUsageMode('exclusive_reservation')}
              variant={usageMode === 'exclusive_reservation' ? 'default' : 'outline'}
              className={`h-10 flex-1 rounded-lg ${
                usageMode === 'exclusive_reservation' ? 'bg-primary' : 'border-primary'
              }`}>
              <Text
                className={`text-sm font-bold ${
                  usageMode === 'exclusive_reservation' ? 'text-primary-foreground' : 'text-primary'
                }`}>
                Reserva Exclusiva
              </Text>
            </Button>
            <Button
              onPress={() => setUsageMode('guest_pass')}
              variant={usageMode === 'guest_pass' ? 'default' : 'outline'}
              className={`h-10 flex-1 rounded-lg ${
                usageMode === 'guest_pass' ? 'bg-primary' : 'border-primary'
              }`}>
              <Text
                className={`text-sm font-bold ${
                  usageMode === 'guest_pass' ? 'text-primary-foreground' : 'text-primary'
                }`}>
                Pase Invitado
              </Text>
            </Button>
          </View>
        </View>

        {usageMode === 'guest_pass' && (
          <View className="gap-2">
            <Label nativeID="maxGuests">Invitados máximos por reserva</Label>
            <Input
              nativeID="maxGuests"
              value={maxGuests}
              onChangeText={setMaxGuests}
              keyboardType="numeric"
              placeholder="Ej. 5"
            />
          </View>
        )}

        <View className="flex-row gap-3">
          <View className="flex-1 gap-2">
            <Label nativeID="startTime">Hora Apertura</Label>
            <Input
              nativeID="startTime"
              value={startTime}
              onChangeText={setStartTime}
              placeholder="09:00"
              maxLength={5}
            />
          </View>
          <View className="flex-1 gap-2">
            <Label nativeID="endTime">Hora Cierre</Label>
            <Input
              nativeID="endTime"
              value={endTime}
              onChangeText={setEndTime}
              placeholder="21:00"
              maxLength={5}
            />
          </View>
        </View>

        <View className="flex-row items-center justify-between gap-3 rounded-lg bg-secondary/50 p-3">
          <Text className="text-sm font-medium text-foreground">
            ¿Requiere invitación (QR) para acceder?
          </Text>
          <Switch checked={requiresQr} onCheckedChange={setRequiresQr} />
        </View>

        <View className="mt-6 gap-2">
          <Button
            onPress={handleSubmit}
            disabled={saving || !name.trim() || !hasChanges}
            className="h-12 rounded-lg bg-primary">
            <Text className="text-base font-bold text-primary-foreground">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Text>
          </Button>

          <Button
            onPress={handleCancelClick}
            variant="outline"
            className="h-12 rounded-lg border-border">
            <Text className="text-base font-bold text-foreground">
              {hasChanges ? 'Cancelar' : 'Volver'}
            </Text>
          </Button>
        </View>
      </View>

      <CustomAlertDialog
        config={alertConfig}
        onConfirm={handleConfirmCancel}
        onCancel={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
        onAcknowledge={() => {}}
      />
    </>
  );
}
