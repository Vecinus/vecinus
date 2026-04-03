import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { View } from 'react-native';

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

          <Button onPress={onSubmit} disabled={isSubmitting}>
            <Text>{isSubmitting ? 'Enviando...' : 'Enviar feedback'}</Text>
          </Button>
        </View>
      </CardContent>
    </Card>
  );
}
