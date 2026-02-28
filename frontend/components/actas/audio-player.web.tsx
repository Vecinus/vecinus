import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react-native";
import Slider from "@react-native-community/slider";
import { formatSeconds } from "@/lib/utils";
import { COLORS } from "@/lib/colors";
import { AudioPlayerLoading, AudioPlayerError } from "./audio-player-states";

interface AudioPlayerProps {
  uri: string;
  /**
   * Duracion conocida en milisegundos (ej. proporcionada por el grabador).
   * En web, los blobs WebM de MediaRecorder no incluyen duracion en el contenedor,
   * por lo que el HTMLAudioElement reporta Infinity. Este hint lo soluciona.
   */
  durationHint?: number;
}

const LOAD_TIMEOUT_MS = 10_000;

export function AudioPlayer({ uri, durationHint }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const durationHintSec =
    durationHint != null ? durationHint / 1000 : undefined;
  const [domDuration, setDomDuration] = useState(0);
  const duration =
    domDuration > 0 && isFinite(domDuration)
      ? domDuration
      : (durationHintSec ?? 0);
  const hasDuration = duration > 0 && isFinite(duration);

  // Crear y gestionar el HTMLAudioElement
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDomDuration(0);
    setLoaded(false);
    setLoadingTimeout(false);

    const audio = new Audio(uri);
    audioRef.current = audio;

    const onCanPlay = () => {
      setLoaded(true);
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDomDuration(audio.duration);
      }
    };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      setPlaying(false);
      audio.currentTime = 0;
      setCurrentTime(0);
    };
    const onError = () => setLoaded(false);

    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.load();

    return () => {
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.pause();
      audioRef.current = null;
    };
  }, [uri, retryKey]);

  // Timeout de carga
  useEffect(() => {
    if (loaded) return;
    const id = setTimeout(() => setLoadingTimeout(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [loaded, retryKey]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  };

  const skip = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const max = hasDuration ? duration : audio.duration;
    audio.currentTime = Math.max(
      0,
      Math.min(
        audio.currentTime + seconds,
        isFinite(max) ? max : audio.currentTime + seconds,
      ),
    );
  };

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

  // --- Estados de carga / error ---
  if (!loadingTimeout && !loaded) return <AudioPlayerLoading />;
  if (loadingTimeout)
    return <AudioPlayerError onRetry={handleRetry} onDelete={handleError} />;

  // --- Reproductor ---
  return (
    <View className="bg-muted/50 rounded-lg p-4 gap-3">
      <View className="gap-1">
        <Slider
          style={{ width: "100%", height: 40 }}
          minimumValue={0}
          maximumValue={hasDuration ? duration : 1}
          value={hasDuration ? Math.min(currentTime, duration) : 0}
          onSlidingComplete={
            hasDuration
              ? (v) => {
                  const audio = audioRef.current;
                  if (audio) {
                    audio.currentTime = v;
                    setCurrentTime(v);
                  }
                }
              : undefined
          }
          disabled={!hasDuration}
          minimumTrackTintColor={COLORS.primary}
          maximumTrackTintColor={COLORS.mutedForeground}
          thumbTintColor={COLORS.primary}
        />
        <View className="flex-row justify-between px-1">
          <Text className="text-xs text-muted-foreground">
            {formatSeconds(currentTime)}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {hasDuration ? formatSeconds(duration) : "--:--"}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-center gap-4">
        <TouchableOpacity onPress={() => skip(-10)} className="p-2">
          <SkipBack size={24} color={COLORS.foreground} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={togglePlayPause}
          className="bg-primary rounded-full p-3 items-center justify-center"
        >
          {playing ? (
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
