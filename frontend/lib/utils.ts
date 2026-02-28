import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Alert } from "react-native";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea milisegundos a "MM:SS".
 * Se usa tanto en el reproductor de audio como en el botón de grabación.
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}

/**
 * Formatea segundos a "MM:SS" (para el reproductor de audio).
 */
export function formatSeconds(seconds: number): string {
  return formatTime(seconds * 1000);
}

/** Extensiones de audio aceptadas */
const AUDIO_EXTENSIONS = [".mp3", ".m4a", ".wav", ".aac", ".ogg", ".webm"];

export function isAudioFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Muestra un diálogo de confirmación multiplataforma (web + nativo).
 * Devuelve true si el usuario confirma.
 */
export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void
): void {
  if (typeof window !== "undefined" && window.confirm) {
    if (window.confirm(message)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: "Cancelar", style: "cancel" },
      { text: "Confirmar", style: "destructive", onPress: onConfirm },
    ]);
  }
}
