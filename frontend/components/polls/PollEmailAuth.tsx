import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Mail, CheckCircle } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { pollsApi } from '@/api/polls';

interface PollEmailAuthProps {
  pollId: string;
  userEmail: string;
  onTokenObtained: (token: string) => void;
  onCancel: () => void;
}

export const PollEmailAuth: React.FC<PollEmailAuthProps> = ({
  pollId,
  userEmail,
  onTokenObtained,
  onCancel,
}) => {
  const [step, setStep] = useState<'initial' | 'code'>('initial');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleRequestCode = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await pollsApi.requestAuthToken(pollId);
      setStep('code');
    } catch (err: any) {
      setError(err.message || 'Error al solicitar el código');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitCode = async () => {
    if (!code.trim()) {
      setError('Ingresa el código');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      onTokenObtained(code);
      setShowSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Error al validar el código');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'initial') {
    return (
      <ScrollView className="flex-1 bg-background">
        <View className="px-4 py-6">
          <Card className="mb-6">
            <CardHeader>
              <View>
                <CardTitle className="text-lg">Autenticación Requerida</CardTitle>
              </View>
            </CardHeader>
            <CardContent>
              <View>
                <Text className="mb-4 text-sm text-foreground">
                  Para participar en esta votación, te enviaremos un código de autenticación a tu
                  email registrado.
                </Text>
                <View className="mb-6 flex-row items-center rounded-lg bg-blue-50 p-4">
                  <Mail className="mr-3 text-blue-600" size={20} />
                  <Text className="flex-1 text-sm font-semibold text-blue-900">{userEmail}</Text>
                </View>
                <Text className="mb-6 text-xs text-muted-foreground">
                  Este código es personal e intransferible. Revisa tu carpeta de spam si no lo
                  recibiste.
                </Text>
              </View>
            </CardContent>
          </Card>

          <View className="mb-4">
            <Button size="lg" onPress={handleRequestCode} disabled={isLoading}>
              <Text className="text-base font-semibold text-white">
                {isLoading ? 'Enviando...' : 'Enviar Código'}
              </Text>
            </Button>
          </View>

          <Button size="lg" variant="outline" onPress={onCancel} disabled={isLoading}>
            <Text className="text-base font-semibold text-foreground">Cancelar</Text>
          </Button>

          {error && (
            <View className="mt-4 overflow-hidden rounded-lg border border-red-200 bg-red-50">
              <Alert
                icon={AlertCircle}
                className="border-0 bg-transparent"
                iconClassName="text-red-800">
                <AlertTitle className="font-bold text-red-800">Error</AlertTitle>
                <AlertDescription className="mt-1 text-sm text-red-700">{error}</AlertDescription>
              </Alert>
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  if (step === 'code') {
    return (
      <ScrollView className="flex-1 bg-background">
        <View className="px-4 py-6">
          <Card className="mb-6">
            <CardHeader>
              <View>
                <CardTitle className="text-lg">Ingresa tu Código</CardTitle>
              </View>
            </CardHeader>
            <CardContent>
              <View>
                <Text className="mb-4 text-sm text-foreground">
                  Te hemos enviado un código a {userEmail}. Ingrésalo aquí para continuar.
                </Text>
                <View className="mb-6">
                  <Text className="mb-2 text-sm font-semibold text-foreground">Código</Text>
                  <Input
                    placeholder="Ingresa el código de 8 caracteres"
                    value={code}
                    onChangeText={setCode}
                    editable={!isLoading}
                    className="text-base"
                    maxLength={36}
                  />
                </View>
                <Text className="mb-6 text-xs text-muted-foreground">
                  El código expira en 1 hora. No lo compartas con nadie.
                </Text>
              </View>
            </CardContent>
          </Card>

          <View className="mb-4">
            <Button size="lg" onPress={handleSubmitCode} disabled={isLoading || !code.trim()}>
              <Text className="text-base font-semibold text-white">
                {isLoading ? 'Validando...' : 'Continuar'}
              </Text>
            </Button>
          </View>

          <Button
            size="lg"
            variant="outline"
            onPress={() => setStep('initial')}
            disabled={isLoading}>
            <Text className="text-base font-semibold text-foreground">Atrás</Text>
          </Button>

          {error && (
            <View className="mt-4 overflow-hidden rounded-lg border border-red-200 bg-red-50">
              <Alert
                icon={AlertCircle}
                className="border-0 bg-transparent"
                iconClassName="text-red-800">
                <AlertTitle className="font-bold text-red-800">Error</AlertTitle>
                <AlertDescription className="mt-1 text-sm text-red-700">{error}</AlertDescription>
              </Alert>
            </View>
          )}

          {showSuccess && (
            <View className="mt-4 overflow-hidden rounded-lg border border-green-200 bg-green-50">
              <Alert
                icon={CheckCircle}
                className="border-0 bg-transparent"
                iconClassName="text-green-800">
                <AlertTitle className="font-bold text-green-800">¡Verificado!</AlertTitle>
                <AlertDescription className="mt-1 text-sm text-green-700">
                  Código validado correctamente
                </AlertDescription>
              </Alert>
            </View>
          )}
        </View>
      </ScrollView>
    );
  }
};

export default PollEmailAuth;
