import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, useColorScheme } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import { formatSeconds } from '@/lib/utils';
import { THEME } from '@/lib/theme';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';

interface AudioPlayerProps {
  uri: string;
  initialDuration?: number;
}

const LOAD_TIMEOUT_MS = 10_000;

function isValidDuration(d: number) {
  return d > 0 && isFinite(d) && !isNaN(d);
}

export function AudioPlayer({ uri, initialDuration }: AudioPlayerProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = THEME[colorScheme as keyof typeof THEME];

  const [retryKey, setRetryKey] = useState(0);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  const effectiveDuration = isValidDuration(status.duration)
    ? status.duration
    : initialDuration
      ? initialDuration / 1000
      : 0;

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  useEffect(() => {
    if (retryKey > 0) player.replace(uri);
  }, [retryKey, player, uri]);

  useEffect(() => {
    const ended =
      !status.playing &&
      status.currentTime > 0 &&
      effectiveDuration > 0 &&
      Math.abs(status.currentTime - effectiveDuration) < 0.5;
    if (ended) player.seekTo(0);
  }, [status.playing, status.currentTime, effectiveDuration, player]);

  useEffect(() => {
    if (isValidDuration(status.duration) || (initialDuration && initialDuration > 0)) {
      setLoadingTimeout(false);
      return;
    }
    const id = setTimeout(() => {
      setLoadingTimeout(true);
    }, LOAD_TIMEOUT_MS);

    return () => {
      clearTimeout(id);
    };
  }, [status.duration, retryKey, initialDuration]);

  const handleRetry = () => {
    setLoadingTimeout(false);
    setRetryKey((k) => k + 1);
  };

  const isLoaded = isValidDuration(status.duration) || (initialDuration && initialDuration > 0);

  if (!loadingTimeout && !isLoaded) {
    return (
      <View className="items-center justify-center rounded-lg bg-muted/50 p-4">
        <Text className="italic text-muted-foreground">Cargando audio...</Text>
      </View>
    );
  }

  if (loadingTimeout) {
    return (
      <View className="items-center justify-center gap-2 rounded-lg bg-muted/50 p-4">
        <Text className="font-medium text-destructive">No se pudo cargar el audio</Text>
        <TouchableOpacity onPress={handleRetry}>
          <Text className="font-semibold text-primary">Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const skip = (seconds: number) => {
    const pos = Math.max(0, Math.min(status.currentTime + seconds, effectiveDuration));
    player.seekTo(pos);
  };

  return (
    <View className="gap-3 rounded-xl border border-border bg-muted/50 p-4">
      {/* Barra de progreso */}
      <View className="gap-1">
        <Slider
          style={{ width: '100%', height: 40 }}
          minimumValue={0}
          maximumValue={effectiveDuration}
          value={status.currentTime}
          onSlidingComplete={(v) => player.seekTo(v)}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.mutedForeground}
          thumbTintColor={colors.primary}
        />
        <View className="flex-row justify-between px-1">
          <Text className="text-xs text-muted-foreground">{formatSeconds(status.currentTime)}</Text>
          <Text className="text-xs text-muted-foreground">{formatSeconds(effectiveDuration)}</Text>
        </View>
      </View>

      {/* Controles */}
      <View className="flex-row items-center justify-center gap-6">
        <TouchableOpacity onPress={() => skip(-10)} className="p-2 active:opacity-60">
          <Icon as={SkipBack} size={24} className="text-foreground" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => (status.playing ? player.pause() : player.play())}
          className="items-center justify-center rounded-full bg-primary p-4 shadow-sm active:opacity-80">
          {status.playing ? (
            <Icon as={Pause} size={28} className="text-primary-foreground" />
          ) : (
            <Icon as={Play} size={28} className="text-primary-foreground" />
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => skip(10)} className="p-2 active:opacity-60">
          <Icon as={SkipForward} size={24} className="text-foreground" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
