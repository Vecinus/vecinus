import React, { useState } from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, ParamListBase } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useRouter } from 'expo-router';
import { FileText, MessageSquare, CalendarDays, BellRing, ChevronRight } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Feature } from '@/components/feature';
import { FeedbackSection } from '@/components/send-feedback';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { apiClient } from '@/api/client';

export default function HomeScreen() {
  const navigation = useNavigation<DrawerNavigationProp<ParamListBase>>();
  const router = useRouter();
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogMessage, setDialogMessage] = useState('');

  const showAlert = (title: string, message: string) => {
    setDialogTitle(title);
    setDialogMessage(message);
    setDialogOpen(true);
  };

  const handleFeedbackSubmit = async () => {
    if (!feedback.trim()) {
      showAlert('Aviso', 'Escribe un comentario antes de enviar.');
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.post('/feedback', { feedback });
      showAlert('¡Gracias!', 'Feedback enviado.');
      setFeedback('');
    } catch {
      showAlert('Error', 'No se pudo enviar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="w-full max-w-3xl self-center px-5 pb-10 pt-16 md:px-10">
        <View className="mb-10 items-center">
          <Image
            source={require('@/assets/logos/vecinusicon.png')}
            style={{ width: 230, height: 230 }}
            contentFit="contain"
          />

          <Text variant="lead" className="mt-2 text-center font-semibold text-blue-500">
            Tu comunidad conectada
          </Text>

          <Text className="mt-2 text-center text-muted-foreground">
            Gestiona tu comunidad desde un solo lugar.
          </Text>
        </View>

        <FeedbackSection
          feedback={feedback}
          setFeedback={setFeedback}
          isSubmitting={isSubmitting}
          onSubmit={handleFeedbackSubmit}
        />

        <View className="mb-6 gap-4">
          <Text className="text-center text-xl font-bold">Qué puedes hacer</Text>

          <View className="flex-row flex-wrap justify-center gap-4">
            <Feature Icon={FileText} title="Actas y votaciones" desc="Consulta y participa." />
            <Feature Icon={MessageSquare} title="Asistente virtual" desc="Resuelve dudas rápido." />
            <Feature Icon={CalendarDays} title="Reservas" desc="Gestiona espacios." />
            <Feature Icon={BellRing} title="Avisos" desc="Mantente informado." />
          </View>
        </View>
      </View>

      <View className="h-16" />
      <Button className="self-center" onPress={() => navigation.openDrawer()} size={'lg'}>
        <View className="flex-row items-center gap-2">
          <Text>Explorar</Text>
          <ChevronRight size={18} color="white" />
        </View>
      </Button>

      <View className="border-t border-border px-5 py-6">
        <Pressable onPress={() => router.push('/legal' as any)}>
          <Text className="text-center text-xs text-muted-foreground underline">
            Ver Términos y Condiciones
          </Text>
        </Pressable>
      </View>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          <DialogDescription>{dialogMessage}</DialogDescription>
          <DialogFooter>
            <Button onPress={() => setDialogOpen(false)}>
              <Text>Aceptar</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollView>
  );
}
