import React, { useState } from "react";
import { View, ScrollView, Alert, Platform, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { useNavigation, ParamListBase } from "@react-navigation/native";
import { DrawerNavigationProp } from "@react-navigation/drawer";
import { FileText, MessageSquare, CalendarDays, BellRing, ChevronRight, LucideIcon } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { API_URL, globalJwtToken } from "@/constants/api";
import { FeedbackSection } from "@/components/send-feedback";

interface FeatureProps {
  Icon: LucideIcon;
  title: string;
  desc: string;
}

const Feature = ({ Icon, title, desc }: FeatureProps) => (
  <View className="flex-row items-center bg-card border border-border rounded-2xl p-4 w-full">
    <View className="w-14 h-14 rounded-xl items-center justify-center bg-blue-100 dark:bg-blue-900/30 mr-4">
      <Icon size={26} color="#5c90cf" />
    </View>
    <View className="flex-1 items-center">
      <Text className="font-semibold text-base text-card-foreground text-center">
        {title}
      </Text>
      <Text className="text-sm text-muted-foreground text-center">
        {desc}
      </Text>
    </View>
  </View>
);

export default function HomeScreen() {
  const navigation = useNavigation<DrawerNavigationProp<ParamListBase>>();
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
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

      if (globalJwtToken) {
        headers["Authorization"] = `Bearer ${globalJwtToken}`;
      }

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
    <View className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View className="items-center pt-16 pb-8">
          <Image
            source={require("@/assets/images/favicon.png")}
            style={{ width: 220, height: 120 }}
            contentFit="contain"
          />
        </View>

        <View className="px-5 md:px-10 max-w-3xl w-full self-center">
          <View className="mb-10 items-center">
            <Text className="text-3xl font-extrabold text-foreground mb-2 text-center">
              Bienvenido a Vecinus
            </Text>
            <Text className="text-blue-500 font-semibold mb-3 text-center">
              Tu comunidad conectada
            </Text>
            <Text className="text-muted-foreground text-center">
              Gestiona tu comunidad desde un solo lugar.
            </Text>
          </View>

          <FeedbackSection
            feedback={feedback}
            setFeedback={setFeedback}
            isSubmitting={isSubmitting}
            onSubmit={handleFeedbackSubmit}
          />

          <View className="mb-6 items-center">
            <Text className="text-xl font-bold text-foreground mb-4 text-center">
              Qué puedes hacer
            </Text>

            <View className="gap-4 md:flex-row md:flex-wrap w-full">
              <View className="md:w-[48%]">
                <Feature
                  Icon={FileText}
                  title="Actas y votaciones"
                  desc="Consulta y participa."
                />
              </View>

              <View className="md:w-[48%]">
                <Feature
                  Icon={MessageSquare}
                  title="Asistente virtual"
                  desc="Resuelve dudas rápido."
                />
              </View>

              <View className="md:w-[48%]">
                <Feature
                  Icon={CalendarDays}
                  title="Reservas"
                  desc="Gestiona espacios."
                />
              </View>

              <View className="md:w-[48%]">
                <Feature
                  Icon={BellRing}
                  title="Avisos"
                  desc="Mantente informado."
                />
              </View>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => navigation.openDrawer()}
            className="bg-blue-500 rounded-2xl py-4 px-6 flex-row items-center justify-center mt-4 self-center min-w-[180px]"
          >
            <Text className="text-white font-extrabold text-lg mr-2">Explorar</Text>
            <ChevronRight color="white" size={22} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}