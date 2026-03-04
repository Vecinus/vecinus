
// store/useCommunityStore.ts
import { create } from 'zustand';
import { fetchUserCommunities } from '../services/communityService';

export interface Community {
  id: string;
  name: string;
}

interface CommunityState {
  communities: Community[];
  activeCommunityId: string;
  activeCommunityName: string;
  userToken: string;
  isLoading: boolean;
  error: string | null;
  setActiveCommunity: (id: string, name: string) => void;
  loadCommunities: () => Promise<void>;
}

export const useCommunityStore = create<CommunityState>((set, get) => ({
  communities: [],
  activeCommunityId: '', 
  activeCommunityName: 'Seleccionar...',
  
  // RECUERDA: Si ves "Error de conexión" de nuevo, 
  // es que este token de Bruno ha caducado (duran 60 min).
  userToken: 'eyJhbGciOiJFUzI1NiIsImtpZCI6IjBjOTk0ODE0LTIxOTktNGZlYS1iMmZiLTI3ZmVmOWQ1OTVmOCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FzZ21wbHN3bnRuamt4dHllYnZiLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJlOTUyZTQ3Mi02YTIzLTQ2MDYtODE3Yy1lNTJmOTU1ZTUyODciLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzcyNjI5Mjc5LCJpYXQiOjE3NzI2MjU2NzksImVtYWlsIjoicHJ1ZWJhMUBwcnVlYmEuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbF92ZXJpZmllZCI6dHJ1ZX0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3NzI2MjU2Nzl9XSwic2Vzc2lvbl9pZCI6IjdhNTJlOWRkLTI3ODktNGY1Mi1hZGIxLTE4NWZjYzY4ZWYxNSIsImlzX2Fub255bW91cyI6ZmFsc2V9.eDRoLbAS6U725vqqN0YgcVlDQUQqkUWG5gNgzRGgb_-S5NpaLvyoZLRNWR9phbLMMF_OcJQFsp6SkgZEE9e9HQ',

  isLoading: false,
  error: null,
  
  setActiveCommunity: (id, name) => set({ 
    activeCommunityId: id, 
    activeCommunityName: name 
  }),

  loadCommunities: async () => {
    const { userToken, communities } = get();
    if (communities.length > 0) return; 

    set({ isLoading: true, error: null, activeCommunityName: 'Cargando...' });
    
    try {
      const responseData = await fetchUserCommunities(userToken);
      
      // LOG DE DEPURACIÓN: Abre la consola (F12) para ver si llegan datos
      console.log("Datos brutos del backend:", responseData);

      // MAPEADO CORRECTO: Entramos en 'neighborhood_associations'
      const mappedCommunities = responseData.map((item: any) => ({
        id: item.neighborhood_associations.id,
        name: item.neighborhood_associations.name
      }));
      
      console.log("Datos mapeados para el menú:", mappedCommunities);

      if (mappedCommunities.length > 0) {
        set({ 
          communities: mappedCommunities, 
          isLoading: false,
          activeCommunityId: mappedCommunities[0].id,
          activeCommunityName: mappedCommunities[0].name,
          error: null
        });
      } else {
        set({ 
          isLoading: false, 
          activeCommunityName: 'Sin comunidades', 
          error: null,
          communities: [] 
        });
      }
    } catch (err: any) {
      console.error("Error cargando comunidades:", err);
      set({ 
        isLoading: false, 
        error: err.message, 
        activeCommunityName: 'Error de conexión.',
        communities: [] 
      });
    }
  }
}));