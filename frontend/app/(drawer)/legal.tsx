import { Drawer } from 'expo-router/drawer';

import { LegalDocumentView } from '@/components/legal/legal-document-view';

export default function LegalScreen() {
  return (
    <>
      <Drawer.Screen
        options={{
          title: 'Documentación legal',
          drawerItemStyle: { display: 'none' },
        }}
      />
      <LegalDocumentView />
    </>
  );
}
