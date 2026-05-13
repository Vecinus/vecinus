import {
  unanonymizeRecoveredAccount,
  useLoginMutation,
} from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { storageService } from '@/api/services/storage.service';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

type RequestError = {
  response?: {
    data?: {
      detail?: string;
    };
  };
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function RecoverAccountScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ accountId?: string }>();
  const initialAccountId = Array.isArray(params.accountId) ? params.accountId[0] ?? '' : params.accountId ?? '';
  const { mutateAsync: loginAPI } = useLoginMutation();
  const [accountId, setAccountId] = React.useState(initialAccountId);
  const [password, setPassword] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [avatarUrl, setAvatarUrl] = React.useState('');
  const [error, setError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [storedRecoveryIdLoaded, setStoredRecoveryIdLoaded] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;

    const hydrateRecoveryId = async () => {
      if (initialAccountId) {
        setStoredRecoveryIdLoaded(true);
        return;
      }

      const storedId = await storageService.getRecoveryAccountId();
      if (isMounted && storedId) {
        setAccountId(storedId);
      }
      if (isMounted) {
        setStoredRecoveryIdLoaded(true);
      }
    };

    void hydrateRecoveryId();

    return () => {
      isMounted = false;
    };
  }, [initialAccountId]);

  const handleRecover = async () => {
    setError('');

    if (!accountId.trim() || !password.trim() || !username.trim() || !email.trim()) {
      setError('Completa el identificador, la contraseña, el nuevo nombre y el nuevo correo.');
      return;
    }

    if (!isValidEmail(email.trim())) {
      setError('Introduce un correo electrónico válido.');
      return;
    }

    setIsSubmitting(true);

    try {
      await unanonymizeRecoveredAccount({
        id: accountId.trim(),
        password,
        username: username.trim(),
        email: email.trim().toLowerCase(),
        avatar_url: avatarUrl.trim() || null,
      });

      await loginAPI({
        email: email.trim().toLowerCase(),
        password,
      });

      await storageService.removeRecoveryAccountId();
      router.replace('/');
    } catch (requestError: unknown) {
      const typedError = requestError as RequestError;
      const detail = typedError.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'No se pudo recuperar la cuenta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Recuperar cuenta', headerTransparent: false }} />
      <ScrollView className="flex-1 bg-background">
        <View className="mx-auto w-full max-w-2xl px-5 pb-10 pt-8 md:px-8">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Recuperar cuenta eliminada</CardTitle>
              <CardDescription>
                Introduce tu contraseña y los nuevos datos con los que quieres restaurar tu cuenta. Si acabas de eliminarla, el identificador se rellenará automáticamente.
              </CardDescription>
            </CardHeader>

            <CardContent className="gap-5">
              {accountId && storedRecoveryIdLoaded ? (
                <View className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <Text className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Hemos recuperado automáticamente el identificador de la última cuenta eliminada en este dispositivo.
                  </Text>
                </View>
              ) : null}

              <View className="gap-2">
                <Text className="text-xs font-semibold uppercase text-muted-foreground">Identificador de cuenta</Text>
                <Input
                  value={accountId}
                  onChangeText={setAccountId}
                  editable={!isSubmitting}
                  placeholder="UUID de la cuenta eliminada"
                  autoCapitalize="none"
                />
              </View>

              <View className="gap-2">
                <Text className="text-xs font-semibold uppercase text-muted-foreground">Contraseña actual</Text>
                <Input
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  editable={!isSubmitting}
                  placeholder="Tu contraseña anterior"
                />
              </View>

              <View className="gap-2">
                <Text className="text-xs font-semibold uppercase text-muted-foreground">Nuevo nombre de usuario</Text>
                <Input
                  value={username}
                  onChangeText={setUsername}
                  editable={!isSubmitting}
                  placeholder="Nombre visible en la app"
                />
              </View>

              <View className="gap-2">
                <Text className="text-xs font-semibold uppercase text-muted-foreground">Nuevo correo</Text>
                <Input
                  value={email}
                  onChangeText={setEmail}
                  editable={!isSubmitting}
                  placeholder="correo@ejemplo.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View className="gap-2">
                <Text className="text-xs font-semibold uppercase text-muted-foreground">Avatar URL opcional</Text>
                <Input
                  value={avatarUrl}
                  onChangeText={setAvatarUrl}
                  editable={!isSubmitting}
                  placeholder="https://..."
                  autoCapitalize="none"
                />
              </View>

              {error ? (
                <View className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-950/20">
                  <Text className="text-sm font-medium text-red-600 dark:text-red-400">{error}</Text>
                </View>
              ) : null}

              <Button className="h-12" onPress={handleRecover} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator color="#ffffff" /> : <Text>Recuperar cuenta</Text>}
              </Button>
            </CardContent>
          </Card>
        </View>
      </ScrollView>
    </>
  );
}
