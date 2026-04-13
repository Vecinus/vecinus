// frontend/app/(drawer)/create-community.tsx
import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Building, MapPin } from 'lucide-react-native';
import { communityApi } from '@/api/community';
import { CustomAlertDialog, AlertConfig } from '@/components/custom-alert';
import { useAuth } from '@/context/AuthContext';

export default function CrearComunidadScreen() {
    const router = useRouter();
    const { user, refreshUserContext } = useAuth();

    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [createdCommunity, setCreatedCommunity] = useState<unknown>(null);

    const [alertConfig, setAlertConfig] = useState<AlertConfig>({
        visible: false,
        title: '',
        message: '',
        type: 'error',
    });

    const handleAcknowledgeAlert = async () => {
        const isSuccess = alertConfig.type === 'success';
        setAlertConfig(prev => ({ ...prev, visible: false }));

        if (isSuccess && createdCommunity) {
            if (refreshUserContext) {
                await refreshUserContext();
            }
            router.replace('/');
        }
    };

    const handleCreateCommunity = async () => {
        if (!name.trim() || !address.trim()) {
            setAlertConfig({
                visible: true,
                title: 'Error',
                message: 'El nombre y la dirección son obligatorios.',
                type: 'error'
            });
            return;
        }

        try {
            setIsLoading(true);
            const newCommunity = await communityApi.createCommunity({
                name: name.trim(),
                address: address.trim(),
            });

            setCreatedCommunity(newCommunity);

            setAlertConfig({
                visible: true,
                title: '¡Éxito!',
                message: `La comunidad "${newCommunity.name}" ha sido creada.`,
                type: 'success'
            });
        } catch (error: unknown) {
            const err = error as { response?: { data?: { detail?: string } } };
            setAlertConfig({
                visible: true,
                title: 'Error',
                message: err?.response?.data?.detail || 'Hubo un problema al crear la comunidad.',
                type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24 }}>
                <View className="mb-8 items-center mt-4">
                    <View className="size-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                        <Icon as={Building} size={32} className="text-primary" />
                    </View>
                    <Text className="text-2xl font-bold text-foreground text-center">
                        Registrar Nueva Comunidad
                    </Text>
                    <Text className="text-sm text-muted-foreground text-center mt-2">
                        Al crearla, aparecerá automáticamente en tu lista de comunidades.
                    </Text>
                </View>

                <View className="space-y-6 gap-4">
                    <View className="gap-2">
                        <Text className="text-sm font-medium text-foreground ml-1">Nombre</Text>
                        <View className="relative justify-center">
                            <View className="absolute left-3 z-10">
                                <Icon as={Building} size={20} className="text-muted-foreground" />
                            </View>
                            <Input
                                placeholder="Nombre de la comunidad"
                                value={name}
                                onChangeText={setName}
                                className="pl-10 h-12"
                                editable={!isLoading}
                            />
                        </View>
                    </View>

                    <View className="gap-2">
                        <Text className="text-sm font-medium text-foreground ml-1">Dirección</Text>
                        <View className="relative justify-center">
                            <View className="absolute left-3 z-10">
                                <Icon as={MapPin} size={20} className="text-muted-foreground" />
                            </View>
                            <Input
                                placeholder="Dirección física"
                                value={address}
                                onChangeText={setAddress}
                                className="pl-10 h-12"
                                editable={!isLoading}
                            />
                        </View>
                    </View>
                </View>

                <View className="mt-10 gap-4">
                    <Button onPress={handleCreateCommunity} disabled={isLoading} className="h-14 rounded-xl">
                        <Text className="text-primary-foreground font-bold text-lg">
                            {isLoading ? 'Procesando...' : 'Crear Comunidad'}
                        </Text>
                    </Button>
                    <Button variant="ghost" onPress={() => router.back()} disabled={isLoading} className="h-12">
                        <Text className="text-foreground">Cancelar</Text>
                    </Button>
                </View>
            </ScrollView>

            <CustomAlertDialog
                config={alertConfig}
                onConfirm={() => { }}
                onCancel={() => { setAlertConfig(prev => ({ ...prev, visible: false })); }}
                onAcknowledge={handleAcknowledgeAlert}
            />
        </KeyboardAvoidingView>
    );
}