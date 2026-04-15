import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Buffer } from 'buffer';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  Calendar,
  CheckCircle2,
  Sparkles,
  Download,
  ChevronLeft,
  Briefcase,
  FileText,
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { storageService } from '@/api/services/storage.service';
import { MinutesReadResponse, AgreementResult } from '@/types/minutes.types';
import { apiClient } from '@/api/client';
import { cn } from '@/lib/utils';
import { NAV_THEME } from '@/lib/theme';
import { useColorScheme } from 'nativewind';
import { isAdminOrPresident } from '@/utils/role.util';

type TabKey = 'summary' | 'agreements' | 'tasks' | 'transcription';

export default function ActaDetail() {
  const { communityId, actaId } = useLocalSearchParams<{ communityId: string; actaId: string }>();
  const router = useRouter();
  const [acta, setActa] = useState<MinutesReadResponse | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('summary');
  const [downloading, setDownloading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);
  const [errorDialogMessage, setErrorDialogMessage] = useState('');
  const [activeCommunity, setActiveCommunity] = useState<any>(null);
  const { colorScheme } = useColorScheme();
  const theme = NAV_THEME[colorScheme ?? 'light'];

  useEffect(() => {
    const loadActiveCommunity = async () => {
      const community = await storageService.getActiveCommunity();
      setActiveCommunity(community);
    };
    loadActiveCommunity();
  }, []);

  useEffect(() => {
    const loadActa = async () => {
      setLoading(true);
      const storedActa = await storageService.getSelectedMinute();
      if (storedActa && String((storedActa).id) === String(actaId)) {
          setActa(storedActa as MinutesReadResponse);
        } else {
          setActa(null);
        }
      setLoading(false);
    };
    void loadActa();
  }, [actaId]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!acta) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-xl font-bold text-foreground">No se encontró el acta</Text>
        <Button className="mt-4" onPress={() => router.push(`/${communityId}/actas`)}>
          <Text>Volver</Text>
        </Button>
      </View>
    );
  }

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: 'summary', label: 'Resumen', icon: Sparkles },
    { key: 'agreements', label: 'Acuerdos', icon: CheckCircle2 },
    ...(acta.tasks && acta.tasks.length > 0
      ? [{ key: 'tasks' as TabKey, label: 'Tareas', icon: Briefcase }]
      : []),
    ...(acta.transcription
      ? [{ key: 'transcription' as TabKey, label: 'Transcripción', icon: FileText }]
      : []),
  ];

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const payload = {
        title: acta.title,
        scheduled_at: acta.scheduled_at,
        location: acta.location,
        meeting_type: acta.meeting_type,
        version: acta.version,
        transcription: acta.transcription,
        summary: acta.summary,
        agreements: acta.agreements,
        topics: acta.topics ?? [],
        tasks: acta.tasks ?? [],
      };

      const response = await apiClient.post('/api/minutes/generate-document-preview', payload, {
        responseType: Platform.OS === 'web' ? 'blob' : 'arraybuffer',
      });

      const fileName = `acta_${acta.title.replace(/\s+/g, '_')}.docx`;

      if (Platform.OS === 'web') {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else {
        const base64 = Buffer.from(response.data).toString('base64');
        const destinationUri = `${FileSystem.documentDirectory}${fileName}`;

        if (!destinationUri) {
          throw new Error('No se pudo obtener la ruta de documentos en el dispositivo');
        }

        await FileSystem.writeAsStringAsync(destinationUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(destinationUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            dialogTitle: 'Compartir acta',
          });
        } else {
          setErrorDialogMessage(`Acta guardada en: ${destinationUri}`);
          setIsErrorDialogOpen(true);
        }
      }
    } catch (err) {
      console.error('Error:', err);
      setErrorDialogMessage('No se pudo descargar el acta');
      setIsErrorDialogOpen(true);
    } finally {
      setDownloading(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'summary':
        return (
          <Card className="border-border bg-card/50">
            <CardContent className="p-6">
              <View className="mb-4 flex-row items-center gap-2">
                <Icon as={Sparkles} size={20} className="text-primary" />
                <Text className="text-lg font-bold text-foreground">Resumen Ejecutivo</Text>
              </View>
              <Text className="text-base leading-6 text-muted-foreground">{acta.summary}</Text>
            </CardContent>
          </Card>
        );

      case 'agreements':
        return (
          <View className="gap-4">
            {acta.agreements.map((agreement, index) => (
              <Card key={index} className="border-border">
                <CardContent className="flex-row gap-4 p-4">
                  <View
                    className={cn(
                      'h-10 w-10 flex-shrink-0 items-center justify-center rounded-full',
                      agreement.result === AgreementResult.APPROVED
                        ? 'bg-green-500/10'
                        : 'bg-red-500/10'
                    )}>
                    <Icon
                      as={CheckCircle2}
                      size={20}
                      className={
                        agreement.result === AgreementResult.APPROVED
                          ? 'text-green-600'
                          : 'text-red-600'
                      }
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-medium text-foreground">
                      {agreement.description}
                    </Text>
                    <View className="mt-2 flex-row items-center gap-2">
                      <View
                        className={cn(
                          'rounded-md px-2 py-0.5',
                          agreement.result === AgreementResult.APPROVED
                            ? 'bg-green-500/20'
                            : 'bg-red-500/20'
                        )}>
                        <Text
                          className={cn(
                            'text-[10px] font-bold uppercase',
                            agreement.result === AgreementResult.APPROVED
                              ? 'text-green-700'
                              : 'text-red-700'
                          )}>
                          {agreement.result === AgreementResult.APPROVED ? 'Aprobado' : 'Denegado'}
                        </Text>
                      </View>
                      {agreement.details && (
                        <Text className="text-xs italic text-muted-foreground">
                          {agreement.details}
                        </Text>
                      )}
                    </View>
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        );

      case 'tasks':
        return (
          <View className="gap-4">
            {acta.tasks?.map((task, index) => (
              <Card key={index} className="border-border">
                <CardContent className="p-4">
                  <View className="mb-2 flex-row items-start justify-between">
                    <View className="flex-row items-center gap-2">
                      <Icon as={Briefcase} size={16} className="text-primary" />
                      <Text className="font-bold text-foreground">{task.responsible}</Text>
                    </View>
                    <View className="rounded-md bg-muted px-2 py-1">
                      <Text className="text-[10px] font-medium text-muted-foreground">
                        {task.deadline}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-sm text-muted-foreground">{task.description}</Text>
                </CardContent>
              </Card>
            ))}
          </View>
        );

      case 'transcription':
        const paragraphs = acta.transcription
          ? acta.transcription.split(/\n\s*\n+/).filter(Boolean)
          : [];

        return (
          <Card className="w-full border-border bg-card/50">
            <CardContent className="p-6">
              <View className="mb-4 flex-row items-center gap-2">
                <Text className="text-lg font-bold text-foreground">Transcripción</Text>
              </View>
              {paragraphs.length > 0 ? (
                paragraphs.map((paragraph, idx) => (
                  <Text
                    key={idx}
                    className="mb-3 break-words text-base leading-6 text-muted-foreground">
                    {paragraph.replace(/\n/g, ' ')}
                  </Text>
                ))
              ) : (
                <Text className="text-base leading-6 text-muted-foreground">
                  No hay transcripción disponible.
                </Text>
              )}
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <View className="flex-1 bg-background">
      <Drawer.Screen
        options={{
          title: acta.title,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.push(`/${communityId}/actas`)}
              className="ml-2 rounded-full p-2 active:bg-muted">
              <Icon as={ChevronLeft} size={24} className="text-foreground" />
            </TouchableOpacity>
          ),
          headerRight: () =>
            isAdminOrPresident(activeCommunity.role) ? (
              <TouchableOpacity
                onPress={() => { void handleDownload(); }}
                disabled={downloading}
                className="mr-4 rounded-full p-2 active:bg-muted">
                {downloading ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Icon as={Download} size={24} className="text-foreground" />
                )}
              </TouchableOpacity>
            ) : null,
        }}
      />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        <View className="mb-6 flex-row items-center justify-between gap-3">
          <View>
            <Select
              value={{
                value: activeTab,
                label: tabs.find((t) => t.key === activeTab)?.label || '',
              }}
              onValueChange={(val) => {
                if (val) setActiveTab(val.value as TabKey);
              }}>
              <SelectTrigger className="min-w-[140px]">
                <SelectValue placeholder="Sección" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {tabs.map((tab) => (
                    <SelectItem key={tab.key} value={tab.key} label={tab.label} />
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </View>
          <View className="flex-row items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5">
            <Icon as={Calendar} size={14} className="text-muted-foreground" />
            <Text className="text-[10px] font-medium text-muted-foreground">
              {new Date(acta.scheduled_at).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </View>
        </View>
        <View className="mb-8">{renderTabContent()}</View>
      </ScrollView>

      <AlertDialog open={isErrorDialogOpen} onOpenChange={setIsErrorDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>{errorDialogMessage}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogAction onPress={() => setIsErrorDialogOpen(false)}>
              Cerrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
