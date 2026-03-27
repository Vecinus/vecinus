import { useState, useEffect, useCallback, useRef } from 'react';
import {
  useAudioRecorder as useExpoAudioRecorder,
  useAudioRecorderState,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from 'expo-audio';
import { Alert } from 'react-native';

export interface RecordingResult {
  uri: string;
  /** Duración real de la grabación en milisegundos */
  durationMs: number;
}

export interface AudioRecorderState {
  isRecording: boolean;
  durationMillis: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
}

export function useAudioRecorder(onRecordingComplete?: (result: RecordingResult) => void): AudioRecorderState {
  const audioRecorder = useExpoAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 100);

  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const onRecordingCompleteRef = useRef(onRecordingComplete);

  useEffect(() => {
    onRecordingCompleteRef.current = onRecordingComplete;
  }, [onRecordingComplete]);

  const requestPermissions = useCallback(async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Permiso denegado', 'No se pudo acceder al micrófono');
        setHasPermission(false);
      } else {
        setHasPermission(true);
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
      }
    } catch (error) {
      console.error('[useAudioRecorder] Error al solicitar permisos:', error);
      Alert.alert('Error', 'No se pudieron solicitar permisos de micrófono');
    }
  }, []);

  useEffect(() => {
    requestPermissions();
  }, [requestPermissions]);

  const startRecording = useCallback(async () => {
    if (!hasPermission) {
      await requestPermissions();
      return;
    }
    try {
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
    } catch (error) {
      console.error('[useAudioRecorder] Error al iniciar grabación:', error);
      Alert.alert('Error', 'No se pudo iniciar la grabación');
    }
  }, [hasPermission, audioRecorder, requestPermissions]);

  const stopRecording = useCallback(async (): Promise<void> => {
    try {
      // Guardamos la duración antes de parar (en milisegundos)
      const durationMs = recorderState.durationMillis;
      await audioRecorder.stop();
      setIsRecording(false);

      const uri = audioRecorder.uri;
      if (!uri || !uri.startsWith('file://')) {
        console.error('[useAudioRecorder] URI inválida:', uri);
        Alert.alert('Error', 'El archivo de audio no es válido. Por favor, intenta grabar de nuevo.');
        return;
      }

      onRecordingCompleteRef.current?.({ uri, durationMs });
    } catch (error) {
      console.error('[useAudioRecorder] Error al detener grabación:', error);
      Alert.alert('Error', 'No se pudo detener la grabación correctamente. Por favor, intenta de nuevo.');
      setIsRecording(false);
    }
  }, [audioRecorder, recorderState.durationMillis]);

  return {
    isRecording,
    durationMillis: recorderState.durationMillis,
    startRecording,
    stopRecording,
  };
}
