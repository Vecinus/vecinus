import React, { useState, useEffect, useCallback } from 'react';
import { isPaymentRequiredError } from '@/lib/payment-events';
import {
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Save, AlertCircle, Trash2, Plus, X } from 'lucide-react-native';
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
import { CustomAlertDeleteDialog } from '@/components/custom-alert';
import { pollService } from '@/api/services/poll.service';
import { PollUpdateRequest } from '@/types/poll.types';
import { NAV_THEME } from '@/lib/theme';
import { useColorScheme } from 'nativewind';
import { PropertyArrearsManager } from '@/components/votaciones/property-arrears-manager';
import { getErrorMessage } from '@/lib/error-message';

export default function EditPoll() {
  const { communityId, pollId } = useLocalSearchParams<{
    communityId: string;
    pollId: string;
  }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const theme = NAV_THEME[colorScheme ?? 'light'];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [totalCoefficient, setTotalCoefficient] = useState(0);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    description: '',
    isSuccess: false,
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const showAlert = (title: string, description: string, isSuccess = false) => {
    setAlertConfig({ title, description, isSuccess });
    setAlertOpen(true);
  };

  const loadData = useCallback(async () => {
    if (!pollId || pollId === 'undefined') return;
    try {
      const pollData = await pollService.getPoll(pollId);

      if (pollData.status !== 'DRAFT') {
        setCanEdit(false);
        showAlert(
          'No editable',
          'Solo se pueden editar votaciones en estado Borrador'
        );
        return;
      }

      setCanEdit(true);
      setTitle(pollData.title);
      setDescription(pollData.description || '');
      setOptions(pollData.options);
    } catch (error: unknown) {
      if (isPaymentRequiredError(error)) {
        return;
      }
      console.error('Error loading poll:', error);
      showAlert('Error', 'No se pudo cargar la votación');
    } finally {
      setLoading(false);
    }
  }, [pollId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    if (Math.abs(totalCoefficient - 100) > 0.01) {
      showAlert('Error', 'La suma total de los coeficientes de las propiedades debe ser exactamente 100%');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: PollUpdateRequest = {
        title: trimmedTitle,
        description: trimmedDescription || undefined,
        options: cleanedOptions,
      };
      await pollService.updatePoll(pollId, payload);
      showAlert('Éxito', 'La votación se ha actualizado correctamente', true);
    } catch (error: unknown) {
      if (isPaymentRequiredError(error)) {
        return;
      }
      console.error('[EditPoll] Error:', error);
      const msg = getErrorMessage(error, 'No se pudo actualizar la votación');
      showAlert('Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await pollService.deletePoll(pollId);
      setDeleteDialogOpen(false);
      showAlert('Éxito', 'La votación se ha eliminado correctamente', true);
    } catch (error: unknown) {
      if (isPaymentRequiredError(error)) {
        return;
      }
      console.error('Error deleting poll:', error);
      showAlert('Error', 'No se pudo eliminar la votación');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAlertClose = () => {
    setAlertOpen(false);
    if (alertConfig.isSuccess) {
      router.push(`/${communityId}/votaciones` as any);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!canEdit) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-xl font-bold text-foreground text-center">
          No se puede editar esta votación
        </Text>
        <Text className="text-muted-foreground text-center mt-2">
          Solo las votaciones en estado Borrador pueden editarse.
        </Text>
        <Button className="mt-6" onPress={() => router.push(`/${communityId}/votaciones` as any)}>
          <Text>Volver</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Drawer.Screen
        options={{
          title: 'Editar votación',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.push(`/${communityId}/votaciones` as any)}
              className="ml-2 rounded-full p-2 active:bg-muted">
              <Icon as={ChevronLeft} size={24} className="text-foreground" />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        <View className="gap-6">
          <View className="gap-2">
            <Text className="ml-1 text-sm font-medium text-foreground">Título</Text>
            <Input
              value={title}
              onChangeText={setTitle}
              className="h-12 text-base"
              maxLength={200}
            />
          </View>

          <View className="gap-2">
            <Text className="ml-1 text-sm font-medium text-foreground">Descripción</Text>
            <Input
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
                Las fechas de inicio, fin y cierre de ausentes se configuran al publicar la votación, no al editarla.
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
              pollId={pollId}
              onCoefficientChange={setTotalCoefficient}
            />
          </View>

          <View className="gap-3 mt-4">
            <Button
              className="h-14 w-full gap-2 rounded-xl"
              onPress={handleSubmit}
              disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Icon as={Save} size={20} className="text-primary-foreground" />
                  <Text className="text-base font-bold text-primary-foreground">
                    Guardar cambios
                  </Text>
                </>
              )}
            </Button>

            <Button
              variant="destructive"
              className="h-14 w-full gap-2 rounded-xl"
              onPress={() => setDeleteDialogOpen(true)}
              disabled={isDeleting}>
              {isDeleting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Icon as={Trash2} size={20} className="text-destructive-foreground" />
                  <Text className="text-base font-bold text-destructive-foreground">
                    Eliminar votación
                  </Text>
                </>
              )}
            </Button>
          </View>
        </View>
      </ScrollView>

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

      <CustomAlertDeleteDialog
        visible={deleteDialogOpen}
        title="Confirmar eliminación"
        message="¿Estás seguro de que deseas eliminar esta votación? Esta acción no se puede deshacer."
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
    </View>
  );
}
