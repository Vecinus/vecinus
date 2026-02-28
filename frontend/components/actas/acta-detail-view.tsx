import React from "react";
import { View, Text } from "react-native";
import {
  Calendar,
  CheckCircle2,
  Sparkles,
  Download,
} from "lucide-react-native";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { COLORS } from "@/lib/colors";
import { Acta } from "@/types/acta";

interface ActaDetailViewProps {
  acta: Acta;
  isPresidente: boolean;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ActaDetailView({ acta, isPresidente }: ActaDetailViewProps) {
  return (
    <View className="flex flex-col gap-4">
      {/* Metadata */}
      <View className="flex-row items-center gap-2">
        <Calendar size={16} color={COLORS.mutedForeground} />
        <Text className="text-sm text-muted-foreground">
          {formatDate(acta.date)}
        </Text>
        <Text className="text-sm text-muted-foreground">·</Text>
        <Text className="text-sm text-muted-foreground">{acta.createdBy}</Text>
      </View>

      {/* Tabs */}
      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="summary">Resumen</TabsTrigger>
          <TabsTrigger value="agreements">Acuerdos</TabsTrigger>
          {isPresidente && (
            <TabsTrigger value="transcript">Transcripcion</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="summary" className="mt-3">
          <View className="bg-muted rounded-lg p-4">
            <View className="flex-row items-center gap-2 mb-2">
              <Sparkles size={16} color={COLORS.primary} />
              <Text className="text-sm font-semibold text-foreground">
                Resumen Ejecutivo
              </Text>
            </View>
            <Text className="text-sm text-foreground leading-relaxed">
              {acta.executiveSummary}
            </Text>
          </View>
        </TabsContent>

        <TabsContent value="agreements" className="mt-3">
          <View className="flex flex-col gap-2">
            <View className="flex-row items-center gap-2">
              <CheckCircle2 size={16} color={COLORS.primary} />
              <Text className="text-sm font-semibold text-foreground">
                Acuerdos Adoptados
              </Text>
            </View>
            {acta.agreements.map((agreement, index) => (
              <View
                key={index}
                className="flex-row items-start gap-2 p-3 rounded-lg bg-muted/50"
              >
                <CheckCircle2
                  size={16}
                  color={COLORS.primary}
                  className="flex-shrink-0 mt-0.5"
                />
                <Text className="text-sm text-foreground flex-1">
                  {agreement}
                </Text>
              </View>
            ))}
          </View>
        </TabsContent>

        {isPresidente && (
          <TabsContent value="transcript" className="mt-3">
            <View className="bg-muted rounded-lg p-4">
              <Text className="text-sm font-semibold text-foreground mb-2">
                Registro Objetivo
              </Text>
              <Text className="text-sm text-foreground leading-relaxed">
                {acta.transcript}
              </Text>
            </View>
          </TabsContent>
        )}
      </Tabs>

      {/* Download Button */}
      <Button variant="outline" className="w-full">
        <View className="flex-row items-center gap-2">
          <Download size={16} color={COLORS.foreground} />
          <Text className="text-sm font-medium text-foreground">
            Descargar acta (PDF)
          </Text>
        </View>
      </Button>
    </View>
  );
}
