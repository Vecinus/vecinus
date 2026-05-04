import { Linking, Platform } from 'react-native';

const LEGAL_DOCUMENT_URL = '/documents/DOCUMENTACION_LEGAL_INTEGRAL.pdf';

export const openLegalDocument = () => {
  if (Platform.OS === 'web') {
    window.open(LEGAL_DOCUMENT_URL, '_blank', 'noopener,noreferrer');
    return;
  }

  void Linking.openURL(`file://${LEGAL_DOCUMENT_URL}`);
};
