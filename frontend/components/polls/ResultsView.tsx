import React from 'react';
import { View, ScrollView, FlatList } from 'react-native';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { PollResults, OptionResult, VoterDetail } from '@/types/polls.types';

interface ResultsViewProps {
  results: PollResults;
}

const renderVoterRow = (voter: VoterDetail) => (
  <View
    key={`${voter.property_number}-${voter.coefficient}`}
    className="flex-row items-center gap-2 border-b border-border px-4 py-3">
    <View className="flex-1">
      <Text className="text-sm font-semibold text-foreground">{voter.property_number}</Text>
      <Text className="text-xs text-muted-foreground">
        Votó por: <Text className="font-semibold">{voter.voted_for}</Text>
      </Text>
    </View>
    <View className="items-end gap-1">
      <Text className="text-sm font-bold text-blue-600">{voter.coefficient.toFixed(2)}%</Text>
      {voter.is_presumed && (
        <Badge className="bg-orange-100 px-2">
          <Text className="text-xs font-semibold text-orange-700">Presunto</Text>
        </Badge>
      )}
    </View>
  </View>
);

export const ResultsView: React.FC<ResultsViewProps> = ({ results }) => {
  const totalVoters = results.census_eligible_voters;
  const totalCoefficient = results.census_eligible_coefficient;

  const calculatePersonPercentage = (count: number): number => {
    return totalVoters > 0 ? (count / totalVoters) * 100 : 0;
  };

  const calculateCoefficientPercentage = (coeff: number): number => {
    return totalCoefficient > 0 ? (coeff / totalCoefficient) * 100 : 0;
  };

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="px-4 py-6">
        <Card className="mb-6 border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100">
          <CardHeader>
            <CardTitle className="text-lg text-blue-900">Resumen del Censo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <View className="flex-row justify-between">
              <Text className="text-sm text-blue-800">Votantes elegibles:</Text>
              <Text className="text-sm font-bold text-blue-900">
                {results.census_eligible_voters}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-blue-800">Votos emitidos:</Text>
              <Text className="text-sm font-bold text-blue-900">{results.total_votes_cast}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-blue-800">Participación:</Text>
              <Text className="text-sm font-bold text-green-600">
                {totalVoters > 0 ? ((results.total_votes_cast / totalVoters) * 100).toFixed(1) : 0}%
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-blue-800">Coeficiente total elegible:</Text>
              <Text className="text-sm font-bold text-blue-900">
                {results.census_eligible_coefficient.toFixed(2)}%
              </Text>
            </View>
            {results.presumed_votes_applied > 0 && (
              <View className="mt-2 flex-row justify-between border-t border-blue-300 pt-2">
                <Text className="text-sm text-orange-700">Votos presuntos (ausentes):</Text>
                <Text className="text-sm font-bold text-orange-700">
                  {results.presumed_votes_applied}
                </Text>
              </View>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Doble Mayoría</CardTitle>
            <Text className="mt-2 text-xs text-muted-foreground">
              Se requiere mayoría simultánea de personas y de coeficientes
            </Text>
          </CardHeader>
          <CardContent className="space-y-6">
            {results.results.map((option: OptionResult, index: number) => {
              const personPercentage = calculatePersonPercentage(option.total_votes_count);
              const coefficientPercentage = calculateCoefficientPercentage(
                option.total_coefficient
              );

              return (
                <View key={index} className="space-y-3">
                  <View>
                    <Text className="mb-2 text-base font-bold text-foreground">
                      {option.option_text}
                    </Text>

                    <View className="mb-3 rounded-lg bg-gray-100 p-3">
                      <View className="mb-2 flex-row items-center justify-between">
                        <Text className="text-xs font-semibold text-gray-700">Por Personas</Text>
                        <Text className="text-xs font-bold text-blue-600">
                          {personPercentage.toFixed(1)}% ({option.total_votes_count})
                        </Text>
                      </View>
                      <Progress value={personPercentage} className="h-3 bg-gray-300" />
                    </View>

                    <View className="rounded-lg bg-gray-100 p-3">
                      <View className="mb-2 flex-row items-center justify-between">
                        <Text className="text-xs font-semibold text-gray-700">
                          Por Coeficientes
                        </Text>
                        <Text className="text-xs font-bold text-green-600">
                          {coefficientPercentage.toFixed(1)}% ({option.total_coefficient.toFixed(2)}
                          )
                        </Text>
                      </View>
                      <Progress value={coefficientPercentage} className="h-3 bg-gray-300" />
                    </View>
                  </View>

                  {personPercentage > 50 && coefficientPercentage > 50 && (
                    <Badge className="self-start bg-green-100 px-2 py-1">
                      <Text className="text-xs font-bold text-green-700">✓ Mayoria Doble</Text>
                    </Badge>
                  )}
                </View>
              );
            })}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <View>
              <CardTitle className="text-base">Lista Nominal de Votantes</CardTitle>
              <Text className="mt-1 text-xs text-muted-foreground">
                Registro transparente según LPH Art. 17
              </Text>
            </View>
          </CardHeader>
          <CardContent>
            {results.voters_list && results.voters_list.length > 0 ? (
              <FlatList
                data={results.voters_list}
                renderItem={({ item }) => renderVoterRow(item)}
                keyExtractor={(item, idx) => `${item.property_number}-${idx}`}
                scrollEnabled={false}
              />
            ) : (
              <Text className="py-4 text-center text-sm text-muted-foreground">
                Sin datos de votantes
              </Text>
            )}
          </CardContent>
        </Card>
      </View>
    </ScrollView>
  );
};

export default ResultsView;
