import React from "react";
import { Text, View } from "react-native";
import { Mic, MicOff } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { useAudioRecorder, RecordingResult } from "@/hooks/useAudioRecorder";
import { formatTime } from "@/lib/utils";
import { COLORS } from "@/lib/colors";

interface RecordingButtonProps {
  onRecordingComplete: (result: RecordingResult) => void;
}

export function RecordingButton({ onRecordingComplete }: RecordingButtonProps) {
  const { isRecording, durationMillis, startRecording, stopRecording } =
    useAudioRecorder(onRecordingComplete);

  return (
    <Button
      variant={isRecording ? "destructive" : "outline"}
      className="w-full h-16"
      onPress={isRecording ? stopRecording : startRecording}
    >
      <View className="flex-row items-center gap-2">
        {isRecording ? (
          <>
            <MicOff size={20} color={COLORS.primaryForeground} />
            <Text className="text-base font-medium text-destructive-foreground">
              Detener grabacion ({formatTime(durationMillis)})
            </Text>
          </>
        ) : (
          <>
            <Mic size={20} color={COLORS.foreground} />
            <Text className="text-base font-medium text-foreground">
              Grabar sesion
            </Text>
          </>
        )}
      </View>
    </Button>
  );
}
