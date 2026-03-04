// services/communityService.ts

export interface Community {
  id: string;
  name: string;
}

export const fetchUserCommunities = async (token: string): Promise<Community[]> => {
  // ⚠️ IMPORTANTE: CAMBIA ESTA IP POR LA TUYA (ej: 192.168.1.34)
  // Si usas el emulador de Android Studio, pon: http://10.0.2.2:8000
  const API_URL = 'http://localhost:8000'; // o http://127.0.0.1:8000; 
  
  try {
    const response = await fetch(`${API_URL}/users/me/communities`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Error del servidor');
    }

    return await response.json();
  } catch (error) {
    console.error("Error en fetchUserCommunities:", error);
    throw new Error("Error de conexión.");
  }
};