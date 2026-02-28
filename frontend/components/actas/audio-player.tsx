import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
} from "expo-audio";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react-native";
import Slider from "@react-native-community/slider";
import { formatSeconds } from "@/lib/utils";
import { COLORS } from "@/lib/colors";
import { AudioPlayerLoading, AudioPlayerError } from "./audio-player-states";

interface AudioPlayerProps {
  uri: string;
  /** Ignorado en nativo: expo-audio obtiene la duracion directamente del archivo */
  durationHint?: number;
}

const LOAD_TIMEOUT_MS = 10_000;

function isValidDuration(d: number) {
  return d > 0 && isFinite(d) && !isNaN(d);
}

export function AudioPlayer({ uri }: AudioPlayerProps) {
  const [retryKey, setRetryKey] = useState(0);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(console.error);
  }, []);

  useEffect(() => {
    if (retryKey > 0) player.replace(uri);
  }, [retryKey, player, uri]);

  // Rebobinar al final
  useEffect(() => {
    const ended =
      !status.playing &&
      status.currentTime > 0 &&
      status.duration > 0 &&
      Math.abs(status.currentTime - status.duration) < 0.5;
    if (ended) player.seekTo(0);
  }, [status.playing, status.currentTime, status.duration, player]);

  // Timeout de carga
  useEffect(() => {
    if (isValidDuration(status.duration)) {
      setLoadingTimeout(false);
      return;
    }
    const id = setTimeout(() => setLoadingTimeout(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [status.duration, retryKey]);

  const handleRetry = () => {
    setLoadingTimeout(false);
    setRetryKey((k) => k + 1);
  };

  const handleError = () => {
    Alert.alert(
      "Error de audio",
      "El audio no se pudo cargar correctamente. Borra el audio y vuelve a grabar o subir otro.",
    );
  };

  if (!loadingTimeout && !isValidDuration(status.duration)) {
    return <AudioPlayerLoading />;
  }

  if (loadingTimeout) {
    return <AudioPlayerError onRetry={handleRetry} onDelete={handleError} />;
  }

  const skip = (seconds: number) => {
    const pos = Math.max(
      0,
      Math.min(status.currentTime + seconds, status.duration),
    );
    player.seekTo(pos);
  };

  return (
    <View className="bg-muted/50 rounded-lg p-4 gap-3">
      {/* Barra de progreso */}
      <View className="gap-1">
        <Slider
          style={{ width: "100%", height: 40 }}
          minimumValue={0}
          maximumValue={status.duration}
          value={status.currentTime}
          onSlidingComplete={(v) => player.seekTo(v)}
          minimumTrackTintColor={COLORS.primary}
          maximumTrackTintColor={COLORS.mutedForeground}
          thumbTintColor={COLORS.primary}
        />
        <View className="flex-row justify-between px-1">
          <Text className="text-xs text-muted-foreground">
            {formatSeconds(status.currentTime)}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {formatSeconds(status.duration)}
          </Text>
        </View>
      </View>

      {/* Controles */}
      <View className="flex-row items-center justify-center gap-4">
        <TouchableOpacity onPress={() => skip(-10)} className="p-2">
          <SkipBack size={24} color={COLORS.foreground} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => (status.playing ? player.pause() : player.play())}
          className="bg-primary rounded-full p-3 items-center justify-center"
        >
          {status.playing ? (
            <Pause
              size={28}
              color={COLORS.primaryForeground}
              fill={COLORS.primaryForeground}
            />
          ) : (
            <Play
              size={28}
              color={COLORS.primaryForeground}
              fill={COLORS.primaryForeground}
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => skip(10)} className="p-2">
          <SkipForward size={24} color={COLORS.foreground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
