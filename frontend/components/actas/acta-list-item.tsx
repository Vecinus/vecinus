import React from "react";
import { View, Text } from "react-native";
import { FileText, Calendar, Eye } from "lucide-react-native";
import { Card, CardContent } from "@/components/ui/card";
import { COLORS } from "@/lib/colors";
import { Acta } from "@/types/acta";

interface ActaListItemProps {
  acta: Acta;
  onPress: () => void;
}

export function ActaListItem({ acta, onPress }: ActaListItemProps) {
  return (
    <Card onPress={onPress}>
      <CardContent className="p-4">
        <View className="flex-row items-start gap-3">
          <View className="w-10 h-10 rounded-lg bg-primary/10 items-center justify-center flex-shrink-0">
            <FileText size={20} color={COLORS.primary} />
          </View>
          <View className="flex-1">
            <Text className="font-medium text-foreground">{acta.title}</Text>
            <Text
              className="text-sm text-muted-foreground mt-1"
              numberOfLines={2}
            >
              {acta.executiveSummary}
            </Text>
            <View className="flex-row items-center gap-2 mt-2">
              <View className="flex-row items-center gap-1">
                <Calendar size={12} color={COLORS.mutedForeground} />
                <Text className="text-xs text-muted-foreground">
                  {new Date(acta.date).toLocaleDateString("es-ES")}
                </Text>
              </View>
              <View className="px-2 py-0.5 rounded-full bg-primary/10">
                <Text className="text-xs text-primary">
                  {acta.agreements.length} acuerdos
                </Text>
              </View>
            </View>
          </View>
          <Eye
            size={16}
            color={COLORS.mutedForeground}
            className="flex-shrink-0 mt-1"
          />
        </View>
      </CardContent>
    </Card>
  );
}
