import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import {
  CreditCard,
  FileCheck2,
  FileText,
  type LucideIcon,
  Lock,
  Scale,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

type LegalSection = {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tone: {
    wrapper: string;
    iconBox: string;
    icon: string;
  };
  items: string[];
};

const keyFacts = [
  { label: 'Aplicación', value: 'Vecinus' },
  { label: 'Contacto', value: 'vecinusispp@gmail.com' },
  { label: 'Jurisdicción', value: 'Sevilla, España' },
];

const legalSections: LegalSection[] = [
  {
    id: 'servicios',
    title: 'Descripción del servicio',
    subtitle: 'Funcionalidades principales y características de la plataforma Vecinus.',
    icon: Sparkles,
    tone: {
      wrapper: 'border-cyan-200 bg-cyan-50 dark:border-cyan-900/40 dark:bg-cyan-950/20',
      iconBox: 'bg-cyan-500/10',
      icon: 'text-cyan-600 dark:text-cyan-400',
    },
    items: [
      'Gestión de Juntas e IA: Grabación y transcripción automática de actas mediante Inteligencia Artificial.',
      'Votaciones Digitales: Sistema de votación ponderada por coeficiente de propiedad con integridad garantizada.',
      'Comunicación y Asistencia: Chat de vecinos, tablón de anuncios y Chatbot informativo (RAG) basado en normativa interna.',
      'Gestión Operativa: Reporte de incidencias fotográficas y reserva de zonas comunes mediante códigos QR.',
      'Panel Multicomunidad: Herramientas específicas para administradores profesionales.',
    ],
  },
  {
    id: 'precios',
    title: 'Precios',
    subtitle: 'Modelo de suscripción mensual por comunidad con dos planes disponibles.',
    icon: CreditCard,
    tone: {
      wrapper: 'border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20',
      iconBox: 'bg-rose-500/10',
      icon: 'text-rose-600 dark:text-rose-400',
    },
    items: [
      'Plan Básico: 20 € + 0,20 € por vivienda. Chatbot: 500 mensajes/mes + 5 por vivienda. Actas: 2h/mes acumulables hasta 10h.',
      'Plan Premium: 30 € + 0,50 € por vivienda. Chatbot: 1.000 mensajes/mes + 10 por vivienda. Actas: 4h/mes acumulables hasta 20h.',
      'Ejemplo Plan Básico: Comunidad de 50 viviendas → 20 € + (50 × 0,20 €) = 30 €/mes.',
      'Ejemplo Plan Premium: Comunidad de 50 viviendas → 30 € + (50 × 0,50 €) = 55 €/mes.',
    ],
  },
  {
    id: 'aviso-legal',
    title: 'Aviso legal',
    subtitle: 'Identificación de los responsables del proyecto y datos básicos de contacto.',
    icon: ShieldCheck,
    tone: {
      wrapper: 'border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/20',
      iconBox: 'bg-blue-500/10',
      icon: 'text-blue-600 dark:text-blue-400',
    },
    items: [
      'Titulares responsables: equipo promotor de Vecinus en el contexto del proyecto académico.',
      'NIF/CIF: G-00000000, actualmente en fase de desarrollo académico y constitución en trámite.',
      'Domicilio: ETSII, Avenida Reina Mercedes s/n, 41012, Sevilla.',
      'Correo de contacto: vecinusispp@gmail.com.',
    ],
  },
  {
    id: 'privacidad',
    title: 'Política de privacidad',
    subtitle: 'Tratamiento de datos personales conforme al RGPD y la LOPDGDD.',
    icon: Lock,
    tone: {
      wrapper: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20',
      iconBox: 'bg-emerald-500/10',
      icon: 'text-emerald-600 dark:text-emerald-400',
    },
    items: [
      'La comunidad de propietarios actúa como responsable del tratamiento y Vecinus como encargado.',
      'Se recogen email para autenticación y nombre para identificación visible dentro del chat comunitario.',
      'Las grabaciones usadas para generar actas se procesan para transcripción y el audio original se elimina tras generar el texto.',
      'Los documentos del chatbot se procesan dentro del contexto de la comunidad y no se usan para entrenar modelos externos.',
      'En incidencias, las imágenes deben centrarse en el desperfecto; no deben incluir rostros ni matrículas.',
      'La plataforma utiliza únicamente cookies técnicas y almacenamiento local necesario para mantener la sesión.',
      'Los derechos de acceso, rectificación, supresión y portabilidad pueden ejercerse por correo electrónico.',
    ],
  },
  {
    id: "terminos",
    title: "Términos y condiciones de uso",
    subtitle:
      "Normas de uso del servicio, límites de responsabilidad y uso de IA.",
    icon: FileText,
    tone: {
      wrapper:
        "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20",
      iconBox: "bg-amber-500/10",
      icon: "text-amber-700 dark:text-amber-400",
    },
    items: [
      "El código fuente, diseño y algoritmos pertenecen a los titulares identificados en el aviso legal.",
      "La redacción de actas y el chatbot están asistidos por inteligencia artificial.",
      "El contenido generado por IA es informativo y debe ser revisado y validado por el administrador antes de su uso oficial.",
      "La firma mediante trazo digital se considera firma electrónica simple para la aprobación interna de documentos.",
      "La gestión multicomunidad exige que el administrador tenga autorización para operar cada comunidad dada de alta.",
      "Sistema de votaciones: el voto estará ponderado según el porcentaje de propiedad; el usuario deberá estar autenticado mediante correo electrónico, siendo responsable de sus credenciales; los resultados se calcularán de forma ponderada y tendrán carácter vinculante salvo indicación en contrario.",
      "Vecinus se presenta como prototipo académico y los desarrolladores no asumen responsabilidad por fallos técnicos o decisiones tomadas con base en la app.",
      "Cualquier controversia se someterá a los juzgados y tribunales de Sevilla.",
    ],
  },
  {
    id: 'encargado',
    title: 'Contrato de encargado del tratamiento',
    subtitle: 'Compromisos esenciales asumidos por Vecinus respecto al tratamiento de datos.',
    icon: FileCheck2,
    tone: {
      wrapper: 'border-violet-200 bg-violet-50 dark:border-violet-900/40 dark:bg-violet-950/20',
      iconBox: 'bg-violet-500/10',
      icon: 'text-violet-700 dark:text-violet-400',
    },
    items: [
      'Los datos solo se tratarán siguiendo las instrucciones de la comunidad.',
      'Se aplican medidas de seguridad como cifrado y control de acceso por roles.',
      'La comunidad autoriza el uso de proveedores terceros necesarios para hosting e infraestructura de IA.',
      'Todo el equipo de desarrollo asume un deber de confidencialidad estricta.',
    ],
  },
];

function FactCard({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-w-[160px] flex-1 rounded-2xl border border-border bg-background/90 px-4 py-4">
      <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Text>
      <Text className="mt-2 text-sm font-semibold text-foreground">{value}</Text>
    </View>
  );
}

function LegalSectionCard({ section }: { section: LegalSection }) {
  return (
    <Card className={cn('rounded-3xl border shadow-sm shadow-black/5', section.tone.wrapper)}>
      <CardHeader className="gap-3">
        <View className="flex-row items-start gap-4">
          <View className={cn('size-12 items-center justify-center rounded-2xl', section.tone.iconBox)}>
            <Icon as={section.icon} size={24} className={section.tone.icon} />
          </View>
          <View className="flex-1">
            <CardTitle>{section.title}</CardTitle>
            <CardDescription>{section.subtitle}</CardDescription>
          </View>
        </View>
      </CardHeader>

      <CardContent className="gap-3">
        {section.items.map((item, index) => (
          <View key={`${section.id}-${index}`} className="flex-row gap-3">
            <View className="mt-2 size-2 rounded-full bg-primary" />
            <Text className="flex-1 text-sm leading-6 text-foreground">{item}</Text>
          </View>
        ))}
      </CardContent>
    </Card>
  );
}

export function LegalDocumentView() {
  return (
    <ScrollView className="flex-1 bg-background">
      <View className="mx-auto w-full max-w-6xl px-5 pb-12 pt-8 md:px-8 md:pt-10">
        <View className="overflow-hidden rounded-[30px] border border-blue-200 bg-blue-50 px-6 py-7 dark:border-blue-900/50 dark:bg-blue-950/30 md:px-8">
          <View className="mb-5 size-14 items-center justify-center rounded-2xl bg-blue-500/10">
            <Icon as={Scale} size={30} className="text-blue-600 dark:text-blue-400" />
          </View>

          <Text variant="h3" className="border-b-0 pb-0 text-left">
            Términos y documentación legal
          </Text>
          <Text className="mt-3 max-w-3xl text-muted-foreground">
            Toda la información legal de Vecinus, adaptada a una lectura nativa dentro de la app y organizada por bloques para que resulte más clara.
          </Text>

          <View className="mt-6 flex-row flex-wrap gap-3">
            {keyFacts.map((fact) => (
              <FactCard key={fact.label} label={fact.label} value={fact.value} />
            ))}
          </View>
        </View>

        <View className="mt-6 rounded-3xl border border-border bg-card px-6 py-6 shadow-sm shadow-black/5">
          <Text className="text-lg font-semibold text-foreground">Resumen rápido</Text>
          <Text className="mt-3 text-sm leading-6 text-muted-foreground">
            Vecinus opera como plataforma comunitaria con soporte de inteligencia artificial para actas y asistencia documental. La comunidad conserva el control sobre sus datos, el contenido generado por IA requiere validación humana y el uso de la app se enmarca en un prototipo académico con jurisdicción en Sevilla.
          </Text>
          <Separator className="my-5" />
          <Text className="text-sm leading-6 text-muted-foreground">
            Esta pantalla resume y presenta de forma legible el contenido legal principal del documento integral disponible para la plataforma.
          </Text>
        </View>

        <View className="mt-6 gap-5">
          {legalSections.map((section) => (
            <LegalSectionCard key={section.id} section={section} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
