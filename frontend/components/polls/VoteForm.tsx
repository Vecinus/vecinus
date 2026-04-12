import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Text } from '@/components/ui/text';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Poll } from '@/types/polls.types';
import { AlertCircle, CircleAlertIcon } from 'lucide-react-native';

interface VoteFormProps {
  poll: Poll;
  coefficient: number;
  onSubmit: (selectedOption: string, optionIndex: number) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  isDefaulter?: boolean;
}

export const VoteForm: React.FC<VoteFormProps> = ({
  poll,
  coefficient,
  onSubmit,
  isLoading = false,
  error = null,
  isDefaulter = false,
}) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [rgpdAccepted, setRgpdAccepted] = useState(false);

  const handleSubmit = async () => {
    if (!selectedOption || selectedIndex === null || !rgpdAccepted) return;
    await onSubmit(selectedOption, selectedIndex);
  };

  const isFormValid = selectedOption && rgpdAccepted && !isLoading;

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="px-4 py-6">
        {/* Cambiado a operador ternario para evitar el renderizado de strings vacíos */}
        {isDefaulter ? (
          <Alert icon={AlertCircle} className="mb-6 border-red-500 bg-red-50">
            <AlertTitle className="text-base font-bold text-red-800">
              No tienes derecho a voto
            </AlertTitle>
            <AlertDescription className="mt-2 text-sm text-red-700">
              Según el Art. 15.2 de la Ley de Propiedad Horizontal, no puedes ejercer el derecho a
              voto por deudas pendientes con la comunidad. Sin embargo, puedes ver los resultados
              finales.
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Cambiado a operador ternario */}
        {error ? (
          <Alert icon={CircleAlertIcon} className="mb-6 border-red-500 bg-red-50">
            <AlertTitle className="font-bold text-red-800">Error</AlertTitle>
            <AlertDescription className="mt-1 text-sm text-red-700">{error}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="mb-6">
          <CardHeader>
            <View>
              <CardTitle className="text-lg">{poll.title}</CardTitle>

              {/* Cambiado a operador ternario */}
              {poll.description ? (
                <CardDescription className="mt-1 text-sm text-muted-foreground">
                  {poll.description}
                </CardDescription>
              ) : null}
            </View>
          </CardHeader>
        </Card>

        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardHeader className="pb-2">
            <View>
              <Text className="text-sm font-semibold text-blue-900">Tu Cuota de Participación</Text>
            </View>
          </CardHeader>
          <CardContent>
            <View>
              <Text className="text-2xl font-bold text-blue-600">{coefficient.toFixed(2)}%</Text>
              <Text className="mt-1 text-xs text-blue-700">
                Este porcentaje es tu peso en la votación según la Ley de Propiedad Horizontal
              </Text>
            </View>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Selecciona tu opción</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={selectedIndex !== null ? `${selectedIndex}` : ''}
              onValueChange={(value) => {
                const index = parseInt(value);
                setSelectedIndex(index);
                setSelectedOption(poll.options[index]);
              }}>
              {poll.options.map((option, index) => (
                <View
                  key={`option-${index}`}
                  className="mb-3 flex-row items-center border-b border-border pb-3">
                  <RadioGroupItem value={`${index}`} id={`option-${index}`} />
                  <Text className="ml-3 flex-1 text-base text-foreground">{option}</Text>
                </View>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <Text className="text-sm font-semibold text-amber-900">Aviso de Privacidad (RGPD)</Text>
          </CardHeader>
          <CardContent>
            <Text className="mb-4 text-xs leading-5 text-amber-800">
              Declaro y acepto que mi voto sea registrado vinculadamente a mi identidad y cuota de
              participación, de conformidad con la Ley de Propiedad Horizontal y regulaciones de
              protección de datos. Los datos serán tratados de forma segura y solo utilizados para
              el escrutinio de esta votación y auditoría legal.
            </Text>
            <View className="flex-row items-start gap-2">
              <Checkbox checked={rgpdAccepted} onCheckedChange={setRgpdAccepted} />
              <Text className="mt-1 flex-1 text-sm text-foreground">
                He leído y acepto las condiciones
              </Text>
            </View>
          </CardContent>
        </Card>

        <View>
          <Button
            size="lg"
            disabled={!isFormValid}
            onPress={handleSubmit}
            className={!isFormValid ? 'opacity-50' : ''}>
            <Text className="text-base font-semibold text-white">
              {isLoading ? 'Registrando voto...' : 'Confirmar voto'}
            </Text>
          </Button>
        </View>

        <View>
          <Text className="mt-4 text-center text-xs text-muted-foreground">
            Una vez confirmado, tu voto no podrá ser modificado
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

export default VoteForm;
