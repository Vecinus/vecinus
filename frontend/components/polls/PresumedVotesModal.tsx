import React, { useState } from 'react';
import { View, FlatList, Modal } from 'react-native';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface NonVoter {
  membership_id: string;
  property_number: string;
  username?: string;
}

interface PresumpedVotesModalProps {
  visible: boolean;
  nonVoters: NonVoter[];
  selectedMembers: string[];
  onConfirm: (membershipIds: string[]) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

interface VoterCheckbox extends NonVoter {
  checked: boolean;
}

export const PresumpedVotesModal: React.FC<PresumpedVotesModalProps> = ({
  visible,
  nonVoters,
  selectedMembers,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const [checkedVoters, setCheckedVoters] = useState<VoterCheckbox[]>(
    nonVoters.map((voter) => ({
      ...voter,
      checked: selectedMembers.includes(voter.membership_id),
    }))
  );

  const handleToggleVoter = (membershipId: string) => {
    setCheckedVoters((prev) =>
      prev.map((voter) =>
        voter.membership_id === membershipId ? { ...voter, checked: !voter.checked } : voter
      )
    );
  };

  const handleConfirm = async () => {
    const selectedIds = checkedVoters
      .filter((voter) => voter.checked)
      .map((voter) => voter.membership_id);
    await onConfirm(selectedIds);
  };

  const selectedCount = checkedVoters.filter((v) => v.checked).length;

  const renderVoterItem = (voter: VoterCheckbox) => (
    <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
      <Checkbox
        checked={voter.checked}
        onCheckedChange={() => handleToggleVoter(voter.membership_id)}
      />
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground">
          Puerta {voter.property_number}
        </Text>
        {voter.username && (
          <Text className="mt-1 text-xs text-muted-foreground">{voter.username}</Text>
        )}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View className="flex flex-1 items-center justify-center bg-black bg-opacity-50 p-4">
        <Card className="max-h-[85vh] w-full bg-card">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-lg">Marcar Votos Presuntos (Ausentes)</CardTitle>
            <Text className="mt-2 text-sm text-muted-foreground">
              Selecciona los propietarios ausentes que deseas marcar como voto presunto según LPH
              Art. 17.4
            </Text>
          </CardHeader>

          <CardContent className="pt-4">
            {nonVoters.length === 0 ? (
              <Alert className="border-green-200 bg-green-50">
                <AlertTitle className="font-semibold text-green-800">✓ Todos han votado</AlertTitle>
                <AlertDescription className="mt-1 text-sm text-green-700">
                  No hay propietarios ausentes para marcar como presumidos
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Alert className="mb-4 border-orange-200 bg-orange-50">
                  <AlertTitle className="font-semibold text-orange-800">
                    Seleccionados: {selectedCount}
                  </AlertTitle>
                  <AlertDescription className="mt-1 text-sm text-orange-700">
                    {selectedCount > 0
                      ? `${selectedCount} propietario${selectedCount > 1 ? 's' : ''} será${selectedCount > 1 ? 'n' : 'á'} contado${selectedCount > 1 ? 's' : ''} como voto presunto`
                      : 'Ninguno seleccionado'}
                  </AlertDescription>
                </Alert>

                <View className="max-h-96">
                  <FlatList
                    data={checkedVoters}
                    renderItem={({ item }) => renderVoterItem(item)}
                    keyExtractor={(item) => item.membership_id}
                    scrollEnabled={true}
                  />
                </View>
              </>
            )}

            <View className="mt-6 flex-row justify-end gap-3">
              <Button variant="outline" size="default" onPress={onCancel} disabled={isLoading}>
                <Text className="font-semibold">Cancelar</Text>
              </Button>
              <Button
                size="default"
                onPress={handleConfirm}
                disabled={isLoading || nonVoters.length === 0}>
                <Text className="font-semibold text-white">
                  {isLoading ? 'Registrando...' : 'Confirmar Presuntos'}
                </Text>
              </Button>
            </View>
          </CardContent>
        </Card>
      </View>
    </Modal>
  );
};

export default PresumpedVotesModal;
