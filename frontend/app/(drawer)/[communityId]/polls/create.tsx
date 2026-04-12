import React, { useEffect, useState } from 'react';
import { View, ScrollView, Alert as RNAlert } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useAvailableProperties, useCreatePollMutation } from '@/hooks/usePolls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DefaultersModal } from '@/components/polls/DefaultersModal';
import { TouchableOpacity } from 'react-native';
import { CreatePollPayload } from '@/types/polls.types';
import { ChevronLeft } from 'lucide-react-native';

type Step = 'basic' | 'defaulters' | 'dates';

export default function CreatePollScreen() {
  const router = useRouter();
  const { activeCommunity } = useAuth();
  const associationId = activeCommunity ? activeCommunity.id : '';

  const [step, setStep] = useState<Step>('basic');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [newOption, setNewOption] = useState('');

  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [customDuration, setCustomDuration] = useState<number>(7);

  const [selectedDefaulters, setSelectedDefaulters] = useState<string[]>([]);
  const [showDefaultersModal, setShowDefaultersModal] = useState(false);

  const { data: properties = [] } = useAvailableProperties(associationId);
  const { mutateAsync: createPoll, isPending: isCreating } = useCreatePollMutation(associationId);
  const navigation = useNavigation();

  const propertiesWithCoefficient = properties.map((p) => ({
    ...p,
    coefficient: p.coefficient || 0,
    is_defaulter: p.is_defaulter || false,
  }));

  const isBasicStepValid = title.trim().length > 0 && options.filter((o) => o.trim()).length >= 2;
  const isDefaultersStepValid = true;
  const isDatesStepValid = endDate > startDate;

  const getAbsenceDate = (): Date => {
    const date = new Date(endDate);
    date.setDate(date.getDate() + 30);
    return date;
  };

  const handleAddOption = () => {
    if (newOption.trim() && options.filter((o) => o.trim()).length < 5) {
      setOptions([...options.filter((o) => o.trim()), newOption.trim()]);
      setNewOption('');
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.filter((o) => o.trim()).length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const setDuration = (days: number) => {
    setCustomDuration(days);
    const newEndDate = new Date(startDate);
    newEndDate.setDate(newEndDate.getDate() + days);
    setEndDate(newEndDate);
  };

  const handleNextStep = () => {
    if (step === 'basic' && isBasicStepValid) {
      setStep('defaulters');
    } else if (step === 'defaulters' && isDefaultersStepValid) {
      setStep('dates');
    }
  };

  const handlePrevStep = () => {
    if (step === 'defaulters') setStep('basic');
    else if (step === 'dates') setStep('defaulters');
  };

  const handleCreatePoll = async () => {
    try {
      const payload: CreatePollPayload = {
        title: title.trim(),
        description: description.trim(),
        options: options.filter((o) => o.trim()),
        defaulter_properties: selectedDefaulters,
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        absentees_end_at: getAbsenceDate().toISOString(),
      };

      await createPoll(payload);

      router.push({
        pathname: '/[communityId]/polls',
        params: { communityId: associationId },
      });
      setStep('basic');
    } catch (error: any) {
      RNAlert.alert('Error', error.response?.data?.detail || 'No se pudo crear la votación');
    }
  };

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => router.push(`/${associationId}/polls`)}
          className="ml-2 mr-4 p-1">
          <ChevronLeft size={26} className="text-foreground" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, router, associationId]);

  const renderBasicStep = () => (
    <ScrollView className="px-4 py-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Información Básica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <View>
            <Text className="mb-2 text-sm font-semibold text-foreground">Título *</Text>
            <Input
              placeholder="Ej: Reforma de fachada"
              value={title}
              onChangeText={setTitle}
              className="text-base"
            />
          </View>
          <View>
            <Text className="mb-2 text-sm font-semibold text-foreground">Descripción</Text>
            <Input
              placeholder="Describe brevemente la votación"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              className="text-base"
            />
          </View>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Opciones de Votación</CardTitle>
          <Text className="mt-1 text-xs text-muted-foreground">Mínimo 2, máximo 5 opciones</Text>
        </CardHeader>
        <CardContent className="space-y-3">
          {options.map((option, idx) => (
            <View key={idx} className="flex-row items-center gap-2">
              <Input
                placeholder={`Opción ${idx + 1}`}
                value={option}
                onChangeText={(text) => {
                  const newOptions = [...options];
                  newOptions[idx] = text;
                  setOptions(newOptions);
                }}
                className="flex-1 text-sm"
              />
              {options.filter((o) => o.trim()).length > 2 && (
                <TouchableOpacity onPress={() => handleRemoveOption(idx)} className="px-2 py-2">
                  <Text className="font-bold text-red-500">✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {options.filter((o) => o.trim()).length < 5 && (
            <View className="mt-3 flex-row gap-2">
              <Input
                placeholder="Nueva opción"
                value={newOption}
                onChangeText={setNewOption}
                className="flex-1 text-sm"
              />
              <Button size="sm" onPress={handleAddOption} disabled={!newOption.trim()}>
                <Text className="text-sm text-white">Agregar</Text>
              </Button>
            </View>
          )}
        </CardContent>
      </Card>
    </ScrollView>
  );

  const renderDefaultersStep = () => (
    <View className="flex-1 px-4 py-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Propiedades Morosas</CardTitle>
          <Text className="mt-1 text-xs text-muted-foreground">
            Selecciona las propiedades que, por impago, no podrán votar (Art. 15.2 LPH)
          </Text>
        </CardHeader>
        <CardContent>
          <Button
            size="lg"
            variant="outline"
            onPress={() => setShowDefaultersModal(true)}
            className="w-full">
            <Text className="font-semibold">
              {selectedDefaulters.length > 0
                ? `${selectedDefaulters.length} seleccionada${selectedDefaulters.length > 1 ? 's' : ''}`
                : 'Seleccionar propiedades'}
            </Text>
          </Button>
        </CardContent>
      </Card>

      <DefaultersModal
        visible={showDefaultersModal}
        properties={propertiesWithCoefficient}
        selectedDefaulters={selectedDefaulters}
        onConfirm={(ids) => {
          setSelectedDefaulters(ids);
          setShowDefaultersModal(false);
        }}
        onCancel={() => setShowDefaultersModal(false)}
      />
    </View>
  );

  const renderDatesStep = () => (
    <ScrollView className="px-4 py-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Inicio de Votación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Text className="text-sm font-semibold text-foreground">
            {startDate.toLocaleDateString('es-ES', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            })}{' '}
            a las {startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Duración de la Votación</CardTitle>
          <Text className="mt-1 text-xs text-muted-foreground">
            Selecciona cuánto durará la votación
          </Text>
        </CardHeader>
        <CardContent className="space-y-3">
          <View className="gap-2">
            <Button
              variant={customDuration === 2 ? 'default' : 'outline'}
              onPress={() => setDuration(2)}
              className="w-full">
              <Text className={customDuration === 2 ? 'font-semibold text-white' : 'font-semibold'}>
                48 Horas
              </Text>
            </Button>
            <Button
              variant={customDuration === 3 ? 'default' : 'outline'}
              onPress={() => setDuration(3)}
              className="w-full">
              <Text className={customDuration === 3 ? 'font-semibold text-white' : 'font-semibold'}>
                3 Días
              </Text>
            </Button>
            <Button
              variant={customDuration === 7 ? 'default' : 'outline'}
              onPress={() => setDuration(7)}
              className="w-full">
              <Text className={customDuration === 7 ? 'font-semibold text-white' : 'font-semibold'}>
                1 Semana
              </Text>
            </Button>
          </View>

          <View className="border-t border-border pt-3">
            <Text className="mb-2 text-xs font-semibold text-muted-foreground">
              Duración personalizada (días)
            </Text>
            <View className="flex-row gap-2">
              <Input
                placeholder="Días"
                value={customDuration.toString()}
                onChangeText={(text) => {
                  const days = parseInt(text, 10);
                  if (!isNaN(days) && days > 0) {
                    setDuration(days);
                  }
                }}
                keyboardType="number-pad"
                className="flex-1"
              />
            </View>
          </View>

          <View className="mt-3 rounded-lg bg-blue-50 p-3">
            <Text className="text-sm font-semibold text-blue-900">
              Cierre de Urna: {endDate.toLocaleDateString('es-ES')} a las{' '}
              {endDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cierre de Discrepancia (Automático)</CardTitle>
          <Text className="mt-1 text-xs text-muted-foreground">
            Según Ley de Propiedad Horizontal Art. 17.3
          </Text>
        </CardHeader>
        <CardContent>
          <View className="rounded-lg bg-amber-50 p-3">
            <Text className="text-sm font-semibold text-amber-900">
              {getAbsenceDate().toLocaleDateString('es-ES')} a las{' '}
              {getAbsenceDate().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text className="mt-2 text-xs text-amber-700">
              Los administradores pueden registrar ausentes hasta 30 días después del cierre de
              urna. Esta fecha se calcula automáticamente según la ley.
            </Text>
          </View>
        </CardContent>
      </Card>
    </ScrollView>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: `Crear Votación - Paso ${step === 'basic' ? '1' : step === 'defaulters' ? '2' : '3'} de 3`,
          headerShown: true,
        }}
      />
      <View className="flex-1 bg-background">
        {step === 'basic' && renderBasicStep()}
        {step === 'defaulters' && renderDefaultersStep()}
        {step === 'dates' && renderDatesStep()}

        <View className="flex-row gap-3 border-t border-border bg-card px-4 py-4">
          {step !== 'basic' && (
            <Button
              variant="outline"
              size="lg"
              onPress={handlePrevStep}
              disabled={isCreating}
              className="flex-1">
              <Text className="font-semibold">Anterior</Text>
            </Button>
          )}
          {step !== 'dates' && (
            <Button
              size="lg"
              onPress={handleNextStep}
              disabled={
                (step === 'basic' && !isBasicStepValid) ||
                (step === 'defaulters' && !isDefaultersStepValid)
              }
              className="flex-1">
              <Text className="font-semibold text-white">Siguiente</Text>
            </Button>
          )}
          {step === 'dates' && (
            <Button
              size="lg"
              onPress={handleCreatePoll}
              disabled={!isDatesStepValid || isCreating}
              className="flex-1">
              <Text className="font-semibold text-white">
                {isCreating ? 'Creando...' : 'Crear Votación'}
              </Text>
            </Button>
          )}
        </View>
      </View>
    </>
  );
}
