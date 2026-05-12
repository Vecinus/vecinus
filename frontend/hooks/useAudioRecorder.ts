import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorderState,
  useAudioRecorder as useExpoAudioRecorder,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface RecordingResult {
  uri?: string;
  durationMs?: number;
  error?: string;
}

export interface AudioRecorderState {
  isRecording: boolean;
  durationMillis: number;
  isPermissionDenied: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  resetPermissionDenied: () => void;
}

export function useAudioRecorder(
  onRecordingComplete?: (result: RecordingResult) => void
): AudioRecorderState {
  const audioRecorder = useExpoAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 100);

  const [hasPermission, setHasPermission] = useState(false);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  const [isRecordingManual, setIsRecordingManual] = useState(false);

  const isRecording = isRecordingManual || recorderState.isRecording;

  const onRecordingCompleteRef = useRef(onRecordingComplete);

  useEffect(() => {
    onRecordingCompleteRef.current = onRecordingComplete;
  }, [onRecordingComplete]);

  const requestPermissions = useCallback(async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        setHasPermission(false);
      } else {
        setHasPermission(true);
        setIsPermissionDenied(false);
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
      }
    } catch (error) {
      console.log(error);
    }
  }, []);

  useEffect(() => {
    requestPermissions();
  }, [requestPermissions]);

  const startRecording = useCallback(async () => {
    if (!hasPermission) {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        setIsPermissionDenied(true);
        return;
      }
      setHasPermission(true);
      setIsPermissionDenied(false);
    }
    try {
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecordingManual(true);
    } catch (error) {
      console.log(error);
      setIsRecordingManual(false);
    }
  }, [hasPermission, audioRecorder]);

  const stopRecording = useCallback(async (): Promise<void> => {
    try {
      const durationMs = recorderState.durationMillis;

      await audioRecorder.stop();
      setIsRecordingManual(false);

      await new Promise((resolve) => setTimeout(resolve, 200));

      const uri = audioRecorder.uri;

      if (!uri) {
        throw new Error('No se pudo obtener la URI de la grabación');
      }

      onRecordingCompleteRef.current?.({ uri, durationMs });
    } catch (error: unknown) {
      console.log(error);
      setIsRecordingManual(false);
      onRecordingCompleteRef.current?.({
        error: error instanceof Error ? error.message : 'No se pudo obtener la grabación de audio'
      });
    }
  }, [audioRecorder, recorderState.durationMillis]);

  const resetPermissionDenied = () => setIsPermissionDenied(false);

  return {
    isRecording,
    durationMillis: recorderState.durationMillis,
    isPermissionDenied,
    startRecording,
    stopRecording,
    resetPermissionDenied,
  };
}
