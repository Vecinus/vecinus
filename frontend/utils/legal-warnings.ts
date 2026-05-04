export type LegalWarningType = 'voice_signature' | 'document_upload' | 'image_upload';

export function getLegalWarning(type: LegalWarningType): string {
  switch (type) {
    case 'voice_signature':
      return 'Por favor, revisa la transcripción, no nos hacemos responsables de errores causados por la IA.';
    case 'document_upload':
      return 'Por favor, asegúrate de que el documento no contiene nombres de personas ni información sensible, ya que puede ser filtrada mediante preguntas al chatbot.';
    case 'image_upload':
      return 'Evita subir fotos donde aparezcan personas o matrículas para proteger la privacidad de todos.';
    default:
      return '';
  }
}
