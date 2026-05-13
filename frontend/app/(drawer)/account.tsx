import { useRemoveAccountMutation } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { storageService } from '@/api/services/storage.service';
import { useAuth } from '@/context/AuthContext';
import { Drawer } from 'expo-router/drawer';
import { useRouter } from 'expo-router';
import { AlertTriangle, ShieldAlert } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

type RequestError = {
  response?: {
    data?: {
      detail?: string;
    };
  };
};

export default function AccountScreen() {
  const router = useRouter();
  const { user, logoutContext } = useAuth();
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [confirmDialogOpen, setConfirmDialogOpen] = React.useState(false);

  const { mutateAsync, isPending } = useRemoveAccountMutation();

  const handleRemoveAccount = async () => {
    setError('');

    if (!user?.email) {
      setError('No se pudo identificar el correo de la cuenta actual.');
      return;
    }

    if (!password.trim()) {
      setError('Introduce tu contraseña para confirmar la eliminación.');
      return;
    }

    try {
      const response = await mutateAsync({
        email: user.email,
        password,
      });

      setPassword('');
      await storageService.saveRecoveryAccountId(response.id);
      await logoutContext();
      router.replace({
        pathname: '/(auth)/recover-account',
        params: { accountId: response.id },
      });
    } catch (requestError: unknown) {
      const typedError = requestError as RequestError;
      const detail = typedError.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'No se pudo eliminar la cuenta.');
    }
  };

  return (
    <ScrollView className="flex-1 bg-background">
      <Drawer.Screen
        options={{
          title: 'Cuenta',
          drawerItemStyle: { display: 'none' },
        }}
      />

      <View className="mx-auto w-full max-w-3xl px-5 pb-10 pt-8 md:px-8">
        <View className="mb-6 overflow-hidden rounded-[28px] border border-red-200 bg-red-50 px-6 py-7 dark:border-red-900/50 dark:bg-red-950/20">
          <View className="mb-4 size-14 items-center justify-center rounded-2xl bg-red-500/10">
            <Icon as={ShieldAlert} size={30} className="text-red-600 dark:text-red-400" />
          </View>
          <Text variant="h3" className="border-b-0 pb-0 text-left">
            Gestión de cuenta
          </Text>
          <Text className="mt-3 text-muted-foreground">
            Esta acción eliminará tu cuenta global. Tus comunidades seguirán viendo un usuario eliminado, pero tus datos personales dejarán de estar asociados al perfil.
          </Text>
        </View>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Eliminar cuenta</CardTitle>
            <CardDescription>
              Necesitamos tu contraseña actual. Después podrás recuperar la cuenta con el identificador devuelto y tus credenciales.
            </CardDescription>
          </CardHeader>

          <CardContent className="gap-5">
            <View className="gap-2">
              <Text className="text-xs font-semibold uppercase text-muted-foreground">Correo actual</Text>
              <Input value={user?.email ?? ''} editable={false} />
            </View>

            <View className="gap-2">
              <Text className="text-xs font-semibold uppercase text-muted-foreground">Contraseña</Text>
              <Input
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                editable={!isPending}
                placeholder="Confirma tu contraseña"
              />
            </View>

            {error ? (
              <View className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-950/20">
                <Text className="text-sm font-medium text-red-600 dark:text-red-400">{error}</Text>
              </View>
            ) : null}

            <Button
              variant="destructive"
              className="h-12"
              onPress={() => {
                setConfirmDialogOpen(true);
              }}
              disabled={isPending}
            >
              {isPending ? <ActivityIndicator color="#ffffff" /> : <Text>Eliminar mi cuenta</Text>}
            </Button>
          </CardContent>
        </Card>
      </View>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <View className="mb-3 self-center rounded-2xl bg-red-50 p-3 dark:bg-red-950/30">
              <AlertTriangle size={28} color="#dc2626" />
            </View>
            <DialogTitle className="text-center sm:text-center">¿Seguro que quieres eliminar la cuenta?</DialogTitle>
            <DialogDescription className="text-center sm:text-center">
              Tu cuenta se eliminará y se cerrará la sesión actual. Podrás recuperarla más tarde desde el formulario de recuperación.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onPress={() => {
                setConfirmDialogOpen(false);
              }}
              disabled={isPending}
            >
              <Text>Cancelar</Text>
            </Button>
            <Button
              variant="destructive"
              onPress={async () => {
                setConfirmDialogOpen(false);
                await handleRemoveAccount();
              }}
              disabled={isPending}
            >
              {isPending ? <ActivityIndicator color="#ffffff" /> : <Text>Sí, eliminar</Text>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollView>
  );
}
