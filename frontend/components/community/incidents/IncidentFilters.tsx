import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Plus } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { FilterStatus } from '@/app/(drawer)/[communityId]/incidencias';

interface IncidentFiltersProps {
  filterTabs: { key: FilterStatus; label: string }[];
  activeFilter: FilterStatus;
  setActiveFilter: (filter: FilterStatus) => void;
  filteredCount: number;
  canCreateIncident: boolean;
  hasCompactActions: boolean;
  onCreatePress: () => void;
}

export function IncidentFilters({
  filterTabs,
  activeFilter,
  setActiveFilter,
  filteredCount,
  canCreateIncident,
  hasCompactActions,
  onCreatePress,
}: IncidentFiltersProps) {
  return (
    <View className="px-5 mt-4 mb-4 flex-row items-center justify-between z-10">
      {/* Left Side: Tabs + Counter */}
      <View className="flex-1 flex-row items-center mr-3">
        <View className="flex-shrink">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
            <View className="flex-row gap-2">
              {filterTabs.map((tab) => {
                const selected = tab.key === activeFilter;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => setActiveFilter(tab.key)}
                    className={`px-3.5 py-2 rounded-xl border transition-all duration-200 justify-center h-11 ${
                      selected
                        ? 'bg-primary/5 border-primary/30 shadow-sm'
                        : 'bg-transparent border-transparent'
                    }`}
                  >
                    <Text
                      className={`text-sm font-semibold tracking-wide ${
                        selected ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Separador vertical y contador */}
        <View className="w-px h-6 bg-border mx-2" />

        <View className="flex-row items-center justify-center bg-primary/5 border border-primary/30 min-w-[44px] px-3 h-11 rounded-xl">
          <Text className="text-base font-black text-red-500">
            {filteredCount}
          </Text>
        </View>
      </View>

      {/* Right Side: Button */}
      <View className="flex-shrink-0">
        {canCreateIncident ? (
          <Button
            className={`h-11 shadow-sm bg-primary justify-center ${
              hasCompactActions ? 'w-11 px-0 rounded-xl' : 'px-4 rounded-xl gap-2'
            }`}
            onPress={onCreatePress}
          >
            <Plus size={20} color="#fff" />
            {!hasCompactActions ? <Text className="text-primary-foreground font-bold text-sm">Nueva</Text> : null}
          </Button>
        ) : null}
      </View>
    </View>
  );
}
