import { Image } from "expo-image";
import { StyleSheet, TouchableOpacity, View, Platform, useWindowDimensions, useColorScheme } from "react-native";
import { useNavigation, ParamListBase } from "@react-navigation/native";
import { DrawerNavigationProp } from "@react-navigation/drawer";
import { 
  Menu, 
  FileText, 
  MessageSquare, 
  CalendarDays, 
  BellRing,
  ChevronRight,
  LucideIcon
} from "lucide-react-native";

import { HelloWave } from "@/components/hello-wave";
import ParallaxScrollView from "@/components/parallax-scroll-view";
import { ThemedText } from "@/components/themed-text";

export default function HomeScreen() {
  const navigation = useNavigation<DrawerNavigationProp<ParamListBase>>();
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // --- LÓGICA RESPONSIVA ---
  const isDesktop = width >= 768;
  const contentMaxWidth = 800; // Ancho máximo para ordenador
  const dynamicPadding = isDesktop ? 40 : 20; // Más espacio en ordenador
  
  // --- PALETA DE COLORES ADAPTATIVA ---
  const colors = {
    background: isDark ? '#121212' : '#f8f9fa',
    cardBg: isDark ? '#1E1E1E' : '#ffffff',
    textMain: isDark ? '#FFFFFF' : '#2C3E50',
    textSub: isDark ? '#A0AAB5' : '#59626A',
    primary: isDark ? '#6fa8e7' : '#5c90cf', // Azul principal (más brillante en oscuro)
    primaryLight: isDark ? 'rgba(111, 168, 231, 0.15)' : 'rgba(92, 144, 207, 0.12)',
    border: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(92, 144, 207, 0.08)',
    menuBg: isDark ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
  };

  // Componente de Tarjeta
  const FeatureCard = ({ icon: Icon, title, description }: { icon: LucideIcon, title: string, description: string }) => (
    <View style={[
      styles.cardContainer, 
      { backgroundColor: colors.cardBg, borderColor: colors.border }
    ]}>
      <View style={[styles.cardIconWrapper, { backgroundColor: colors.primaryLight }]}>
        <Icon color={colors.primary} size={28} />
      </View>
      <View style={styles.cardTextContainer}>
        <ThemedText type="defaultSemiBold" style={[styles.cardTitle, { color: colors.textMain }]}>
          {title}
        </ThemedText>
        <ThemedText style={[styles.cardDescription, { color: colors.textSub }]}>
          {description}
        </ThemedText>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Botón Flotante Menú */}
      <TouchableOpacity
        style={[styles.menuButton, { backgroundColor: colors.menuBg }]}
        onPress={() => navigation.openDrawer()}
        activeOpacity={0.8}
      >
        <Menu color={colors.primary} size={26} strokeWidth={2.5} />
      </TouchableOpacity>

      <ParallaxScrollView
        headerBackgroundColor={{ light: "#5c90cf", dark: "#2C3E50" }}
        headerImage={
          <View style={styles.headerContainer}>
            <Image
              source={require("@/assets/logos/VecinusImagotipoTransparente.png")}
              style={[
                styles.vecinusLogo, 
                isDesktop && { height: "50%", width: "50%", maxWidth: 300 }
              ]}
              contentFit="contain"
              transition={1000}
            />
          </View>
        }
      >
        <View style={[
          styles.contentWrapper, 
          { 
            paddingHorizontal: dynamicPadding,
            maxWidth: contentMaxWidth,
            alignSelf: 'center', 
            width: '100%' 
          }
        ]}>
          
          {/* Bienvenida */}
          <View style={styles.headerTextContainer}>
            <View style={[styles.titleRow, isDesktop && { justifyContent: 'center' }]}>
              <ThemedText type="title" style={[
                styles.mainTitle, 
                { color: colors.textMain },
                isDesktop && { fontSize: 36 } 
              ]}>
                ¡Bienvenido a Vecinus!
              </ThemedText>
              <HelloWave />
            </View>
            <ThemedText style={[
              styles.subtitle, 
              { color: colors.primary },
              isDesktop && { textAlign: 'center', fontSize: 20 }
            ]}>
              Tu comunidad conectada e inteligente
            </ThemedText>
            <ThemedText style={[
              styles.descriptionText, 
              { color: colors.textSub },
              isDesktop && { textAlign: 'center', paddingHorizontal: 40 }
            ]}>
              Gestiona tu comunidad de vecinos de forma fácil, transparente y eficiente desde un solo lugar. Todo lo que necesitas, a un clic de distancia.
            </ThemedText>
          </View>

          {/* Sección de Funcionalidades */}
          <View style={styles.sectionContainer}>
            <ThemedText type="subtitle" style={[
              styles.sectionTitle, 
              { color: colors.textMain },
              isDesktop && { textAlign: 'center', marginBottom: 30 }
            ]}>
              ¿Qué puedes hacer?
            </ThemedText>
            
            {/* Contenedor Grid para las tarjetas (En PC se ponen en 2 columnas, en móvil 1) */}
            <View style={[isDesktop && styles.cardsGrid]}>
              <View style={[isDesktop && styles.gridItem]}>
                <FeatureCard 
                  icon={FileText} 
                  title="Actas y Votaciones" 
                  description="Consulta las actas de las reuniones y participa activamente en tu comunidad." 
                />
              </View>
              <View style={[isDesktop && styles.gridItem]}>
                <FeatureCard 
                  icon={MessageSquare} 
                  title="Asistente Virtual" 
                  description="Resuelve tus dudas al instante hablando con la IA entrenada de tu edificio." 
                />
              </View>
              <View style={[isDesktop && styles.gridItem]}>
                <FeatureCard 
                  icon={CalendarDays} 
                  title="Reserva de Espacios" 
                  description="Gestiona las reservas de piscina, pádel o salas comunes fácilmente." 
                />
              </View>
              <View style={[isDesktop && styles.gridItem]}>
                <FeatureCard 
                  icon={BellRing} 
                  title="Novedades y Avisos" 
                  description="Mantente informado de las últimas noticias y avisos importantes." 
                />
              </View>
            </View>
          </View>

          {/* CTA (Llamado a la acción) */}
          <View style={[isDesktop && { alignItems: 'center', marginTop: 20 }]}>
            <TouchableOpacity 
              style={[
                styles.ctaButton, 
                { backgroundColor: colors.primary },
                isDesktop && { width: 300 } // Botón contenido en PC
              ]}
              onPress={() => navigation.openDrawer()}
              activeOpacity={0.8}
            >
              <ThemedText style={styles.ctaButtonText}>Comenzar a explorar</ThemedText>
              <ChevronRight color="#ffffff" size={24} />
            </TouchableOpacity>
          </View>

        </View>
      </ParallaxScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Header Parallax
  headerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },
  vecinusLogo: {
    height: "65%",
    width: "65%",
    opacity: 0.95,
  },
  
  // Botón Flotante Menú
  menuButton: {
    position: "absolute",
    top: Platform.OS === 'ios' ? 60 : (Platform.OS === 'web' ? 20 : 40),
    left: Platform.OS === 'web' ? 20 : 20,
    zIndex: 1000,
    borderRadius: 16,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },

  // Contenedor principal de contenido
  contentWrapper: {
    paddingBottom: 60,
  },

  // Cabecera de Texto
  headerTextContainer: {
    marginTop: 20,
    marginBottom: 40,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 26,
    opacity: 0.9,
  },

  // Sección
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 20,
  },

  // Sistema Grid para Desktop
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  gridItem: {
    width: '48%', // Ocupa la mitad menos el gap en pantallas grandes
    minWidth: 300,
  },

  // Tarjetas de Funcionalidades
  cardContainer: {
    flexDirection: "row",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 4,
    borderWidth: 1,
  },
  cardIconWrapper: {
    width: 58,
    height: 58,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 18,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 22,
  },

  // Botón Call To Action
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    borderRadius: 24,
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    marginRight: 10,
  },
});