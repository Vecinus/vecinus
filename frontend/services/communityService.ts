import { API_URL } from "../constants/api";
import { Community, useCommunityStore } from "../store/useCommunityStore";

// frontend/services/communityService.ts

export const loadUserCommunities = async (token: string) => {
  console.log("!!! INICIANDO PETICIÓN AL BACKEND...");
  const store = useCommunityStore.getState();

  try {
    const response = await fetch(`${API_URL}/users/me/communities`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    console.log("!!! STATUS BACKEND:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("!!! ERROR BACKEND:", errorText);
      throw new Error("Error al obtener comunidades");
    }

    const data = await response.json();
    console.log("!!! DATOS RECIBIDOS DEL BACKEND:", data);

    // Verificamos si data es un array y tiene la estructura correcta
    if (!Array.isArray(data)) {
      console.error(
        "!!! FORMATO INCORRECTO: Se esperaba un array y se recibió:",
        typeof data,
      );
      return;
    }

    const formattedCommunities: Community[] = data.map((item: any) => {
      // Extraemos todos los campos necesarios para cumplir con la interfaz Community
      return {
        id: item.neighborhood_associations?.id || item.id,
        name:
          item.neighborhood_associations?.name ||
          item.name ||
          "Comunidad sin nombre",
        address:
          item.neighborhood_associations?.address ||
          item.address ||
          "Sin dirección", // CORRECCIÓN
        role: item.role ?? 0, // CORRECCIÓN: Usamos ?? por si el rol es 0 (valor válido)
      };
    });

    console.log("!!! COMUNIDADES PROCESADAS:", formattedCommunities);

    // ACTUALIZAMOS EL STORE
    store.setCommunities(formattedCommunities);

    // Seleccionamos la primera comunidad por defecto si no hay ninguna activa
    if (formattedCommunities.length > 0 && !store.activeCommunityId) {
      store.setActiveCommunity(
        formattedCommunities[0].id,
        formattedCommunities[0].name,
      );
      console.log(
        "!!! COMUNIDAD ACTIVA SETEADA:",
        formattedCommunities[0].name,
      );
    }
  } catch (error) {
    console.error("!!! ERROR CRÍTICO EN loadUserCommunities:", error);
  }
};
