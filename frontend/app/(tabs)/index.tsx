import { Image } from 'expo-image';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { Menu } from 'lucide-react-native';

import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function HomeScreen() {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const colorScheme = useColorScheme();

  return (
    <View style={{ flex: 1 }}>
      {/* Botón de menú hamburguesa - FLOTANTE SOBRE TODO */}
      <TouchableOpacity 
        style={styles.menuButton} 
        onPress={() => navigation.openDrawer()}
      >
        <Menu color="#ffffff" size={28} />
      </TouchableOpacity>

      <ParallaxScrollView
        headerBackgroundColor={{ light: '#5c90cf', dark: '#385e8a' }}
        headerImage={
          <View style={styles.headerContainer}>
            <Image
              source={require('@/assets/logos/VecinusImagotipoTransparente.png')}
              style={styles.vecinusLogo}
              contentFit="contain"
            />
          </View>
        }>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title">¡Bienvenido a Vecinus!</ThemedText>
          <HelloWave />
        </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Tu comunidad conectada</ThemedText>
        <ThemedText>
          Vecinus es tu plataforma para gestionar y conectar con tu comunidad de vecinos de manera fácil y eficiente.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">¿Qué puedes hacer?</ThemedText>
        <ThemedText>
          • Consulta y participa en las actas de la comunidad{'\n'}
          • Chatea con el asistente virtual de tu comunidad{'\n'}
          • Reserva espacios comunes{'\n'}
          • Mantente informado de las novedades
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Comenzar</ThemedText>
        <ThemedText>
          Usa el <ThemedText type="defaultSemiBold">menú lateral</ThemedText> (desliza desde la izquierda o toca el ícono de menú) para navegar por las diferentes secciones de la aplicación.
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  vecinusLogo: {
    height: '80%',
    width: '80%',
  },
  menuButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 1000,
    backgroundColor: '#000000',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 16,
  },
});
