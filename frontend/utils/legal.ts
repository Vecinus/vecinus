import { Linking, Platform } from 'react-native';

export const openLegalDocument = () => {
  if (Platform.OS === 'web') {
    window.open('/documents/DOCUMENTACION_LEGAL_INTEGRAL.pdf', '_blank');
  } else {
    Linking.openURL('file:///documents/DOCUMENTACION_LEGAL_INTEGRAL.pdf');
  }
};
