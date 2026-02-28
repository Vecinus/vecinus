import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { AudioRecorderState, RecordingResult } from './useAudioRecorder';

const PREFERRED_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm'];

export function useAudioRecorder(onRecordingComplete?: (result: RecordingResult) => void): AudioRecorderState {
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [durationMillis, setDurationMillis] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const onRecordingCompleteRef = useRef(onRecordingComplete);

  useEffect(() => {
    onRecordingCompleteRef.current = onRecordingComplete;
  }, [onRecordingComplete]);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        Alert.alert('Error', 'El navegador no soporta la grabación de audio');
        setHasPermission(false);
        return false;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setHasPermission(true);
      return true;
    } catch (error) {
      console.error('[useAudioRecorder:web] Error al solicitar permisos:', error);
      Alert.alert('Permiso denegado', 'No se pudo acceder al micrófono');
      setHasPermission(false);
      return false;
    }
  }, []);

  useEffect(() => {
    requestPermissions();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    };
  }, [requestPermissions]);

  const startTimer = () => {
    startTimeRef.current = Date.now();
    setDurationMillis(0);
    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setDurationMillis(Date.now() - startTimeRef.current);
      }
    }, 200);
  };

  const stopTimer = (): number => {
    const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startTimeRef.current = null;
    return elapsed;
  };

  const startRecording = useCallback(async () => {
    const granted = hasPermission || (await requestPermissions());
    if (!granted) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const supportedType = PREFERRED_MIME_TYPES.find((type) =>
        MediaRecorder.isTypeSupported(type)
      );
      const recorder = new MediaRecorder(
        stream,
        supportedType ? { mimeType: supportedType } : undefined
      );

      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = supportedType ?? 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (!blob || blob.size === 0) {
          console.error('[useAudioRecorder:web] Blob vacío al finalizar');
          Alert.alert('Error', 'No se pudo generar el archivo de audio');
          return;
        }

        const uri = URL.createObjectURL(blob);
        // durationMs se captura en stopRecording antes de llamar a recorder.stop(),
        // y se pasa a través de durationMsRef para que onstop pueda acceder a él.
        onRecordingCompleteRef.current?.({ uri, durationMs: durationMsRef.current });
      };

      recorder.onerror = () => {
        Alert.alert('Error', 'No se pudo iniciar la grabación');
        setIsRecording(false);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      startTimer();
    } catch (error) {
      console.error('[useAudioRecorder:web] Error al iniciar grabación:', error);
      Alert.alert('Error', 'No se pudo iniciar la grabación');
    }
  }, [hasPermission, requestPermissions]);

  // Ref para pasar la duración capturada al handler onstop (que es un closure)
  const durationMsRef = useRef<number>(0);

  const stopRecording = useCallback(async (): Promise<void> => {
    try {
      // Capturamos la duración antes de parar el timer
      durationMsRef.current = stopTimer();

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      setIsRecording(false);
    } catch (error) {
      console.error('[useAudioRecorder:web] Error al detener grabación:', error);
      Alert.alert('Error', 'No se pudo detener la grabación correctamente');
      setIsRecording(false);
    }
  }, []);

  return {
    isRecording,
    durationMillis,
    startRecording,
    stopRecording,
  };
}
