import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Mic, Upload, X, Save, AlertCircle, Circle } from 'lucide-react-native';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { AudioPlayer } from './audio-player';
import { minutesService } from '@/api/services/minutes.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { formatTime } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface CreateActaCardProps {
  communityId: string;
  onSuccess: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateActaCard({
  communityId,
  onSuccess,
  open,
  onOpenChange,
}: CreateActaCardProps) {
  const [title, setTitle] = useState('');
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!open) {
      setTitle('');
      setAudioUri(null);
      setAudioDuration(null);
      setAudioName(null);
      setAudioMimeType(null);
      setIsUploading(false);
    }
  }, [open]);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', description: '', isSuccess: false });

  const showAlert = (title: string, description: string, isSuccess = false) => {
    setAlertConfig({ title, description, isSuccess });
    setAlertOpen(true);
  };

  const {
    isRecording,
    durationMillis,
    startRecording,
    stopRecording,
    isPermissionDenied,
    resetPermissionDenied,
  } = useAudioRecorder((result) => {
    if (!result.uri) {
      showAlert('Error', 'No se pudo obtener la grabación de audio');
      return;
    }

    const extension = Platform.OS === 'web' ? 'webm' : 'm4a';

    const mimeMap: Record<string, string> = {
      m4a: 'audio/x-m4a',
      mp4: 'audio/mp4',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      flac: 'audio/flac',
      webm: 'audio/webm',
    };
    const mimeType = mimeMap[extension]; // nosemgrep

    setAudioUri(result.uri);
    setAudioDuration(result.durationMs);
    setAudioName(`grabacion_${new Date().getTime()}.${extension}`);
    setAudioMimeType(mimeType);
  });

  useEffect(() => {
    if (isPermissionDenied) {
      showAlert(
        'Micrófono desactivado',
        'Está desactivado. Por favor, habilita los permisos en la configuración de tu navegador o dispositivo.'
      );
      resetPermissionDenied();
    }
  }, [isPermissionDenied, resetPermissionDenied]);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setAudioUri(asset.uri);
        setAudioDuration(null); // Reset duration for picked files as we don't know it yet
        setAudioName(asset.name);
        setAudioMimeType(asset.mimeType ?? 'audio/mpeg');
      }
    } catch (error) {
      console.error('Error picking document:', error);
      showAlert('Error', 'No se pudo seleccionar el archivo de audio');
    }
  };

  const handleRemoveAudio = () => {
    setAudioUri(null);
    setAudioDuration(null);
    setAudioName(null);
    setAudioMimeType(null);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      showAlert('Error', 'Por favor, introduce un nombre para el acta');
      return;
    }

    if (!audioUri) {
      showAlert('Error', 'Por favor, graba o sube un archivo de audio');
      return;
    }

    setIsUploading(true);
    try {
      await minutesService.transcribe(communityId, title, {
        uri: audioUri,
        name: audioName || 'audio.m4a',
        type: audioMimeType || 'audio/mpeg',
      });
      showAlert('Éxito', 'El acta se ha creado correctamente y se está procesando', true);
    } catch (error) {
      const err = error as {
        response?: {
          status?: number;
          data?: {
            detail?: string | {
              code?: string;
              resource?: string;
              message?: string;
            };
          };
        };
      };
      const detail = err?.response?.data?.detail;
      const quotaMessage =
        err?.response?.status === 429 &&
        detail &&
        typeof detail === 'object' &&
        detail.code === 'quota_exhausted' &&
        detail.resource === 'minutes'
          ? detail.message
          : null;
      const validationMessage =
        err?.response?.status === 422 && typeof detail === 'string'
          ? detail
          : null;

      if (!quotaMessage && !validationMessage) {
        console.error('Error saving minute:', error);
      }

      showAlert(
        'Error',
        quotaMessage || validationMessage || 'No se pudo crear el acta. Por favor, inténtalo de nuevo.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleAlertClose = () => {
    setAlertOpen(false);
    if (alertConfig.isSuccess) {
      onOpenChange(false);
      onSuccess();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Nueva Acta</DialogTitle>
          </DialogHeader>

          <View className="gap-6 py-4">
            <View className="gap-2">
              <Text className="ml-1 text-sm font-medium text-foreground">Título del Acta</Text>
              <Input
                placeholder="Ej. Junta Ordinaria Marzo 2026"
                value={title}
                onChangeText={setTitle}
                editable={!isUploading && !isRecording}
                className="h-12 text-base"
              />
            </View>

            {!audioUri ? (
              <View className="gap-4">
                <Text className="ml-1 text-sm font-medium text-foreground">Audio de la Sesión</Text>

                {isRecording ? (
                  <View className="w-full items-center gap-4 rounded-xl border border-destructive/20 bg-muted/30 p-6">
                    <View className="flex-row items-center gap-2">
                      <Icon as={Circle} size={12} className="fill-destructive text-destructive" />
                      <Text className="text-lg font-bold text-destructive">Grabando...</Text>
                    </View>
                    <Text className="font-mono text-4xl text-foreground">
                      {formatTime(durationMillis)}
                    </Text>
                    <Button
                      variant="destructive"
                      className="h-14 w-full flex-row items-center justify-center gap-2 rounded-xl"
                      onPress={stopRecording}>
                      <Icon as={X} size={20} className="text-destructive-foreground" />
                      <Text className="text-base font-bold text-destructive-foreground">
                        Finalizar Grabación
                      </Text>
                    </Button>
                  </View>
                ) : (
                  <View className="gap-4">
                    <Button
                      variant="outline"
                      className="h-16 w-full flex-row items-center justify-center gap-3 border-dashed"
                      onPress={startRecording}
                      disabled={isUploading}>
                      <Icon as={Mic} size={20} className="text-primary" />
                      <Text className="text-base font-medium text-foreground">Grabar Sesión</Text>
                    </Button>

                    <View className="flex-row items-center gap-3">
                      <View className="h-[1px] flex-1 bg-border" />
                      <Text className="text-xs font-medium italic text-muted-foreground">o</Text>
                      <View className="h-[1px] flex-1 bg-border" />
                    </View>

                    <Button
                      variant="outline"
                      className="h-16 w-full flex-row items-center justify-center gap-3 border-dashed"
                      onPress={handlePickDocument}
                      disabled={isUploading}>
                      <Icon as={Upload} size={20} className="text-primary" />
                      <Text className="text-base font-medium text-foreground">
                        Subir Archivo de Audio
                      </Text>
                    </Button>
                  </View>
                )}
              </View>
            ) : (
              <View className="gap-4">
                <View className="ml-1 flex-row items-center justify-between">
                  <Text className="text-sm font-medium text-foreground">Audio Preparado</Text>
                  <TouchableOpacity onPress={handleRemoveAudio} disabled={isUploading}>
                    <Text className="text-xs font-bold uppercase tracking-wider text-destructive">
                      Descartar
                    </Text>
                  </TouchableOpacity>
                </View>

                <AudioPlayer uri={audioUri} initialDuration={audioDuration ?? undefined} />

                <View className="flex-row items-center gap-2 rounded-lg border border-border/50 bg-muted/30 p-3">
                  <Icon as={Upload} size={16} className="text-muted-foreground" />
                  <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
                    {audioName}
                  </Text>
                </View>
              </View>
            )}

            {!isRecording && (
              <View className="gap-3 pt-2">
                <Button
                  className="h-14 w-full gap-2 rounded-xl"
                  onPress={handleSave}
                  disabled={isUploading || !audioUri || !title.trim()}>
                  {isUploading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <Icon as={Save} size={20} className="text-primary-foreground" />
                      <Text className="text-base font-bold text-primary-foreground">
                        Crear y Transcribir
                      </Text>
                    </>
                  )}
                </Button>
              </View>
            )}
          </View>
        </DialogContent>
      </Dialog>

      <Dialog open={alertOpen} onOpenChange={setAlertOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <View className="flex-row items-center gap-2">
              {!alertConfig.isSuccess && (
                <Icon as={AlertCircle} size={20} className="text-destructive" />
              )}
              <DialogTitle>{alertConfig.title}</DialogTitle>
            </View>
            <Text className="mt-2 text-sm text-muted-foreground">{alertConfig.description}</Text>
          </DialogHeader>
          <View className="mt-4">
            <Button className="h-12 w-full rounded-xl" onPress={handleAlertClose}>
              <Text className="font-bold text-primary-foreground">Entendido</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>
    </>
  );
}
