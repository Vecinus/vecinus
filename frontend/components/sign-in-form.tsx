import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import * as React from 'react';
import { useState } from 'react';
import { Pressable, type TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useLoginMutation } from '@/api/auth';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function extractErrorMessage(detail: unknown): string {
  if (typeof detail === 'string') {
    return detail.trim();
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object' && 'msg' in item) {
          const msg = (item as { msg?: unknown }).msg;
          return typeof msg === 'string' ? msg.trim() : '';
        }
        return '';
      })
      .filter(Boolean);

    return messages.join(' ');
  }

  if (detail && typeof detail === 'object' && 'msg' in detail) {
    const msg = (detail as { msg?: unknown }).msg;
    return typeof msg === 'string' ? msg.trim() : '';
  }

  return '';
}

export function SignInForm() {
  const router = useRouter();
  const passwordInputRef = React.useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const { mutateAsync: loginAPI, isPending } = useLoginMutation();

  function onEmailSubmitEditing() {
    passwordInputRef.current?.focus();
  }

  async function onSubmit() {
    setLocalError('');
    if (!email || !password) {
      setLocalError('Por favor, completa todos los campos.');
      return;
    }

    if (!isValidEmail(email.trim())) {
      setLocalError('Introduce un correo electrónico válido.');
      return;
    }

    try {
      await loginAPI({ email, password });
      router.replace('/');
    } catch (error: any) {
      const status = error?.response?.status;
      const normalizedDetail = extractErrorMessage(error?.response?.data?.detail);

      if (status === 401) {
        setLocalError(normalizedDetail || 'Credenciales incorrectas.');
        return;
      }

      setLocalError(normalizedDetail || 'No se pudo iniciar sesión. Inténtalo de nuevo.');
    }
  }
  return (
    <View className="gap-6">
      <Card className="border-border/0 shadow-none sm:border-border sm:shadow-sm sm:shadow-black/5">
        <CardHeader>
          <CardTitle className="text-center text-xl sm:text-left">Inicie sesión</CardTitle>
          <CardDescription className="text-center sm:text-left">
            ¡Bienvenido de nuevo! Por favor, ingrese sus credenciales para acceder a su cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent className="gap-6">
          <View className="gap-6">
            {localError ? (
              <Text className="text-center font-medium text-destructive">{localError}</Text>
            ) : null}

            <View className="gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                placeholder="m@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                editable={!isPending}
                onSubmitEditing={onEmailSubmitEditing}
                returnKeyType="next"
              />
            </View>
            <View className="gap-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                ref={passwordInputRef}
                id="password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                editable={!isPending}
                returnKeyType="send"
                onSubmitEditing={onSubmit}
              />
            </View>
            <Button className="w-full" onPress={onSubmit} disabled={isPending}>
              <Text>{isPending ? 'Cargando...' : 'Continuar'}</Text>
            </Button>
          </View>
          <Text className="text-center text-sm">
            ¿No tienes una cuenta?{' '}
            <Pressable
              onPress={() => {
                router.replace('/sign-up');
              }}>
              <Text className="text-sm underline underline-offset-4">Regístrate</Text>
            </Pressable>
          </Text>
          <Text className="text-center text-sm text-muted-foreground">
            ¿Tu cuenta fue anonimizada?{' '}
            <Pressable
              onPress={() => {
                router.push('/recover-account');
              }}>
              <Text className="text-sm underline underline-offset-4">Recupérala aquí</Text>
            </Pressable>
          </Text>
          <View className="border-t border-border pt-4 mt-4">
            <Pressable onPress={() => router.push('/(auth)/legal')}>
              <Text className="text-center text-xs text-muted-foreground underline">
                Consulta nuestros Términos y Condiciones
              </Text>
            </Pressable>
          </View>
        </CardContent>
      </Card>
    </View>
  );
}
