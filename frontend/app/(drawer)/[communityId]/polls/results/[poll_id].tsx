import React, { useEffect, useState } from 'react';
import { View, ScrollView, Share, Alert as RNAlert, TouchableOpacity } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { usePollResults, useDownloadPollPDF } from '@/hooks/usePolls';
import { ResultsView } from '@/components/polls/ResultsView';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ChevronLeft, CircleAlertIcon } from 'lucide-react-native';

export default function PollResultsScreen() {
  const params = useLocalSearchParams();
  const { activeCommunity } = useAuth();
  const associationId = activeCommunity ? activeCommunity.id : '';

  const poll_id = params?.poll_id as string;

  const [isDownloading, setIsDownloading] = useState(false);

  const { data: results, isLoading, error } = usePollResults(associationId, poll_id);
  const { mutateAsync: downloadPDF } = useDownloadPollPDF();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => router.push(`/${associationId}/polls`)}
          className="ml-2 mr-4 p-1">
          <ChevronLeft size={26} className="text-foreground" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, router, associationId]);

  const handleDownloadPDF = async () => {
    try {
      setIsDownloading(true);
      const blob = await downloadPDF(poll_id);

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const base64Data = dataUrl.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = () => {
          reject(new Error('Error al leer el Blob del PDF'));
        };
        reader.readAsDataURL(blob);
      });

      const uri = FileSystem.documentDirectory + `votacion_${poll_id}.pdf`;

      await FileSystem.writeAsStringAsync(uri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Descargar o compartir Acta ${poll_id}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        RNAlert.alert('Aviso', 'Tu dispositivo no soporta la función de compartir archivos.');
      }
    } catch (err: any) {
      console.error('Error downloading PDF:', err);
      RNAlert.alert('Error', 'No se pudo descargar el PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Resultados' }} />
        <View className="flex-1 items-center justify-center bg-background">
          <Text className="text-muted-foreground">Cargando resultados...</Text>
        </View>
      </>
    );
  }

  if (error || !results) {
    return (
      <>
        <Stack.Screen options={{ title: 'Error' }} />
        <View className="flex-1 bg-background">
          <Alert icon={CircleAlertIcon} className="m-4 border-red-500 bg-red-50">
            <AlertTitle className="font-bold text-red-800">Error al cargar</AlertTitle>
            <AlertDescription className="mt-1 text-sm text-red-700">
              No se pudieron cargar los resultados de la votación
            </AlertDescription>
          </Alert>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Resultados de la Votación',
          headerShown: true,
        }}
      />
      <View className="flex-1 bg-background">
        <ResultsView
          results={results}
          onDownloadPDF={handleDownloadPDF}
          isDownloadingPDF={isDownloading}
        />
      </View>
    </>
  );
}
