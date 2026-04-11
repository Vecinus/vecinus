import React, { useState, useEffect } from 'react';
import { View, ScrollView, Alert as RNAlert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { usePollById } from '@/hooks/usePolls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TouchableOpacity, ActivityIndicator } from 'react-native';
import { pollsApi } from '@/api/polls';

type Step = 'basic' | 'defaulters';

export default function EditPollScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { activeCommunity } = useAuth();
  const associationId = activeCommunity ? activeCommunity.id : '';
  const poll_id = params?.poll_id as string;

  const [step, setStep] = useState<Step>('basic');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: poll, isLoading } = usePollById(poll_id);

  useEffect(() => {
    if (poll) {
      if (poll.status !== 'DRAFT') {
        RNAlert.alert('Error', 'Solo puedes editar votaciones en estado DRAFT');
        router.back();
      }
      setTitle(poll.title || '');
      setDescription(poll.description || '');
      setOptions(poll.options || []);
    }
  }, [poll]);

  const isBasicStepValid = title.trim().length > 0 && options.filter((o) => o.trim()).length >= 2;

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

  const handleNextStep = () => {
    if (step === 'basic' && isBasicStepValid) {
      setStep('defaulters');
    }
  };

  const handlePrevStep = () => {
    if (step === 'defaulters') setStep('basic');
  };

  const handleSaveChanges = async () => {
    try {
      setIsSubmitting(true);
      await pollsApi.editPoll(poll_id, {
        title: title.trim(),
        description: description.trim(),
        options: options.filter((o) => o.trim()),
      });
      router.push({
        pathname: '/[communityId]/polls',
        params: { communityId: associationId },
      });
      setStep('basic');
    } catch (error: any) {
      RNAlert.alert('Error', error.response?.data?.detail || 'No se pudo actualizar la votación');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Editar Votación' }} />
        <View className="flex-1 items-center justify-center bg-background">
          <ActivityIndicator size="large" className="text-primary" />
          <Text className="mt-4 text-muted-foreground">Cargando votación...</Text>
        </View>
      </>
    );
  }

  if (!poll) {
    return (
      <>
        <Stack.Screen options={{ title: 'Error' }} />
        <View className="flex-1 items-center justify-center bg-background px-4">
          <Text className="font-semibold text-foreground">Votación no encontrada</Text>
        </View>
      </>
    );
  }

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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Info</CardTitle>
          <Text className="mt-1 text-xs text-muted-foreground">
            Las propiedades morosas no se pueden editar. Fueron seleccionadas al crear la votación.
          </Text>
        </CardHeader>
        <CardContent>
          <Text className="text-sm text-foreground">
            Para cambiar las propiedades morosas, crea una nueva votación.
          </Text>
        </CardContent>
      </Card>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: `Editar Votación - Paso ${step === 'basic' ? '1' : '2'} de 2`,
          headerShown: true,
        }}
      />
      <View className="flex-1 bg-background">
        {step === 'basic' && renderBasicStep()}
        {step === 'defaulters' && renderDefaultersStep()}

        <View className="flex-row gap-3 border-t border-border bg-card px-4 py-4">
          {step !== 'basic' && (
            <Button
              variant="outline"
              size="lg"
              onPress={handlePrevStep}
              disabled={isSubmitting}
              className="flex-1">
              <Text className="font-semibold">Anterior</Text>
            </Button>
          )}
          {step !== 'defaulters' && (
            <Button
              size="lg"
              onPress={handleNextStep}
              disabled={!isBasicStepValid}
              className="flex-1">
              <Text className="font-semibold text-white">Siguiente</Text>
            </Button>
          )}
          {step === 'defaulters' && (
            <Button
              size="lg"
              onPress={handleSaveChanges}
              disabled={!isBasicStepValid || isSubmitting}
              className="flex-1">
              <Text className="font-semibold text-white">
                {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
              </Text>
            </Button>
          )}
        </View>
      </View>
    </>
  );
}
