import React, { useState } from "react";
import { ScrollView, Alert, Platform, View } from "react-native";
import { Image } from "expo-image";
import { useNavigation, ParamListBase } from "@react-navigation/native";
import { DrawerNavigationProp } from "@react-navigation/drawer";
import { FileText, MessageSquare, CalendarDays, BellRing, ChevronRight, LucideIcon } from "lucide-react-native";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";

import { API_URL, getGlobalJwtToken } from "@/constants/api";

interface FeatureProps {
  Icon: LucideIcon;
  title: string;
  desc: string;
}

function Feature({ Icon, title, desc }: FeatureProps) {
  return (
    <Card className="w-full md:w-[48%]">
      <CardContent>
        <View className="flex-row items-center gap-4">
          <View className="w-14 h-14 rounded-xl items-center justify-center bg-blue-100 dark:bg-blue-900/30">
            <Icon size={26} color="#5c90cf" />
          </View>

          <View className="flex-1">
            <Text className="font-semibold">{title}</Text>
            <Text className="text-muted-foreground">{desc}</Text>
          </View>
        </View>
      </CardContent>
    </Card>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation<DrawerNavigationProp<ParamListBase>>();
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === "web") window.alert(`${title}\n\n${message}`);
    else Alert.alert(title, message);
  };

  const handleFeedbackSubmit = async () => {
    if (!feedback.trim()) {
      showAlert("Aviso", "Escribe un comentario antes de enviar.");
      return;
    }

    setIsSubmitting(true);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      const token = getGlobalJwtToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(`${API_URL}/feedback`, {
        method: "POST",
        headers,
        body: JSON.stringify({ feedback }),
      });

      if (response.ok) {
        showAlert("¡Gracias!", "Feedback enviado.");
        setFeedback("");
      } else {
        showAlert("Error", "No se pudo enviar.");
      }
    } catch {
      showAlert("Error", "Servidor no disponible.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="pt-16 pb-10 px-5 md:px-10 max-w-3xl w-full self-center">
        
        <View className="items-center mb-10">
          <Image
              source={require("@/assets/logos/vecinusicon.png")}
              style={{ width: 230, height: 230 }}
              contentFit="contain"
          />

          <Text variant="lead" className="text-blue-500 font-semibold mt-2 text-center">
            Tu comunidad conectada
          </Text>

          <Text className="text-muted-foreground text-center mt-2">
            Gestiona tu comunidad desde un solo lugar.
          </Text>
        </View>

        <Card className="mb-8">
          <CardContent>
            <View className="gap-4">
              <Text className="text-lg font-semibold">Feedback</Text>

              <Textarea
                value={feedback}
                onChangeText={setFeedback}
                placeholder="Escribe tu comentario..."
                className="min-h-[100px]"
                maxLength={2000}
              />

              <Button onPress={handleFeedbackSubmit} disabled={isSubmitting}>
                <Text>
                  {isSubmitting ? "Enviando..." : "Enviar feedback"}
                </Text>
              </Button>
            </View>
          </CardContent>
        </Card>

        <View className="gap-4 mb-6">
          <Text className="text-xl font-bold text-center">
            Qué puedes hacer
          </Text>

          <View className="flex-row flex-wrap gap-4 justify-center">
            <Feature Icon={FileText} title="Actas y votaciones" desc="Consulta y participa." />
            <Feature Icon={MessageSquare} title="Asistente virtual" desc="Resuelve dudas rápido." />
            <Feature Icon={CalendarDays} title="Reservas" desc="Gestiona espacios." />
            <Feature Icon={BellRing} title="Avisos" desc="Mantente informado." />
          </View>
        </View>

        <Button
          className="self-center"
          onPress={() => navigation.openDrawer()}
          size={"lg"}
        >
          <View className="flex-row items-center gap-2">
            <Text>Explorar</Text>
            <ChevronRight size={18} color="white" />
          </View>
        </Button>

      </View>
    </ScrollView>
  );
}