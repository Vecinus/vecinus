import { createMMKV } from "react-native-mmkv";

// Implementación Móvil usando MMKV (es síncrono por defecto)
// El bundler usará esto nativamente en iOS/Android

interface SyncStorage {
  set: (key: string, value: string) => void;
  getString: (key: string) => string | undefined;
  delete: (key: string) => void;
  clear: () => void;
}

const mmkvInstance = createMMKV({ id: "vecinus-storage" });

export const storage: SyncStorage = {
  set: (key, value) => mmkvInstance.set(key, value),
  getString: (key) => mmkvInstance.getString(key),
  delete: (key) => mmkvInstance.remove(key),
  clear: () => mmkvInstance.clearAll(),
};
