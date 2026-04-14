import React from 'react';
import { View, ScrollView } from 'react-native';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Mail, AlertCircle } from 'lucide-react-native';

interface PollEmailAuthProps {
  pollId: string;
  userEmail: string;
  onCancel: () => void;
}

export const PollEmailAuth: React.FC<PollEmailAuthProps> = ({ userEmail, onCancel }) => {
  return (
    <ScrollView className="flex-1 bg-background">
      <View className="px-4 py-6">
        <Card className="mb-6">
          <CardHeader>
            <View>
              <CardTitle className="text-lg">Revisa tu Correo Electrónico</CardTitle>
            </View>
          </CardHeader>
          <CardContent>
            <View>
              <View className="mb-6 flex-row items-center space-x-3 rounded-lg bg-blue-50 p-4">
                <Mail className="text-blue-600" size={24} />
                <View className="flex-1">
                  <Text className="text-xs text-blue-600"> Enviado a:</Text>
                  <Text className="text-sm font-semibold text-blue-900"> {userEmail}</Text>
                </View>
              </View>

              <Text className="mb-4 text-sm font-semibold text-foreground">
                Hemos enviado un enlace de votación a tu correo electrónico.
              </Text>

              <Text className="mb-6 text-sm text-muted-foreground">
                Abre el enlace en el correo para acceder a la votación. El enlace contiene tu código
                de autenticación y te llevará directamente a la página de votación.
              </Text>

              <View className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <Text className="text-xs font-semibold text-amber-900">Consejo:</Text>
                <Text className="mt-2 text-xs text-amber-800">
                  Si no encuentras el correo, revisa tu carpeta de spam o correo no deseado.
                </Text>
              </View>
            </View>
          </CardContent>
        </Card>

        <Button size="lg" variant="outline" onPress={onCancel}>
          <Text className="text-base font-semibold text-foreground">Volver</Text>
        </Button>
      </View>
    </ScrollView>
  );
};

export default PollEmailAuth;
