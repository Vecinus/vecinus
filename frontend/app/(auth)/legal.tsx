import { Stack } from 'expo-router';

import { LegalDocumentView } from '@/components/legal/legal-document-view';

export default function AuthLegalScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Documentación legal',
          headerTransparent: false,
        }}
      />
      <LegalDocumentView />
    </>
  );
}
