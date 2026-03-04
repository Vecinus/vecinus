import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { AlertCircle, RefreshCw } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { COLORS } from "@/lib/colors";

/** Estado de carga del reproductor */
export function AudioPlayerLoading() {
  return (
    <View className="bg-muted/50 rounded-lg p-4 gap-3 items-center justify-center min-h-[160px]">
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text className="text-sm text-muted-foreground">Cargando audio...</Text>
      <Text className="text-xs text-muted-foreground">
        Esto puede tardar unos segundos
      </Text>
    </View>
  );
}

/** Estado de error del reproductor */
export function AudioPlayerError({
  onRetry,
  onDelete,
}: {
  onRetry: () => void;
  onDelete: () => void;
}) {
  return (
    <View className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 gap-3 items-center justify-center min-h-[160px]">
      <AlertCircle size={32} color={COLORS.destructive} />
      <Text className="text-sm font-medium text-destructive text-center">
        No se pudo cargar el audio
      </Text>
      <Text className="text-xs text-muted-foreground text-center">
        El archivo puede estar corrupto o en un formato no soportado
      </Text>
      <View className="flex-row gap-2 mt-2">
        <Button variant="outline" onPress={onRetry} className="flex-1">
          <View className="flex-row items-center gap-2">
            <RefreshCw size={16} color={COLORS.foreground} />
            <Text className="text-sm font-medium">Reintentar</Text>
          </View>
        </Button>
        <Button variant="destructive" onPress={onDelete} className="flex-1">
          <Text className="text-sm font-medium text-destructive-foreground">
            Eliminar
          </Text>
        </Button>
      </View>
    </View>
  );
}
