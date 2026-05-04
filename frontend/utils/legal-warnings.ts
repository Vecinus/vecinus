type LegalWarningType = 'voice_signature' | 'document_upload' | 'image_upload';

const warnings: Record<LegalWarningType, string> = {
  voice_signature:
    'Por favor, revisa la transcripción, no nos hacemos responsables de errores causados por la IA.',
  document_upload:
    'Por favor, asegúrate de que el documento no contiene nombres de personas ni información sensible, ya que puede ser filtrada mediante preguntas al chatbot.',
  image_upload: 'Evita subir fotos donde aparezcan personas o matrículas para proteger la privacidad de todos.',
};

export const getLegalWarning = (type: LegalWarningType): string => warnings[type];
