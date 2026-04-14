import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { Key } from 'lucide-react-native';

// Importamos el nuevo mutation de React Query
import { useAcceptInvitationMutation } from '@/api/auth';

// Componentes de UI
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from '@/components/ui/card';

export default function AcceptInvitationScreen() {
    const { token } = useLocalSearchParams<{ token: string }>();
    const router = useRouter();

    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Usamos la mutación que creamos en api/auth.ts
    const { mutateAsync: acceptInvitation, isPending } = useAcceptInvitationMutation();

    // Vista de error si no hay token
    if (!token) {
        return (
            <View className="flex-1 items-center justify-center p-4 bg-background">
                <Image
                    source={require('@/assets/logos/vecinusicon.png')}
                    style={{ width: 230, height: 230 }}
                    resizeMode="contain"
                />
                <Card className="w-full max-w-sm">
                    <CardHeader className="items-center">
                        <CardTitle className="text-destructive text-2xl font-extrabold mb-2">
                            Error de Invitación
                        </CardTitle>
                        <CardDescription className="text-center text-base">
                            No se encontró el token de la invitación en el enlace.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Button
                            className="w-full"
                            onPress={() => router.replace('/(auth)/sign-in')}
                        >
                            <Text>Ir a Iniciar Sesión</Text>
                        </Button>
                    </CardFooter>
                </Card>
            </View>
        );
    }

    const handleAccept = async () => {
        if (!password || password.length < 6) {
            setErrorMessage("La contraseña debe tener al menos 6 caracteres.");
            return;
        }

        setErrorMessage('');

        try {
            // Ejecutamos la mutación
            await acceptInvitation({ invitation_token: token, password });

            // Si llega hasta aquí, onSuccess (en api/auth.ts) ya actualizó el AuthContext
            router.replace('/(drawer)');

        } catch (error: unknown) {
            const err = error as { response?: { data?: { detail?: string } }; message?: string };

            const errorMessage =
                err.response?.data?.detail ||
                err.message ||
                'Ocurrió un error al aceptar la invitación.';

            setErrorMessage(errorMessage);
        }
    };

    return (
        <View className="flex-1 items-center justify-center p-4 bg-background">
            <Image
                source={require('@/assets/logos/vecinusicon.png')}
                style={{ width: 230, height: 230 }}
                resizeMode="contain"
            />

            <Card className="w-full max-w-sm">
                <CardHeader className="items-center">
                    <CardTitle className="text-2xl font-extrabold mb-2">
                        Aceptar Invitación
                    </CardTitle>
                    <CardDescription className="text-center text-base">
                        Para aceptar la invitación, necesitamos que configures tu acceso.
                    </CardDescription>
                </CardHeader>

                <CardContent className="gap-4">
                    <View className="gap-2">
                        <Text className="text-sm font-semibold ml-1">Contraseña</Text>

                        <View className="relative justify-center">
                            <View className="absolute left-3 z-10">
                                <Key
                                    size={20}
                                    color={errorMessage ? "#EF4444" : "#94A3B8"}
                                />
                            </View>
                            <Input
                                className={`pl-10 h-14 rounded-xl ${errorMessage ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                                placeholder="Introduce tu contraseña"
                                secureTextEntry
                                value={password}
                                onChangeText={(text) => {
                                    setPassword(text);
                                    if (errorMessage) setErrorMessage('');
                                }}
                                autoCapitalize="none"
                            />
                        </View>

                        {errorMessage ? (
                            <Text className="text-destructive text-sm font-medium mt-1 ml-1">
                                {errorMessage}
                            </Text>
                        ) : null}
                    </View>
                </CardContent>

                <CardFooter>
                    <Button
                        className="w-full h-14 rounded-xl"
                        onPress={() => { void handleAccept(); }}
                        disabled={isPending} // Usamos isPending de React Query
                    >
                        {isPending ? (
                            <ActivityIndicator color="#ffffff" />
                        ) : (
                            <Text className="font-bold text-base">Aceptar Invitación</Text>
                        )}
                    </Button>
                </CardFooter>
            </Card>
        </View>
    );
}