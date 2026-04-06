import React from "react";
import { View } from "react-native";
import { LucideIcon } from "lucide-react-native";
import { Card, CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";

interface FeatureProps {
  Icon: LucideIcon;
  title: string;
  desc: string;
}

export function Feature({ Icon, title, desc }: FeatureProps) {
  return (
    <Card className="w-full md:w-[48%]">
      <CardContent>
        <View className="flex-row items-center gap-4">
          <View className="w-14 h-14 rounded-xl items-center justify-center bg-blue-100 dark:bg-blue-900/30">
            <Icon size={26} color="#5c90cf" />
          </View>

          <View className="flex-1">
            <Text className="font-semibold">{title}</Text>
            <Text className="text-muted-foreground">{desc}</Text>
          </View>
        </View>
      </CardContent>
    </Card>
  );
}