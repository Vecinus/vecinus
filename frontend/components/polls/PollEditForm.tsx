import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Poll, EditPollPayload } from '@/types/polls.types';

interface PollEditFormProps {
  poll: Poll;
  onSubmit: (payload: EditPollPayload) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const PollEditForm: React.FC<PollEditFormProps> = ({
  poll,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [title, setTitle] = useState(poll.title);
  const [description, setDescription] = useState(poll.description || '');
  const [options, setOptions] = useState<string[]>(poll.options || []);
  const [newOption, setNewOption] = useState('');
  const [startDate, setStartDate] = useState<Date>(
    poll.start_at ? new Date(poll.start_at) : new Date()
  );
  const [endDate, setEndDate] = useState<Date>(poll.end_at ? new Date(poll.end_at) : new Date());
  const [absenceDate, setAbsenceDate] = useState<Date>(
    poll.absentees_end_at ? new Date(poll.absentees_end_at) : new Date()
  );

  const handleAddOption = () => {
    if (newOption.trim() && options.length < 5) {
      setOptions([...options, newOption.trim()]);
      setNewOption('');
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async () => {
    const payload: EditPollPayload = {
      title: title.trim(),
      description: description.trim(),
      options,
      start_at: startDate.toISOString(),
      end_at: endDate.toISOString(),
      absentees_end_at: absenceDate.toISOString(),
    };
    await onSubmit(payload);
  };

  const isFormValid = title.trim().length > 0 && options.length >= 2;

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="px-4 py-6">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Información Básica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <View>
              <Text className="mb-2 text-sm font-semibold text-foreground">Título</Text>
              <Input
                placeholder="Ej: Reforma de fachada"
                value={title}
                onChangeText={setTitle}
                editable={!isLoading}
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
                editable={!isLoading}
                className="text-base"
              />
            </View>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Opciones de Votación</CardTitle>
            <Text className="mt-1 text-xs text-muted-foreground">Mínimo 2, máximo 5 opciones</Text>
          </CardHeader>
          <CardContent className="space-y-3">
            <FlatList
              data={options}
              renderItem={({ item, index }) => (
                <View className="mb-2 flex-row items-center gap-2 rounded bg-gray-100 px-3 py-2">
                  <Text className="flex-1 text-sm text-foreground">{item}</Text>
                  {options.length > 2 && (
                    <TouchableOpacity onPress={() => handleRemoveOption(index)}>
                      <Text className="font-bold text-red-500">✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              keyExtractor={(_, idx) => idx.toString()}
              scrollEnabled={false}
            />
            <View className="mt-3 flex-row gap-2">
              <Input
                placeholder="Nueva opción"
                value={newOption}
                onChangeText={setNewOption}
                editable={!isLoading && options.length < 5}
                className="flex-1 text-sm"
              />
              <Button
                size="sm"
                onPress={handleAddOption}
                disabled={!newOption.trim() || options.length >= 5 || isLoading}>
                <Text className="font-semibold text-white">Agregar</Text>
              </Button>
            </View>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Fechas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <View>
              <Text className="mb-2 text-sm font-semibold text-foreground">Inicio de Votación</Text>
              <Text className="mb-2 text-xs text-muted-foreground">
                {startDate.toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                })}{' '}
                {startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Input
                placeholder="2026-04-15T10:00"
                value={startDate.toISOString().slice(0, 16)}
                onChangeText={(text) => {
                  const date = new Date(text);
                  if (!isNaN(date.getTime())) setStartDate(date);
                }}
                editable={!isLoading}
                className="text-base"
              />
            </View>

            <View>
              <Text className="mb-2 text-sm font-semibold text-foreground">Cierre de Urna</Text>
              <Text className="mb-2 text-xs text-muted-foreground">
                {endDate.toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                })}{' '}
                {endDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Input
                placeholder="2026-04-22T18:00"
                value={endDate.toISOString().slice(0, 16)}
                onChangeText={(text) => {
                  const date = new Date(text);
                  if (!isNaN(date.getTime())) setEndDate(date);
                }}
                editable={!isLoading}
                className="text-base"
              />
            </View>

            <View>
              <Text className="mb-2 text-sm font-semibold text-foreground">
                Cierre de Discrepancia (Ausentes)
              </Text>
              <Text className="mb-2 text-xs text-muted-foreground">
                Máximo 30 días naturales según LPH Art. 17.3
              </Text>
              <Text className="mb-2 text-xs text-muted-foreground">
                {absenceDate.toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                })}{' '}
                {absenceDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Input
                placeholder="2026-05-22T18:00"
                value={absenceDate.toISOString().slice(0, 16)}
                onChangeText={(text) => {
                  const date = new Date(text);
                  if (!isNaN(date.getTime())) setAbsenceDate(date);
                }}
                editable={!isLoading}
                className="text-base"
              />
            </View>
          </CardContent>
        </Card>

        <View className="mb-6 flex-row gap-3">
          <Button
            variant="outline"
            size="lg"
            onPress={onCancel}
            disabled={isLoading}
            className="flex-1">
            <Text className="font-semibold">Cancelar</Text>
          </Button>
          <Button
            size="lg"
            onPress={handleSubmit}
            disabled={!isFormValid || isLoading}
            className="flex-1">
            <Text className="font-semibold text-white">
              {isLoading ? 'Guardando...' : 'Guardar Cambios'}
            </Text>
          </Button>
        </View>
      </View>
    </ScrollView>
  );
};

export default PollEditForm;
