import React, { useState } from 'react';
import { View, FlatList, Modal, TouchableOpacity } from 'react-native';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AvailableProperty } from '@/types/polls.types';
import {
  AlertCircleIcon,
  AlertOctagon,
  BatteryWarning,
  CircleAlertIcon,
} from 'lucide-react-native';

interface DefaultersModalProps {
  visible: boolean;
  properties: AvailableProperty[];
  selectedDefaulters: string[];
  onConfirm: (defaulterIds: string[]) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

interface PropertyToggle extends AvailableProperty {
  isToggled: boolean;
}

export const DefaultersModal: React.FC<DefaultersModalProps> = ({
  visible,
  properties,
  selectedDefaulters,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const [toggledProperties, setToggledProperties] = useState<PropertyToggle[]>(
    properties.map((prop) => ({
      ...prop,
      isToggled: selectedDefaulters.includes(prop.id),
    }))
  );

  const handleToggle = (propertyId: string) => {
    setToggledProperties((prev) =>
      prev.map((prop) => (prop.id === propertyId ? { ...prop, isToggled: !prop.isToggled } : prop))
    );
  };

  const handleConfirm = () => {
    const defaulterIds = toggledProperties.filter((prop) => prop.isToggled).map((prop) => prop.id);
    onConfirm(defaulterIds);
  };

  const selectedCount = toggledProperties.filter((prop) => prop.isToggled).length;

  const renderPropertyItem = (property: PropertyToggle) => (
    <View className="flex-row items-center justify-between border-b border-border px-4 py-4">
      <View className="flex-1">
        <Text className="text-base font-semibold text-foreground">Puerta {property.number}</Text>
        {property.coefficient && (
          <Text className="mt-1 text-sm text-muted-foreground">
            Coeficiente: {property.coefficient.toFixed(2)}%
          </Text>
        )}
      </View>
      <Switch
        checked={property.isToggled}
        onCheckedChange={() => handleToggle(property.id)}
        className={property.isToggled ? 'bg-red-500' : 'bg-gray-400'}
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View className="flex flex-1 items-center justify-center bg-black bg-opacity-50 p-4">
        <Card className="max-h-[90vh] w-full bg-card">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-lg">Marcar Propiedades Morosas</CardTitle>
            <Text className="mt-2 text-sm text-muted-foreground">
              Las propiedades con mora no podrán votar (Art. 15.2 LPH)
            </Text>
          </CardHeader>

          <CardContent className="pt-4">
            <View className="mb-4 overflow-hidden rounded-lg border border-orange-200 bg-orange-50">
              <Alert
                icon={AlertOctagon}
                className="mb-0 border-0 bg-transparent"
                iconClassName="text-orange-800">
                <AlertTitle className="font-semibold text-orange-800">
                  Seleccionadas: {selectedCount}
                </AlertTitle>
                <AlertDescription className="mt-1 text-sm text-orange-700">
                  {selectedCount > 0
                    ? `${selectedCount} propiedad${selectedCount > 1 ? 'es' : ''} será${selectedCount > 1 ? 'n' : ''} excluida${selectedCount > 1 ? 's' : ''}`
                    : 'Ninguna propiedad marcada'}
                </AlertDescription>
              </Alert>
            </View>

            <View className="max-h-96">
              <FlatList
                data={toggledProperties}
                renderItem={({ item }) => renderPropertyItem(item)}
                keyExtractor={(item) => item.id}
                scrollEnabled={true}
              />
            </View>

            <View className="mt-6 flex-row justify-end gap-3">
              <Button variant="outline" size="default" onPress={onCancel} disabled={isLoading}>
                <Text className="font-semibold">Cancelar</Text>
              </Button>
              <Button size="default" onPress={handleConfirm} disabled={isLoading}>
                <Text className="font-semibold text-white">
                  {isLoading ? 'Guardando...' : 'Confirmar'}
                </Text>
              </Button>
            </View>
          </CardContent>
        </Card>
      </View>
    </Modal>
  );
};

export default DefaultersModal;
