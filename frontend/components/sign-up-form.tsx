import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import * as React from 'react';
import { useState } from 'react';
import { Pressable, type TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

// Asegúrate de exponer este hook en tu archivo de API al igual que useLoginMutation
import { useRegisterMutation } from '@/api/auth';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
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

export function SignUpForm() {
  const router = useRouter();
  const usernameInputRef = React.useRef<TextInput>(null);
  const passwordInputRef = React.useRef<TextInput>(null);
  const passwordConfirmInputRef = React.useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [localError, setLocalError] = useState('');

  const { mutateAsync: registerAPI, isPending } = useRegisterMutation();

  function onEmailSubmitEditing() {
    usernameInputRef.current?.focus();
  }

  function onUsernameSubmitEditing() {
    passwordInputRef.current?.focus();
  }

  function onPasswordSubmitEditing() {
    passwordConfirmInputRef.current?.focus();
  }

  async function onSubmit() {
    setLocalError('');
    
    if (!email || !username || !password || !passwordConfirm) {
      setLocalError('Por favor, completa todos los campos obligatorios.');
      return;
    }

    if (!isValidEmail(email.trim())) {
      setLocalError('Introduce un correo electrónico válido.');
      return;
    }

    if (password.length < 8 || password.length > 16) {
      setLocalError('La contraseña debe tener entre 8 y 16 caracteres.');
      return;
    }

    if (!timingSafeEqual(password, passwordConfirm)) {
      setLocalError('Las contraseñas no coinciden.');
      return;
    }

    try {
      await registerAPI({ 
        email: email.trim(), 
        password, 
        password_confirm: passwordConfirm,
        username: username.trim()
      });
      
      // Redirigimos al login tras el registro exitoso
      router.replace('/sign-in');
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { detail?: unknown } } };
      const status = err?.response?.status;
      const normalizedDetail = extractErrorMessage(err?.response?.data?.detail);

      if (status === 409) {
        setLocalError(normalizedDetail || 'El email o nombre de usuario ya está en uso.');
        return;
      }

      if (status === 400) {
        setLocalError(normalizedDetail || 'Datos inválidos. Comprueba tu información.');
        return;
      }

      setLocalError(normalizedDetail || 'No se pudo registrar el usuario. Inténtalo de nuevo.');
    }
  }

  return (
    <View className="gap-6 w-full max-w-sm">
      <Card className="border-border/0 shadow-none sm:border-border sm:shadow-sm sm:shadow-black/5">
        <CardHeader>
          <CardTitle className="text-center text-xl sm:text-left">Regístrate</CardTitle>
          <CardDescription className="text-center sm:text-left">
            Crea tu cuenta para unirte a tu comunidad.
          </CardDescription>
        </CardHeader>
        <CardContent className="gap-6">
          <View className="gap-4">
            {localError ? (
              <Text className="text-center font-medium text-destructive">{localError}</Text>
            ) : null}

            <View className="gap-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                placeholder="example@example.com"
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
              <Label htmlFor="username">Usuario *</Label>
              <Input
                ref={usernameInputRef}
                id="username"
                placeholder='Tú nombre de usuario'
                autoCapitalize="none"
                value={username}
                onChangeText={setUsername}
                editable={!isPending}
                onSubmitEditing={onUsernameSubmitEditing}
                returnKeyType="next"
              />
            </View>

            <View className="gap-1.5">
              <Label htmlFor="password">Contraseña *</Label>
              <Input
                ref={passwordInputRef}
                id="password"
                secureTextEntry
                placeholder="De 8 a 16 caracteres"
                value={password}
                onChangeText={setPassword}
                editable={!isPending}
                returnKeyType="next"
                onSubmitEditing={onPasswordSubmitEditing}
              />
            </View>

            <View className="gap-1.5">
              <Label htmlFor="passwordConfirm">Confirmar Contraseña *</Label>
              <Input
                ref={passwordConfirmInputRef}
                id="passwordConfirm"
                secureTextEntry
                placeholder="Repite tu contraseña"
                value={passwordConfirm}
                onChangeText={setPasswordConfirm}
                editable={!isPending}
                returnKeyType="send"
                onSubmitEditing={onSubmit}
              />
            </View>
            
            <Button className="w-full mt-2" onPress={onSubmit} disabled={isPending}>
              <Text>{isPending ? 'Registrando...' : 'Crear Cuenta'}</Text>
            </Button>
          </View>
          <Text className="text-center text-sm">
            ¿Ya tienes una cuenta?{' '}
            <Pressable
              onPress={() => {
                router.replace('/sign-in');
              }}>
              <Text className="text-sm underline underline-offset-4">Inicia sesión</Text>
            </Pressable>
          </Text>
        </CardContent>
      </Card>
    </View>
  );
}