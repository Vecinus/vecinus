import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Image } from 'expo-image';
import * as React from 'react';
import { useState } from 'react';
import { Pressable, type TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useRegisterMutation } from '@/api/auth';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function looksLikeDirectImageUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(parsed.pathname);
  } catch {
    return false;
  }
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
  const avatarUrlInputRef = React.useRef<TextInput>(null);
  const passwordInputRef = React.useRef<TextInput>(null);
  const passwordConfirmInputRef = React.useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [localError, setLocalError] = useState('');
  const [isValidatingAvatar, setIsValidatingAvatar] = useState(false);
  const [pendingAvatarValidationUrl, setPendingAvatarValidationUrl] = useState<string | null>(null);
  const [pendingRegistration, setPendingRegistration] = useState<{
    email: string;
    username: string;
    password: string;
    passwordConfirm: string;
    avatarUrl?: string;
  } | null>(null);

  const { mutateAsync: registerAPI, isPending } = useRegisterMutation();

  function onEmailSubmitEditing() {
    usernameInputRef.current?.focus();
  }

  function onUsernameSubmitEditing() {
    avatarUrlInputRef.current?.focus();
  }

  function onAvatarUrlSubmitEditing() {
    passwordInputRef.current?.focus();
  }

  function onPasswordSubmitEditing() {
    passwordConfirmInputRef.current?.focus();
  }

  async function submitRegistration(payload: {
    email: string;
    username: string;
    password: string;
    passwordConfirm: string;
    avatarUrl?: string;
  }) {
    try {
      await registerAPI({
        email: payload.email,
        password: payload.password,
        password_confirm: payload.passwordConfirm,
        username: payload.username,
        avatar_url: payload.avatarUrl || undefined,
      });

      router.replace('/sign-in');
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { detail?: unknown } } };
      const status = err.response?.status;
      const normalizedDetail = extractErrorMessage(err.response?.data?.detail);

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

    const normalizedAvatarUrl = avatarUrl.trim();
    if (normalizedAvatarUrl && !isValidHttpUrl(normalizedAvatarUrl)) {
      setLocalError('La URL de la imagen debe ser válida y empezar por http:// o https://.');
      return;
    }

    if (normalizedAvatarUrl && !looksLikeDirectImageUrl(normalizedAvatarUrl)) {
      setLocalError('Imagen no válida');
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

    const payload = {
      email: email.trim(),
      username: username.trim(),
      password,
      passwordConfirm,
      avatarUrl: normalizedAvatarUrl || undefined,
    };

    if (!normalizedAvatarUrl) {
      await submitRegistration(payload);
      return;
    }

    setIsValidatingAvatar(true);
    setPendingRegistration(payload);
    setPendingAvatarValidationUrl(normalizedAvatarUrl);
  }

  const isBusy = isPending || isValidatingAvatar;

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
                editable={!isBusy}
                onSubmitEditing={onEmailSubmitEditing}
                returnKeyType="next"
              />
            </View>

            <View className="gap-1.5">
              <Label htmlFor="username">Usuario *</Label>
              <Input
                ref={usernameInputRef}
                id="username"
                placeholder="Tu nombre de usuario"
                autoCapitalize="none"
                value={username}
                onChangeText={setUsername}
                editable={!isBusy}
                onSubmitEditing={onUsernameSubmitEditing}
                returnKeyType="next"
              />
            </View>

            <View className="gap-1.5">
              <Label htmlFor="avatarUrl">URL imagen de perfil</Label>
              <Input
                ref={avatarUrlInputRef}
                id="avatarUrl"
                placeholder="https://ejemplo.com/avatar.jpg"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                value={avatarUrl}
                onChangeText={(value) => {
                  setAvatarUrl(value);
                  if (localError === 'Imagen no válida') {
                    setLocalError('');
                  }
                }}
                editable={!isBusy}
                onSubmitEditing={onAvatarUrlSubmitEditing}
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
                editable={!isBusy}
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
                editable={!isBusy}
                returnKeyType="send"
                onSubmitEditing={onSubmit}
              />
            </View>

            <Button className="w-full mt-2" onPress={onSubmit} disabled={isBusy}>
              <Text>{isBusy ? 'Registrando...' : 'Crear Cuenta'}</Text>
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

      {pendingAvatarValidationUrl ? (
        <Image
          source={{ uri: pendingAvatarValidationUrl }}
          style={{ width: 1, height: 1, opacity: 0 }}
          onLoad={() => {
            const payload = pendingRegistration;
            setPendingAvatarValidationUrl(null);
            setPendingRegistration(null);
            setIsValidatingAvatar(false);
            if (payload) {
              void submitRegistration(payload);
            }
          }}
          onError={() => {
            setPendingAvatarValidationUrl(null);
            setPendingRegistration(null);
            setIsValidatingAvatar(false);
            setLocalError('Imagen no válida');
          }}
        />
      ) : null}
    </View>
  );
}
