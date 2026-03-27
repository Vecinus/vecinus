import { SocialConnections } from '@/components/social-connections';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import * as React from 'react';
import { useState } from 'react';
import { Pressable, type TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useLoginMutation } from '@/api/auth'; // Importamos el nuevo hook

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

    try {
      await loginAPI({ email, password });
      router.replace('/'); 
    } catch (error) {
      console.error('Login error:', error);
      setLocalError('Credenciales incorrectas o problema de red.');
    }
  }
  return (
    <View className="gap-6">
      <Card className="border-border/0 sm:border-border shadow-none sm:shadow-sm sm:shadow-black/5">
        <CardHeader>
          <CardTitle className="text-center text-xl sm:text-left">Sign in to your app</CardTitle>
          <CardDescription className="text-center sm:text-left">
            Welcome back! Please sign in to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="gap-6">
          <View className="gap-6">
            
            {localError ? (
              <Text className="text-destructive text-center font-medium">{localError}</Text>
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
              <Label htmlFor="password">Password</Label>
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
              <Text>{isPending ? 'Cargando...' : 'Continue'}</Text>
            </Button>
          </View>
          <Text className="text-center text-sm">
            Don&apos;t have an account?{' '}
            <Pressable
              onPress={() => {
                // TODO: Navigate to sign up screen
              }}>
              <Text className="text-sm underline underline-offset-4">Sign up</Text>
            </Pressable>
          </Text>
          <View className="flex-row items-center">
            <Separator className="flex-1" />
            <Text className="text-muted-foreground px-4 text-sm">or</Text>
            <Separator className="flex-1" />
          </View>
          <SocialConnections />
        </CardContent>
      </Card>
    </View>
  );
}
