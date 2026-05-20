import React, { useCallback, useState } from 'react';
import { isPaymentRequiredError } from '@/lib/payment-events';
import {
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, Save, AlertCircle, Plus, X, AlertTriangle } from 'lucide-react-native';
import { Drawer } from 'expo-router/drawer';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { pollService } from '@/api/services/poll.service';
import { PollCreateRequest } from '@/types/poll.types';
import { PropertyArrearsManager } from '@/components/votaciones/property-arrears-manager';
import { getErrorMessage } from '@/lib/error-message';
import { isForbiddenError } from '@/lib/http-errors';

export default function CreatePoll() {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<string[]>(['Sí', 'No']);
  const [newOption, setNewOption] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [totalCoefficient, setTotalCoefficient] = useState(0);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    description: '',
    isSuccess: false,
  });
  const [backAlertOpen, setBackAlertOpen] = useState(false);

  const resetForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setOptions(['Sí', 'No']);
    setNewOption('');
  }, []);

  const hasChanges = title.trim() !== '' || description.trim() !== '' || newOption.trim() !== '' || options.length > 2 || !options.includes('Sí') || !options.includes('No');

  const handleBack = useCallback(() => {
    if (hasChanges) {
      setBackAlertOpen(true);
    } else {
      router.push(`/${communityId}/votaciones` as any);
    }
  }, [hasChanges, communityId, router]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        resetForm();
      };
    }, [resetForm])
  );

  const showAlert = (title: string, description: string, isSuccess = false) => {
    setAlertConfig({ title, description, isSuccess });
    setAlertOpen(true);
  };

  const addOption = () => {
    const trimmedOption = newOption.trim();

    if (!trimmedOption) {
      showAlert('Error', 'La opción no puede estar vacía');
      return;
    }

    if (trimmedOption.length > 80) {
      showAlert('Error', 'Cada opción debe tener como máximo 80 caracteres');
      return;
    }

    if (options.includes(trimmedOption)) {
      showAlert('Error', 'Las opciones no pueden estar duplicadas');
      return;
    }

    setOptions([...options, trimmedOption]);
    setNewOption('');
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const cleanedOptions = options.map((option) => option.trim());

    if (!trimmedTitle) {
      showAlert('Error', 'El título es obligatorio');
      return;
    }
    if (trimmedTitle.length > 200) {
      showAlert('Error', 'El título no puede superar los 200 caracteres');
      return;
    }
    if (trimmedDescription.length > 2000) {
      showAlert('Error', 'La descripción no puede superar los 2000 caracteres');
      return;
    }
    if (options.length < 2) {
      showAlert('Error', 'Debe haber al menos 2 opciones');
      return;
    }
    if (cleanedOptions.some((option) => !option)) {
      showAlert('Error', 'Las opciones no pueden estar vacías');
      return;
    }
    if (cleanedOptions.some((option) => option.length > 80)) {
      showAlert('Error', 'Cada opción debe tener como máximo 80 caracteres');
      return;
    }
    if (new Set(cleanedOptions).size !== cleanedOptions.length) {
      showAlert('Error', 'Las opciones no pueden estar duplicadas');
      return;
    }
    if (totalCoefficient === 0) {
      showAlert('Error', 'No puedes crear una votación sin vecinos en la comunidad. Añade propiedades y vecinos antes de crear una votación.');
      return;
    }
    if (Math.abs(totalCoefficient - 100) > 0.01) {
      showAlert('Error', 'La suma total de los coeficientes de las propiedades debe ser exactamente 100%');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: PollCreateRequest = {
        title: trimmedTitle,
        description: trimmedDescription || undefined,
        options: cleanedOptions,
      };
      await pollService.createPoll(communityId, payload);
      showAlert('Éxito', 'La votación se ha creado correctamente', true);
    } catch (error: unknown) {
      if (isPaymentRequiredError(error) || isForbiddenError(error)) {
        return;
      }
      console.error('[CreatePoll] Error:', error);
      const msg = getErrorMessage(error, 'No se pudo crear la votación');
      showAlert('Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAlertClose = () => {
    setAlertOpen(false);
    if (alertConfig.isSuccess) {
      router.push(`/${communityId}/votaciones` as any);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <Drawer.Screen
        options={{
          title: 'Nueva votación',
          headerLeft: () => (
            <TouchableOpacity
              onPress={handleBack}
              className="ml-2 rounded-full p-2 active:bg-muted">
              <Icon as={ChevronLeft} size={24} className="text-foreground" />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 16 }}>
        <View className="gap-6">
          <View className="gap-2">
            <Text className="ml-1 text-sm font-medium text-foreground">Título</Text>
            <Input
              placeholder="Ej. Aprobación de presupuesto 2026"
              value={title}
              onChangeText={setTitle}
              className="h-12 text-base"
              maxLength={200}
            />
          </View>

          <View className="gap-2">
            <Text className="ml-1 text-sm font-medium text-foreground">Descripción</Text>
            <Input
              placeholder="Describe la votación..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              className="h-32 text-base"
              style={{ textAlignVertical: 'top' }}
              maxLength={2000}
            />
          </View>

          <View className="gap-2">
            <Text className="ml-1 text-sm font-medium text-foreground">Opciones</Text>
            <Text className="ml-1 text-xs text-muted-foreground">
              Añade al menos 2 opciones de respuesta.
            </Text>
            <View className="gap-2 mt-2">
              {options.map((option, index) => (
                <Card key={index} className="border-border">
                  <CardContent className="p-3 flex-row items-center justify-between">
                    <Text className="text-sm font-medium text-foreground">{option}</Text>
                    <TouchableOpacity onPress={() => removeOption(index)}>
                      <Icon as={X} size={18} className="text-destructive" />
                    </TouchableOpacity>
                  </CardContent>
                </Card>
              ))}
              <View className="flex-row gap-2">
                <Input
                  placeholder="Nueva opción..."
                  value={newOption}
                  onChangeText={setNewOption}
                  className="flex-1 h-12 text-base"
                  onSubmitEditing={addOption}
                  maxLength={80}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12"
                  onPress={addOption}>
                  <Icon as={Plus} size={20} className="text-foreground" />
                </Button>
              </View>
            </View>
          </View>

          <Card className="border-border bg-muted/30">
            <CardContent className="p-4">
              <Text className="text-sm font-medium text-foreground">
                Las fechas de inicio, fin y cierre de ausentes se configuran al publicar la votación, no al crearla.
              </Text>
            </CardContent>
          </Card>

          <View className="gap-2">
            <Text className="ml-1 text-sm font-bold text-foreground">Gestión de morosidad</Text>
            <Text className="ml-1 text-xs text-muted-foreground">
              Marca las propiedades morosas para excluirlas del censo electoral (Art. 15.2 LPH).
            </Text>
            <PropertyArrearsManager
              associationId={communityId}
              onCoefficientChange={setTotalCoefficient}
              forceEquitable
            />
          </View>
        </View>
      </ScrollView>

      <View className="border-t border-border bg-background px-4 pb-6 pt-4">
        <Button
          className="h-14 w-full gap-2 rounded-xl"
          onPress={handleSubmit}
          disabled={isSubmitting || !title.trim() || options.length < 2}>
          {isSubmitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Icon as={Save} size={20} className="text-primary-foreground" />
              <Text className="text-base font-bold text-primary-foreground">
                Crear votación
              </Text>
            </>
          )}
        </Button>
      </View>

      <Dialog open={alertOpen} onOpenChange={setAlertOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <View className="flex-row items-center gap-2">
              {!alertConfig.isSuccess && (
                <Icon as={AlertCircle} size={20} className="text-destructive" />
              )}
              <DialogTitle>{alertConfig.title}</DialogTitle>
            </View>
            <Text className="mt-2 text-sm text-muted-foreground">
              {alertConfig.description}
            </Text>
          </DialogHeader>
          <View className="mt-4">
            <Button className="h-12 w-full rounded-xl" onPress={handleAlertClose}>
              <Text className="font-bold text-primary-foreground">Entendido</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>

      <Dialog open={backAlertOpen} onOpenChange={setBackAlertOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <View className="flex-row items-center gap-2">
              <Icon as={AlertTriangle} size={20} className="text-destructive" />
              <DialogTitle>¿Salir sin guardar?</DialogTitle>
            </View>
            <Text className="mt-2 text-sm text-muted-foreground">
              Tienes cambios sin guardar. Si sales, se perderán los datos introducidos.
            </Text>
          </DialogHeader>
          <View className="mt-4 gap-3">
            <Button className="h-12 w-full rounded-xl" onPress={() => {
              setBackAlertOpen(false);
              resetForm();
              router.push(`/${communityId}/votaciones` as any);
            }}>
              <Text className="font-bold text-primary-foreground">Salir sin guardar</Text>
            </Button>
            <Button variant="outline" className="h-12 w-full rounded-xl" onPress={() => setBackAlertOpen(false)}>
              <Text className="font-bold text-foreground">Cancelar</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>
    </View>
  );
}
