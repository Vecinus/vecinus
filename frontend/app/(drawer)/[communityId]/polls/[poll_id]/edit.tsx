import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Alert as RNAlert,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Picker,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useNavigation } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import {
  usePollById,
  useDeletePollMutation,
  useEditPollMutation,
  usePublishPollMutation,
} from '@/hooks/usePolls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft } from 'lucide-react-native';

export default function EditPollScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { activeCommunity } = useAuth();
  const associationId = activeCommunity ? activeCommunity.id : '';
  const poll_id = params?.poll_id as string;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [selectedDuration, setSelectedDuration] = useState<number>(7);
  const [startHour, setStartHour] = useState<string>('00');
  const [startMinute, setStartMinute] = useState<string>('00');

  const isPollValid = title.trim().length > 0 && options.filter((o) => o.trim()).length >= 2;

  const { data: poll, isLoading } = usePollById(poll_id);
  const deletePolMutation = useDeletePollMutation(associationId);
  const editPollMutation = useEditPollMutation(associationId, poll_id);
  const publishPollMutation = usePublishPollMutation(associationId);
  const navigation = useNavigation();

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
  }, [poll, router]);

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

  useEffect(() => {
    if (showPublishModal) {
      const today = new Date();
      setStartDate(today);
      setStartHour('00');
      setStartMinute('00');
      setSelectedDuration(7);
      const endDateDefault = new Date(today);
      endDateDefault.setDate(endDateDefault.getDate() + 7);
      setEndDate(endDateDefault);
    }
  }, [showPublishModal]);

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

  const handleSaveChanges = async () => {
    try {
      setIsSubmitting(true);
      await editPollMutation.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        options: options.filter((o) => o.trim()),
      });
      router.push({
        pathname: '/[communityId]/polls',
        params: { communityId: associationId },
      });
    } catch (error: any) {
      RNAlert.alert('Error', error.response?.data?.detail || 'No se pudo actualizar la votación');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePoll = async () => {
    try {
      await deletePolMutation.mutateAsync(poll_id);
      router.push({
        pathname: '/[communityId]/polls',
        params: { communityId: associationId },
      });
      setShowDeleteModal(false);
    } catch (error: any) {
      RNAlert.alert('Error', error.response?.data?.detail || 'No se pudo eliminar la votación');
      setShowDeleteModal(false);
    }
  };

  const handlePublishPoll = async () => {
    try {
      const absenceDate = new Date(endDate);
      absenceDate.setDate(absenceDate.getDate() + 30);

      await publishPollMutation.mutateAsync({
        pollId: poll_id,
        dates: {
          start_at: startDate.toISOString(),
          end_at: endDate.toISOString(),
          absentees_end_at: absenceDate.toISOString(),
        },
      });

      RNAlert.alert('Éxito', 'Votación publicada correctamente');
      router.push({
        pathname: '/[communityId]/polls',
        params: { communityId: associationId },
      });
      setShowPublishModal(false);
    } catch (error: any) {
      RNAlert.alert('Error', error.response?.data?.detail || 'No se pudo publicar la votación');
    }
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Editar Votación',
            headerShown: true,
          }}
        />
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

  const DeleteModal = () => (
    <Modal transparent visible={showDeleteModal} animationType="fade">
      <View className="flex-1 items-center justify-center bg-black/50 p-6">
        <View className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-xl">
          <Text className="mb-2 text-lg font-bold text-foreground">Eliminar Votación</Text>
          <Text className="mb-6 text-muted-foreground">
            ¿Estás seguro de que deseas eliminar "{title}"? Esta acción no se puede deshacer.
          </Text>
          <View className="flex-row justify-end gap-3">
            <Button
              variant="outline"
              onPress={() => setShowDeleteModal(false)}
              disabled={deletePolMutation.isPending}>
              <Text>Cancelar</Text>
            </Button>
            <Button
              variant="destructive"
              onPress={handleDeletePoll}
              disabled={deletePolMutation.isPending}>
              <Text className="text-destructive-foreground">
                {deletePolMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </Text>
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );

  const PublishModal = () => (
    <Modal transparent visible={showPublishModal} animationType="fade">
      <View className="flex-1 items-center justify-center bg-black/50 p-6">
        <View className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-xl">
          <Text className="mb-4 text-lg font-bold text-foreground">
            Configurar Fechas de Publicación
          </Text>

          <View className="mb-6 space-y-4">
            <View>
              <Text className="mb-2 text-sm font-semibold text-foreground">Inicio de Votación</Text>
              <Input
                placeholder="Fecha de inicio"
                value={startDate.toLocaleDateString('es-ES', {
                  weekday: 'narrow',
                  year: 'numeric',
                  month: 'numeric',
                  day: 'numeric',
                })}
                onChangeText={(value) => {
                  const parts = value.split('/');
                  if (parts.length === 3) {
                    const day = parseInt(parts[0], 10);
                    const month = parseInt(parts[1], 10) - 1;
                    const year = parseInt(parts[2], 10);
                    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                      const newDate = new Date(year, month, day, parseInt(startHour), parseInt(startMinute));
                      setStartDate(newDate);
                    }
                  }
                }}
                className="text-sm"
              />
              <Text className="mt-2 text-xs text-muted-foreground mb-2">Hora de inicio</Text>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Text className="mb-1 text-xs font-semibold text-foreground">HH</Text>
                  <Input
                    placeholder="00"
                    value={startHour.padStart(2, '0')}
                    onChangeText={(value) => {
                      const num = parseInt(value, 10);
                      if (!isNaN(num) && num >= 0 && num <= 23) {
                        setStartHour(value);
                        const newDate = new Date(startDate);
                        newDate.setHours(num, parseInt(startMinute));
                        setStartDate(newDate);
                      }
                    }}
                    maxLength={2}
                    keyboardType="number-pad"
                    className="text-sm"
                  />
                </View>
                <View className="flex-1">
                  <Text className="mb-1 text-xs font-semibold text-foreground">MM</Text>
                  <Input
                    placeholder="00"
                    value={startMinute.padStart(2, '0')}
                    onChangeText={(value) => {
                      const num = parseInt(value, 10);
                      if (!isNaN(num) && num >= 0 && num <= 59) {
                        setStartMinute(value);
                        const newDate = new Date(startDate);
                        newDate.setHours(parseInt(startHour), num);
                        setStartDate(newDate);
                      }
                    }}
                    maxLength={2}
                    keyboardType="number-pad"
                    className="text-sm"
                  />
                </View>
              </View>
            </View>

            <View>
              <Text className="mb-2 text-sm font-semibold text-foreground">Duración (días)</Text>
              <View className="overflow-hidden rounded-lg border border-border">
                <Picker
                  selectedValue={selectedDuration}
                  onValueChange={(value) => {
                    setSelectedDuration(value);
                    const newEnd = new Date(startDate);
                    newEnd.setDate(newEnd.getDate() + value);
                    setEndDate(newEnd);
                  }}
                  style={{
                    backgroundColor: '#fff',
                    color: '#000',
                  }}>
                  {[2, 3, 4, 5, 6, 7].map((day) => (
                    <Picker.Item key={day} label={`${day}`} value={day} />
                  ))}
                </Picker>
              </View>
            </View>

            <View>
              <Text className="mb-2 text-sm font-semibold text-foreground">Fin de Votación</Text>
              <Input
                placeholder="Fecha de fin"
                value={endDate.toLocaleDateString('es-ES', {
                  weekday: 'narrow',
                  year: 'numeric',
                  month: 'numeric',
                  day: 'numeric',
                })}
                editable={false}
                className="text-sm text-muted-foreground"
              />
            </View>

            <View className="rounded-lg border border-border bg-muted px-3 py-2">
              <Text className="text-xs font-semibold text-muted-foreground">NOTA:</Text>
              <Text className="mt-1 text-xs text-muted-foreground">
                El recuento de ausentes se habilitará automáticamente 30 días después del fin de
                votación
              </Text>
            </View>
          </View>

          <View className="flex-row justify-end gap-3">
            <Button
              variant="outline"
              onPress={() => setShowPublishModal(false)}
              disabled={publishPollMutation.isPending}>
              <Text>Cancelar</Text>
            </Button>
            <Button onPress={handlePublishPoll} disabled={publishPollMutation.isPending}>
              <Text className="text-white">
                {publishPollMutation.isPending ? 'Publicando...' : 'Publicar'}
              </Text>
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Editar Votación',
          headerShown: true,
        }}
      />

      <DeleteModal />
      <PublishModal />
      <View className="flex-1 bg-background">
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

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Opciones de Votación</CardTitle>
              <Text className="mt-1 text-xs text-muted-foreground">
                Mínimo 2, máximo 5 opciones
              </Text>
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Propiedades excluidas</CardTitle>
              <Text className="mt-1 text-xs text-muted-foreground">
                Las propiedades morosas no se pueden editar. Fueron seleccionadas al crear la
                votación.
              </Text>
            </CardHeader>
            <CardContent>
              <Text className="text-sm text-foreground">
                Para cambiar las propiedades morosas, crea una nueva votación.
              </Text>
            </CardContent>
          </Card>
        </ScrollView>

        <View className="gap-3 border-t border-border bg-card px-4 py-4">
          <Button
            size="lg"
            onPress={handleSaveChanges}
            disabled={!isPollValid || isSubmitting}
            className="w-full">
            <Text className="font-semibold text-white">
              {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
            </Text>
          </Button>

          <View className="flex-row gap-3">
            <Button
              variant="destructive"
              size="lg"
              onPress={() => setShowDeleteModal(true)}
              disabled={isSubmitting || deletePolMutation.isPending}
              className="flex-1">
              <Text className="font-semibold text-destructive-foreground">Eliminar</Text>
            </Button>

            <Button
              size="lg"
              onPress={() => setShowPublishModal(true)}
              disabled={isSubmitting || publishPollMutation.isPending}
              className="flex-1 bg-green-600">
              <Text className="font-semibold text-white">
                {publishPollMutation.isPending ? 'Publicando...' : 'Publicar'}
              </Text>
            </Button>
          </View>
        </View>
      </View>
    </>
  );
}
