import React, { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { AlertTriangle, Building2, RefreshCw, Save, X, Pencil } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { associationService } from '@/api/services/association.service';
import { PropertyReadResponse } from '@/types/poll.types';
import { NAV_THEME } from '@/lib/theme';
import { useColorScheme } from 'nativewind';
import { cn } from '@/lib/utils';

interface PropertyArrearsManagerProps {
  associationId: string;
  pollId?: string;
  onCoefficientChange?: (total: number) => void;
  forceEquitable?: boolean;
}

export function PropertyArrearsManager({ associationId, pollId, onCoefficientChange, forceEquitable }: PropertyArrearsManagerProps) {
  const { colorScheme } = useColorScheme();
  const theme = NAV_THEME[colorScheme ?? 'light'];

  const [properties, setProperties] = useState<PropertyReadResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCoefficient, setEditingCoefficient] = useState('');
  const [coefficientError, setCoefficientError] = useState<string | null>(null);
  const [distributing, setDistributing] = useState(false);
  const [isEquitableMode, setIsEquitableMode] = useState(true);
  const storageKey = pollId ? `poll_coefficients_${pollId}` : null;

  const detectAndSetMode = useCallback((props: PropertyReadResponse[]) => {
    const eligible = props.filter((p) => !p.is_defaulter);
    if (eligible.length > 1) {
      const firstCoef = eligible[0].coefficient;
      const isEq = eligible.every((p) => Math.abs(p.coefficient - firstCoef) < 0.01);
      setIsEquitableMode(isEq);
    }
  }, []);

  const distributeEquitably = useCallback(async (props: PropertyReadResponse[]) => {
    const eligibleProperties = props.filter((property) => !property.is_defaulter);
    if (eligibleProperties.length === 0) return;

    const baseValue = Math.floor((10000 / eligibleProperties.length)) / 100;
    const remainder = parseFloat((100 - baseValue * eligibleProperties.length).toFixed(2));

    const coefficientById = eligibleProperties.reduce<Record<string, number>>((acc, property, index) => {
      acc[property.id] = parseFloat(
        ((index === 0 ? baseValue + remainder : baseValue).toFixed(2)).toString()
      );
      return acc;
    }, {});

    const updates = props.map((property) => ({
      id: property.id,
      coefficient: property.is_defaulter ? 0 : coefficientById[property.id],
    }));

    try {
      const updatedProperties = await Promise.all(
        updates.map((update) =>
          associationService.updateProperty(update.id, { coefficient: update.coefficient })
        )
      );
      setProperties(updatedProperties);
      setCoefficientError(null);
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      console.error('Error distributing coefficients:', detail || error);
    }
  }, []);

  const loadProperties = useCallback(async () => {
    try {
      const data = await associationService.getVotingProperties(associationId);

      if (forceEquitable) {
        setProperties(data);
        await distributeEquitably(data);
        return;
      }

      if (storageKey) {
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          const savedCoefs: Record<string, number> = JSON.parse(stored);
          const overridden = data.map((p) => ({
            ...p,
            coefficient: savedCoefs[p.id] ?? p.coefficient,
          }));
          setProperties(overridden);
          detectAndSetMode(overridden);
          return;
        }
      }

      const totalSaved = data.reduce((sum, p) => sum + p.coefficient, 0);
      if (totalSaved === 0) {
        setProperties(data);
        await distributeEquitably(data);
      } else {
        setProperties(data);
        detectAndSetMode(data);
      }
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setLoading(false);
    }
  }, [associationId, detectAndSetMode, distributeEquitably, forceEquitable, storageKey]);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  useEffect(() => {
    if (properties.length > 0) {
      const total = properties.reduce((sum, p) => sum + p.coefficient, 0);
      onCoefficientChange?.(total);
      if (storageKey) {
        const map = properties.reduce<Record<string, number>>((acc, p) => {
          acc[p.id] = p.coefficient;
          return acc;
        }, {});
        AsyncStorage.setItem(storageKey, JSON.stringify(map));
      }
    }
  }, [onCoefficientChange, properties, storageKey]);

  const onRefresh = () => {
    loadProperties();
  };

  const toggleArrears = async (property: PropertyReadResponse) => {
    setUpdatingId(property.id);
    const newValue = !property.is_defaulter;
    try {
      const updated = await associationService.updateProperty(property.id, {
        is_defaulter: newValue,
      });
      const updatedProperties = properties.map((p) =>
        p.id === property.id ? { ...p, is_defaulter: updated.is_defaulter } : p
      );
      setProperties(updatedProperties);

      // Redistribuir equitativamente si está en modo equitativo
      if (isEquitableMode) {
        await distributeEquitably(updatedProperties);
      }
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      console.error('Error updating property:', detail || error);
    } finally {
      setUpdatingId(null);
    }
  };

  const startEditingCoefficient = (property: PropertyReadResponse) => {
    setEditingId(property.id);
    setEditingCoefficient(String(property.coefficient));
  };

  const cancelEditingCoefficient = () => {
    setEditingId(null);
    setEditingCoefficient('');
    setCoefficientError(null);
  };

  const totalCoefficient = properties.reduce((sum, property) => sum + property.coefficient, 0);

  const toggleWeightedMode = async () => {
    if (!isEquitableMode) {
      // Cambiando a modo equitativo: distribuir equitativamente
      await distributeCoefficients();
    }
    setIsEquitableMode(!isEquitableMode);
  };

  const distributeCoefficients = async () => {
    const eligibleProperties = properties.filter((property) => !property.is_defaulter);
    if (eligibleProperties.length === 0) return;

    setDistributing(true);
    const baseValue = Math.floor((10000 / eligibleProperties.length)) / 100;
    const remainder = parseFloat((100 - baseValue * eligibleProperties.length).toFixed(2));

    const coefficientById = eligibleProperties.reduce<Record<string, number>>((acc, property, index) => {
      acc[property.id] = parseFloat(
        ((index === 0 ? baseValue + remainder : baseValue).toFixed(2)).toString()
      );
      return acc;
    }, {});

    const updates = properties.map((property) => ({
      id: property.id,
      coefficient: property.is_defaulter ? 0 : coefficientById[property.id],
    }));

    try {
      const updatedProperties = await Promise.all(
        updates.map((update) =>
          associationService.updateProperty(update.id, { coefficient: update.coefficient })
        )
      );
      setProperties(updatedProperties);
      setCoefficientError(null);
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      console.error('Error distributing coefficients:', detail || error);
    } finally {
      setDistributing(false);
    }
  };

  const saveCoefficient = async (property: PropertyReadResponse) => {
    if (isEquitableMode) {
      setCoefficientError('No se puede editar manualmente en modo equitativo.');
      return;
    }

    const value = parseFloat(editingCoefficient);

    if (isNaN(value) || value < 0 || value > 100) {
      setCoefficientError('El coeficiente debe estar entre 0 y 100.');
      return;
    }

    setUpdatingId(property.id);
    try {
      const updated = await associationService.updateProperty(property.id, {
        coefficient: value,
      });
      setProperties((prev) =>
        prev.map((p) => (p.id === property.id ? { ...p, coefficient: updated.coefficient } : p))
      );
      setEditingId(null);
      setEditingCoefficient('');
      setCoefficientError(null);
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      console.error('Error updating coefficient:', detail || error);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <View className="items-center py-8">
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text className="text-muted-foreground mt-2">Cargando propiedades...</Text>
      </View>
    );
  }

  if (properties.length === 0) {
    return (
      <View className="items-center py-8">
        <Text className="text-muted-foreground">No hay propiedades registradas en esta comunidad.</Text>
      </View>
    );
  }

  const defaulterCount = properties.filter((p) => p.is_defaulter).length;

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Icon as={Building2} size={18} className="text-foreground" />
          <Text className="text-sm font-bold text-foreground">Propiedades ({properties.length})</Text>
        </View>
        <Button variant="ghost" size="sm" onPress={onRefresh} className="px-2">
          <Icon as={RefreshCw} size={14} className="text-muted-foreground" />
        </Button>
      </View>

      {defaulterCount > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-3 flex-row items-center gap-2">
            <Icon as={AlertTriangle} size={16} className="text-yellow-600" />
            <Text className="text-xs text-yellow-600 font-medium">
              {defaulterCount} {defaulterCount === 1 ? 'propiedad marcada' : 'propiedades marcadas'} como morosa{defaulterCount > 1 ? 's' : ''} — quedarán excluidas del censo electoral (Art. 15.2 LPH)
            </Text>
          </CardContent>
        </Card>
      )}

      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-xs text-muted-foreground">
          Total coeficiente: {totalCoefficient.toFixed(2)}% • Modo: {isEquitableMode ? 'Equitativo' : 'Ponderado'}
        </Text>
        <Button
          variant="outline"
          size="sm"
          onPress={toggleWeightedMode}
          disabled={distributing}
        >
          {isEquitableMode ? 'Repartir ponderadamente' : 'Repartir equitativamente'}
        </Button>
      </View>

      {!isEquitableMode && Math.abs(totalCoefficient - 100) > 0.01 && (
        <Text className="text-xs text-amber-600">
          Suma actual: {totalCoefficient.toFixed(2)}%. Debe ser exactamente 100% para poder crear la votación.
        </Text>
      )}

      <Text className="text-xs text-muted-foreground">
        {isEquitableMode
          ? 'Los porcentajes se ajustan automáticamente de forma equitativa. Marca propiedades como morosas para excluirlas.'
          : 'Ajusta manualmente los porcentajes de cada propiedad. La suma total debe ser exactamente 100% al crear la votación.'}
      </Text>

      <FlatList
        data={properties}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View className="h-2" />}
        renderItem={({ item }) => {
          const isUpdating = updatingId === item.id;
          const isEditing = editingId === item.id;

          return (
            <Card className={item.is_defaulter ? 'border-destructive/30 bg-destructive/5' : 'border-border'}>
              <CardContent className="p-3">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 mr-3">
                    <View className="flex-row items-center gap-2 mb-1">
                      <Text className="text-sm font-medium text-foreground">
                        {item.number}
                      </Text>
                      {item.is_defaulter && (
                        <View className="rounded-md bg-destructive/10 px-1.5 py-0.5">
                          <Text className="text-[10px] font-bold text-destructive uppercase">Moroso</Text>
                        </View>
                      )}
                    </View>

                    {isEditing ? (
                      <View className="mt-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-xs text-muted-foreground">Coef.:</Text>
                          <Input
                            value={editingCoefficient}
                            onChangeText={(v) => {
                              setEditingCoefficient(v);
                              setCoefficientError(null);
                            }}
                            className={cn(
                              'h-8 w-20 text-xs px-2',
                              coefficientError && 'border-destructive'
                            )}
                            keyboardType="decimal-pad"
                            placeholder="0.00"
                          />
                          <TouchableOpacity
                            onPress={() => saveCoefficient(item)}
                            disabled={isUpdating}
                            className="p-1 rounded-full bg-primary/10">
                            {isUpdating ? (
                              <ActivityIndicator size="small" color={theme.colors.primary} />
                            ) : (
                              <Icon as={Save} size={14} className="text-primary" />
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity onPress={cancelEditingCoefficient} className="p-1 rounded-full bg-muted">
                            <Icon as={X} size={14} className="text-muted-foreground" />
                          </TouchableOpacity>
                        </View>
                        {coefficientError && (
                          <Text className="text-[10px] text-destructive mt-1">
                            {coefficientError}
                          </Text>
                        )}
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => !isEquitableMode && startEditingCoefficient(item)}
                        disabled={isEquitableMode}
                        className={cn(
                          "flex-row items-center gap-1 mt-0.5",
                          isEquitableMode && "opacity-50"
                        )}>
                        <Text className="text-xs text-muted-foreground">
                          Coeficiente: {item.coefficient}%
                        </Text>
                        {!isEquitableMode && (
                          <Icon as={Pencil} size={12} className="text-muted-foreground" />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>

                  <View className="flex-row items-center gap-2">
                    {isUpdating && !isEditing ? (
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                      <Switch
                        checked={item.is_defaulter}
                        onCheckedChange={() => toggleArrears(item)}
                      />
                    )}
                  </View>
                </View>
              </CardContent>
            </Card>
          );
        }}
      />
    </View>
  );
}
