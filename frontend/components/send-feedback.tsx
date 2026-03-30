import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { View } from "react-native";

interface FeedbackSectionProps {
  feedback: string;
  setFeedback: (value: string) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
}

export function FeedbackSection({
  feedback,
  setFeedback,
  isSubmitting,
  onSubmit,
}: FeedbackSectionProps) {
  return (
    <View className="bg-card border border-border rounded-2xl p-5 mb-10 w-full">
      <Text className="text-lg font-semibold text-card-foreground mb-1 text-center">
        Feedback
      </Text>
      <Text className="text-muted-foreground mb-4 text-center">
        Ayúdanos a mejorar Vecinus.
      </Text>

      <Input
        value={feedback}
        onChangeText={setFeedback}
        placeholder="Escribe tu comentario..."
        multiline
        numberOfLines={8}
        maxLength={2000}
        className="h-[150px] mb-4"
        style={{ textAlignVertical: "top" }}
      />

      <Button onPress={onSubmit} disabled={isSubmitting}>
        <Text className="text-primary-foreground font-bold">
          {isSubmitting ? "Enviando..." : "Enviar feedback"}
        </Text>
      </Button>
    </View>
  );
}
