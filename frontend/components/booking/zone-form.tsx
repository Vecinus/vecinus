import { useState, useEffect } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const defaultStartTime = initialData.start_time?.substring(0, 5) ?? '';
  const defaultEndTime = initialData.end_time?.substring(0, 5) ?? '';
  const defaultRequiresQr = initialData.requires_qr !== undefined ? Boolean(initialData.requires_qr) : undefined;
  const defaultCapacity = String(initialData.capacity ?? '1');
  const defaultUsageMode = (initialData.usage_mode ?? 'exclusive_reservation') as 'exclusive_reservation' | 'guest_pass';
  const defaultMaxGuests = String(initialData.max_guests_per_reservation ?? '1');

  const [name, setName] = useState(defaultName);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);
  const [requiresQr, setRequiresQr] = useState<boolean | undefined>(defaultRequiresQr);
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
  }, [
    defaultCapacity,
    defaultEndTime,
    defaultMaxGuests,
    defaultName,
    defaultRequiresQr,
    defaultStartTime,
    defaultUsageMode,
    initialData.id,
  ]);

  const hasChanges =
    name !== defaultName ||
    startTime !== defaultStartTime ||
    endTime !== defaultEndTime ||
    requiresQr !== defaultRequiresQr ||
    capacity !== defaultCapacity ||
    usageMode !== defaultUsageMode ||
    maxGuests !== defaultMaxGuests;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        start_time: startTime.trim(),
        end_time: endTime.trim(),
        requires_qr: requiresQr,
        capacity: capacity.trim(),
        usage_mode: usageMode,
        max_guests_per_reservation: usageMode === 'guest_pass' ? maxGuests.trim() : undefined,
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
      <View className="w-full items-center gap-5">
        <View className="w-full max-w-5xl gap-5">
          <View className="gap-2">
            <Label className="text-lg" nativeID="nombre">
              Nombre de la instalación
            </Label>
            <Input
              nativeID="nombre"
              value={name}
              onChangeText={setName}
              placeholder="Ej. Piscina Comunitaria"
            />
          </View>

          <View className="gap-2">
            <Label className="text-lg" nativeID="capacity">
              Aforo máximo permitido
            </Label>
            <Input
              nativeID="capacity"
              value={capacity}
              onChangeText={setCapacity}
              keyboardType="numeric"
              placeholder="Ej. 50"
            />
          </View>

          <View className="gap-2">
            <Label className="text-lg" nativeID="usageMode">
              Modo de uso
            </Label>
            <View className="flex-row gap-2">
              <Button
                onPress={() => setUsageMode('exclusive_reservation')}
                variant={usageMode === 'exclusive_reservation' ? 'default' : 'outline'}
                className={`h-10 flex-1 rounded-lg ${usageMode === 'exclusive_reservation' ? 'bg-primary' : 'border-primary'
                  }`}>
                <Text
                  className={`text-sm font-bold ${usageMode === 'exclusive_reservation'
                    ? 'text-primary-foreground'
                    : 'text-primary'
                    }`}>
                  Reserva Exclusiva
                </Text>
              </Button>
              <Button
                onPress={() => setUsageMode('guest_pass')}
                variant={usageMode === 'guest_pass' ? 'default' : 'outline'}
                className={`h-10 flex-1 rounded-lg ${usageMode === 'guest_pass' ? 'bg-primary' : 'border-primary'
                  }`}>
                <Text
                  className={`text-sm font-bold ${usageMode === 'guest_pass' ? 'text-primary-foreground' : 'text-primary'
                    }`}>
                  Pase Invitado
                </Text>
              </Button>
            </View>
          </View>

          {usageMode === 'guest_pass' && (
            <View className="gap-2">
              <Label className="text-base" nativeID="maxGuests">
                Invitados máximos por reserva
              </Label>
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
              <Label className="text-lg" nativeID="startTime">
                Hora Apertura
              </Label>
              <Input
                nativeID="startTime"
                value={startTime}
                onChangeText={setStartTime}
                placeholder="09:00"
                maxLength={5}
              />
            </View>
            <View className="flex-1 gap-2">
              <Label className="text-lg" nativeID="endTime">
                Hora Cierre
              </Label>
              <Input
                nativeID="endTime"
                value={endTime}
                onChangeText={setEndTime}
                placeholder="21:00"
                maxLength={5}
              />
            </View>
          </View>

          <View className="gap-2">
            <Label className="text-lg" nativeID="requiresQr">
              ¿Requiere invitación (QR) para acceder?
            </Label>
            <View className="flex-row gap-2">
              <Button
                onPress={() => { setRequiresQr(true); }}
                variant={requiresQr === true ? 'default' : 'outline'}
                className={`h-10 flex-1 rounded-lg ${requiresQr === true ? 'bg-primary' : 'border-primary'
                  }`}>
                <Text
                  className={`text-sm font-bold ${requiresQr === true ? 'text-primary-foreground' : 'text-primary'
                    }`}>
                  Sí
                </Text>
              </Button>
              <Button
                onPress={() => { setRequiresQr(false); }}
                variant={requiresQr === false ? 'default' : 'outline'}
                className={`h-10 flex-1 rounded-lg ${requiresQr === false ? 'bg-primary' : 'border-primary'
                  }`}>
                <Text
                  className={`text-sm font-bold ${requiresQr === false ? 'text-primary-foreground' : 'text-primary'
                    }`}>
                  No
                </Text>
              </Button>
            </View>
          </View>

          <View className="mt-6 gap-2">
            <Button
              onPress={handleSubmit}
              disabled={saving || !hasChanges}
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
      </View>

      <CustomAlertDialog
        config={alertConfig}
        onConfirm={handleConfirmCancel}
        onCancel={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
        onAcknowledge={() => { }}
      />
    </>
  );
}
