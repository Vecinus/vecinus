// frontend/app/(drawer)/create-community.tsx
import React, { useMemo, useState } from 'react';
import {
    KeyboardAvoidingView,
    Linking,
    Platform,
    ScrollView,
    View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Building, Hash, MapPin } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { CustomAlertDialog, type AlertConfig } from '@/components/custom-alert';
import {
    PLAN_CATALOG,
    PlanSelector,
    calculateMonthlyAmountCents,
    formatEuros,
} from '@/components/community/PlanSelector';
import { SandboxBanner } from '@/components/community/SandboxBanner';
import { paymentsApi } from '@/api/payments';
import { useAuth } from '@/context/AuthContext';
import type {
    PlanCode,
    RegistrationPaymentOrderResponse,
} from '@/types/payments.types';

type Step = 'form' | 'paying';

function isAxiosErrorWithDetail(error: unknown): error is { response: { data: { detail: unknown } } } {
    if (!error || typeof error !== 'object') return false;
    const candidate = error as { response?: { data?: { detail?: unknown } } };
    return !!candidate.response && !!candidate.response.data && 'detail' in candidate.response.data;
}

function extractErrorMessage(error: unknown, fallback: string): string {
    if (isAxiosErrorWithDetail(error)) {
        const detail = error.response.data.detail;
        if (typeof detail === 'string') return detail;
        if (detail && typeof detail === 'object' && 'message' in detail) {
            const msg = (detail as { message?: unknown }).message;
            if (typeof msg === 'string') return msg;
        }
    }
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

export default function CrearComunidadScreen() {
    const router = useRouter();
    const { user } = useAuth();

    // --- Wizard state ---
    const [step, setStep] = useState<Step>('form');
    const [order, setOrder] = useState<RegistrationPaymentOrderResponse | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- Form state ---
    const [communityName, setCommunityName] = useState('');
    const [communityAddress, setCommunityAddress] = useState('');
    const [plan, setPlan] = useState<PlanCode>('basic');
    const [householdCountText, setHouseholdCountText] = useState<string>('0');

    const householdCount = useMemo(() => {
        const parsed = parseInt(householdCountText, 10);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    }, [householdCountText]);

    const monthlyAmountCents = useMemo(
        () => calculateMonthlyAmountCents(PLAN_CATALOG[plan], householdCount),
        [plan, householdCount],
    );

    const [alertConfig, setAlertConfig] = useState<AlertConfig>({
        visible: false,
        title: '',
        message: '',
        type: 'error',
    });

    const closeAlert = () => setAlertConfig((prev) => ({ ...prev, visible: false }));

    const showError = (title: string, message: string) =>
        setAlertConfig({ visible: true, title, message, type: 'error' });
    const validateForm = (): string | null => {
        if (!communityName.trim()) return 'El nombre de la comunidad es obligatorio.';
        if (!communityAddress.trim()) return 'La dirección es obligatoria.';
        if (householdCount < 0) return 'El nº de viviendas no puede ser negativo.';
        return null;
    };

    const handleSubmitForm = async () => {
        if (!user) {
            showError('Sesión requerida', 'Debes iniciar sesión antes de crear una comunidad.');
            return;
        }

        const validationError = validateForm();
        if (validationError) {
            showError('Datos incompletos', validationError);
            return;
        }

        try {
            setIsSubmitting(true);
            const created = await paymentsApi.createRegistrationOrder({
                community_name: communityName.trim(),
                community_address: communityAddress.trim(),
                plan,
                household_count: householdCount,
            });

            if (!created.authorisation_url) {
                showError(
                    'Error de pasarela',
                    'GoCardless no devolvió una URL de autorización. Inténtalo de nuevo.',
                );
                return;
            }

            setOrder(created);
            setStep('paying');
        } catch (error) {
            showError(
                'No se pudo iniciar el alta',
                extractErrorMessage(error, 'Error de red al crear la orden de pago.'),
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenGateway = async () => {
        if (!order?.authorisation_url) return;

        try {
            const supported = await Linking.canOpenURL(order.authorisation_url);
            if (!supported) {
                showError(
                    'No se puede abrir la pasarela',
                    'Tu dispositivo no admite abrir el enlace. Copia esta URL en tu navegador: ' +
                        order.authorisation_url,
                );
                return;
            }
            // Tras autorizar, GoCardless redirige a `/payments/gocardless/complete`,
            // que ejecuta el `complete` automáticamente y lleva al usuario a home.
            await Linking.openURL(order.authorisation_url);
        } catch (error) {
            showError(
                'No se pudo abrir la pasarela',
                extractErrorMessage(error, 'Error inesperado al abrir el enlace.'),
            );
        }
    };

    const handleBackToForm = () => {
        setStep('form');
        setOrder(null);
    };

    const renderFormStep = () => (
        <View>
            <View className="mb-8 mt-4 items-center">
                <View className="mb-4 size-16 items-center justify-center rounded-full bg-primary/10">
                    <Icon as={Building} size={32} className="text-primary" />
                </View>
                <Text className="text-center text-2xl font-bold text-foreground">
                    Registrar nueva comunidad
                </Text>
                <Text className="mt-2 text-center text-sm text-muted-foreground">
                    Tras pagar el primer mes en GoCardless, tu comunidad se creará automáticamente
                    y se asociará a tu cuenta como administrador.
                </Text>
            </View>

            <View className="gap-4">
                <FormField
                    label="Nombre de la comunidad"
                    icon={Building}
                    placeholder="Residencial Las Flores"
                    value={communityName}
                    onChangeText={setCommunityName}
                    editable={!isSubmitting}
                />
                <FormField
                    label="Dirección"
                    icon={MapPin}
                    placeholder="Calle, nº, ciudad"
                    value={communityAddress}
                    onChangeText={setCommunityAddress}
                    editable={!isSubmitting}
                />
                <FormField
                    label="Nº de viviendas"
                    icon={Hash}
                    placeholder="0"
                    value={householdCountText}
                    onChangeText={(text) => setHouseholdCountText(text.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    editable={!isSubmitting}
                />

                <View className="mt-2">
                    <Text className="ml-1 text-sm font-medium text-foreground mb-2">
                        Plan de suscripción
                    </Text>
                    <PlanSelector
                        selected={plan}
                        onChange={setPlan}
                        householdCount={householdCount}
                        disabled={isSubmitting}
                    />
                </View>
            </View>

            <View className="mt-8 gap-3">
                <Button onPress={handleSubmitForm} disabled={isSubmitting} className="h-14 rounded-xl">
                    <Text className="text-lg font-bold text-primary-foreground">
                        {isSubmitting ? 'Procesando...' : 'Continuar al pago'}
                    </Text>
                </Button>
                <Button variant="ghost" onPress={() => router.back()} disabled={isSubmitting} className="h-12">
                    <Text className="text-foreground">Cancelar</Text>
                </Button>
            </View>
        </View>
    );

    const renderPayingStep = () => (
        <View>
            <View className="mb-6 mt-4 items-center">
                <Text className="text-center text-2xl font-bold text-foreground">
                    Resumen y pago
                </Text>
                <Text className="mt-2 text-center text-sm text-muted-foreground">
                    Revisa los datos y abre la pasarela para autorizar el mandato SEPA. Al
                    terminar, te redirigiremos automáticamente a la app.
                </Text>
            </View>

            <SandboxBanner className="mb-4" />

            <View className="gap-3 rounded-2xl border border-border bg-card p-5">
                <SummaryRow label="Comunidad" value={communityName.trim()} />
                <SummaryRow label="Dirección" value={communityAddress.trim()} />
                <SummaryRow
                    label="Plan"
                    value={`${PLAN_CATALOG[plan].name} (${householdCount} viviendas)`}
                />
                <SummaryRow
                    label="Importe del primer mes"
                    value={formatEuros(monthlyAmountCents)}
                    emphasis
                />
                <SummaryRow
                    label="Renovación"
                    value="Mensual mientras la suscripción esté activa"
                    small
                />
            </View>

            <View className="mt-8 gap-3">
                <Button onPress={handleOpenGateway} className="h-14 rounded-xl">
                    <Text className="text-lg font-bold text-primary-foreground">
                        Pagar con SEPA en GoCardless
                    </Text>
                </Button>
                <Button variant="ghost" onPress={handleBackToForm} className="h-12">
                    <Text className="text-foreground">Volver atrás</Text>
                </Button>
            </View>
        </View>
    );

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                className="flex-1 bg-background"
                contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
                keyboardShouldPersistTaps="handled"
            >
                {step === 'form' ? renderFormStep() : null}
                {step === 'paying' ? renderPayingStep() : null}
            </ScrollView>

            <CustomAlertDialog
                config={alertConfig}
                onConfirm={() => closeAlert()}
                onCancel={() => closeAlert()}
                onAcknowledge={() => closeAlert()}
            />
        </KeyboardAvoidingView>
    );
}

type FormFieldProps = {
    label: string;
    icon: React.ComponentType<{ size?: number; color?: string }>;
    value: string;
    onChangeText: (value: string) => void;
    placeholder?: string;
    secureTextEntry?: boolean;
    keyboardType?: 'default' | 'email-address' | 'numeric';
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    editable?: boolean;
};

function FormField({
    label,
    icon,
    value,
    onChangeText,
    placeholder,
    secureTextEntry,
    keyboardType = 'default',
    autoCapitalize = 'sentences',
    editable = true,
}: FormFieldProps) {
    return (
        <View className="gap-2">
            <Text className="ml-1 text-sm font-medium text-foreground">{label}</Text>
            <View className="relative justify-center">
                <View className="absolute left-3 z-10">
                    { }
                    <Icon as={icon as any} size={20} className="text-muted-foreground" />
                </View>
                <Input
                    placeholder={placeholder}
                    value={value}
                    onChangeText={onChangeText}
                    secureTextEntry={secureTextEntry}
                    keyboardType={keyboardType}
                    autoCapitalize={autoCapitalize}
                    editable={editable}
                    className="h-12 pl-10"
                />
            </View>
        </View>
    );
}

function SummaryRow({
    label,
    value,
    emphasis = false,
    small = false,
}: {
    label: string;
    value: string;
    emphasis?: boolean;
    small?: boolean;
}) {
    return (
        <View className="flex-row items-start justify-between gap-3">
            <Text className={small ? 'text-xs text-muted-foreground' : 'text-sm text-muted-foreground'}>
                {label}
            </Text>
            <Text
                className={
                    emphasis
                        ? 'text-base font-bold text-foreground text-right'
                        : small
                            ? 'text-xs text-foreground text-right'
                            : 'text-sm font-medium text-foreground text-right'
                }
            >
                {value}
            </Text>
        </View>
    );
}
