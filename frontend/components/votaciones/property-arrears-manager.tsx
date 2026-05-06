import React, { useState, useEffect, useCallback } from 'react';
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
}

export function PropertyArrearsManager({ associationId }: PropertyArrearsManagerProps) {
  const { colorScheme } = useColorScheme();
  const theme = NAV_THEME[colorScheme ?? 'light'];

  const [properties, setProperties] = useState<PropertyReadResponse[]>([]);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCoefficient, setEditingCoefficient] = useState('');
  const [coefficientError, setCoefficientError] = useState(false);

  const loadProperties = useCallback(async () => {
    try {
      const data = await associationService.getProperties(associationId);
      setProperties(data);
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [associationId]);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  const onRefresh = () => {
    setRefreshing(true);
    loadProperties();
  };

  const toggleArrears = async (property: PropertyReadResponse) => {
    setUpdatingId(property.id);
    const newValue = !property.is_defaulter;
    try {
      const updated = await associationService.updateProperty(property.id, {
        is_defaulter: newValue,
      });
      setProperties((prev) =>
        prev.map((p) => (p.id === property.id ? { ...p, is_defaulter: updated.is_defaulter } : p))
      );
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
    setCoefficientError(false);
  };

  const saveCoefficient = async (property: PropertyReadResponse) => {
    const value = parseFloat(editingCoefficient);
    if (isNaN(value) || value < 0 || value > 100) {
      setCoefficientError(true);
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
      setCoefficientError(false);
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

      <Text className="text-xs text-muted-foreground">
        Marca como morosas las propiedades que deban quedar excluidas del voto y ajusta el coeficiente de cada una.
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
                        Puerta {item.number}
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
                              setCoefficientError(false);
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
                            El coeficiente debe estar entre 0 y 100
                          </Text>
                        )}
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => startEditingCoefficient(item)}
                        className="flex-row items-center gap-1 mt-0.5">
                        <Text className="text-xs text-muted-foreground">
                          Coeficiente: {item.coefficient}%
                        </Text>
                        <Icon as={Pencil} size={12} className="text-muted-foreground" />
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
