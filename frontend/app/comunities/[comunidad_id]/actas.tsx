import React, { useCallback, useRef, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  Alert,
  TouchableOpacity,
  Modal,
  StyleSheet,
  StatusBar,
  Platform,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import {
  Sparkles,
  Upload,
  CheckCircle2,
  Clock,
  Menu,
  FileText,
} from "lucide-react-native";
import { useNavigation, useRouter, useLocalSearchParams } from "expo-router";
import { DrawerActions, useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RecordingButton } from "@/components/actas/recording-button";
import { AudioPlayer } from "@/components/actas/audio-player";
import { ActaDetailView } from "@/components/actas/acta-detail-view";
import { ActaSignature } from "@/components/actas/acta-signature";
import { ActaEditorModal } from "@/components/actas/acta-editor-modal";
import { ActaListItem } from "@/components/actas/acta-list-item";
import { RecordingResult } from "@/hooks/useAudioRecorder";
import { isAudioFile, confirmAction } from "@/lib/utils";
import { COLORS } from "@/lib/colors";
import { Acta } from "@/types/acta";
import { API_URL } from "@/constants/api";
import { useAuthStore } from "@/store/useAuthStore";
import { useCommunityStore } from '../../../store/useCommunityStore';

// ─── Pantalla principal ──────────────────────────────────────────────

export default function ActasScreen() {
  const { comunidad_id } = useLocalSearchParams();
  const normalizedComunidadId = Array.isArray(comunidad_id)
    ? comunidad_id[0]
    : comunidad_id;
  // TODO: obtener del contexto de autenticacion
  const { activeCommunityRole } = useCommunityStore();
  const isPresidente = activeCommunityRole === 1 || activeCommunityRole === 4;
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, isAuthenticated } = useAuthStore();

  // --- Estado global ---
  const [actas, setActas] = useState<Acta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedActa, setSelectedActa] = useState<Acta | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [signSuccessOpen, setSignSuccessOpen] = useState(false);
  const [authRequiredOpen, setAuthRequiredOpen] = useState(false);
  // Guarda el acta mientras el editor está abierto (el dialog del detalle se cierra)
  const editingActaRef = useRef<Acta | null>(null);
  // Guarda el acta mientras la firma está abierta (el dialog del detalle se cierra)
  const signingActaRef = useRef<Acta | null>(null);

  // --- Estado del formulario de creacion ---
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioDurationMs, setAudioDurationMs] = useState<number | null>(null);
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // --- Derivados ---
  const hasRecordedAudio = !!audioUri;
  const hasUploadedAudio = !!fileUri && !!fileName && isAudioFile(fileName);
  const hasUploadedNonAudio = !!fileUri && !!fileName && !isAudioFile(fileName);
  const hasAnyAudio = hasRecordedAudio || hasUploadedAudio;

  const fetchActas = useCallback(async () => {
    if (!normalizedComunidadId || !token) return;
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/minutes/${normalizedComunidadId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        const formattedData: Acta[] = data.map((item: any) => ({
          id: item.id || `a-${Math.random().toString(36).substr(2, 9)}`,
          association_id: item.association_id || normalizedComunidadId,
          title: item.title,
          scheduled_at: item.scheduled_at,
          location: item.location || "Residencial Vecinus",
          type: item.meeting_type || item.type || "ORDINARY",
          status: item.status || "DRAFT",
          version: item.version || 1,
          summary: item.summary,
          agreements: item.agreements || [],
          transcription: item.transcription,
          topics: item.topics || [],
          tasks: item.tasks || [],
          attendees: item.attendees || [],
          created_at: item.created_at,
          updated_at: item.updated_at,
          locked_at: item.locked_at,
        }));
        setActas(formattedData);
      }
    } catch (err) {
      console.error("[fetchActas] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [normalizedComunidadId, token]);

  useFocusEffect(
    React.useCallback(() => {
      if (!token || !isAuthenticated) {
        setAuthRequiredOpen(true);
      } else {
        setAuthRequiredOpen(false);
        fetchActas();
      }
    }, [token, isAuthenticated, fetchActas]),
  );

  if (!token || !isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />

        <Modal
          visible={authRequiredOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setAuthRequiredOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Inicia sesión</Text>
              <Text style={styles.modalMessage}>
                Para acceder a las actas necesitas iniciar sesión.
              </Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setAuthRequiredOpen(false);
                  router.replace("/auth/login");
                }}
              >
                <Text style={styles.modalButtonText}>Ir a iniciar sesión</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // --- Handlers de audio ---

  const handleRecordingComplete = ({ uri, durationMs }: RecordingResult) => {
    if (!uri) {
      Alert.alert("Error", "No se recibió el archivo de audio correctamente");
      return;
    }
    setAudioUri(uri);
    setAudioDurationMs(durationMs);
    Alert.alert("Éxito", "Audio grabado correctamente");
  };

  const clearAudio = () => {
    setAudioUri(null);
    setAudioDurationMs(null);
  };

  const clearFile = () => {
    setFileUri(null);
    setFileName(null);
  };

  const handleDeleteAudio = () => {
    confirmAction(
      "Eliminar audio",
      "Seguro que quieres eliminar el audio?",
      () => {
        clearAudio();
        Alert.alert(
          "Audio eliminado",
          "Puedes grabar un nuevo audio o subir un archivo",
        );
      },
    );
  };

  const handleDeleteFile = () => {
    confirmAction(
      "Eliminar archivo",
      "Seguro que quieres eliminar el archivo?",
      () => {
        clearFile();
        Alert.alert(
          "Archivo eliminado",
          "Puedes seleccionar otro archivo o grabar audio",
        );
      },
    );
  };

  const handleFileUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/*"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const file = result.assets[0];
        if (!isAudioFile(file.name)) {
          Alert.alert("fichero no compatible");
          return;
        }
        setFileUri(file.uri);
        setFileName(file.name);
        Alert.alert("Exito", `Audio "${file.name}" adjuntado correctamente`);
      }
    } catch {
      Alert.alert("Error", "No se pudo seleccionar el archivo");
    }
  };

  // --- Generacion y flujo de firma ---

  const resetForm = () => {
    setTitle("");
    clearAudio();
    clearFile();
  };

  const handleGenerate = async () => {
    const trimmedTitle = (title || "").trim();
    const missingTitle = !trimmedTitle;
    const missingAudio = !hasAnyAudio;

    if (missingTitle || missingAudio) {
      let message =
        "Debes introducir un nombre para el acta y subir o grabar un audio.";

      if (missingTitle && !missingAudio) {
        message = "Debes introducir un nombre para el acta.";
      } else if (!missingTitle && missingAudio) {
        message = "Debes subir o grabar un audio.";
      }

      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Datos incompletos", message);
      }
      return;
    }

    setGenerating(true);

    try {
      const formData = new FormData();
      if (hasRecordedAudio && audioUri) {
        if (Platform.OS === "web") {
          // En web, audioUri es un blob: URL — hay que obtener el Blob primero
          const response = await fetch(audioUri);
          const blob = await response.blob();
          // Normalizar el MIME type eliminando el sufijo de codec (ej: "audio/webm;codecs=opus" → "audio/webm")
          const mimeType = (blob.type || "audio/webm").split(";")[0];
          const ext = mimeType.includes("ogg") ? "ogg" : "webm";
          const normalizedBlob = new Blob([blob], { type: mimeType });
          formData.append("audio", normalizedBlob, `recording.${ext}`);
        } else {
          // En nativo, audioUri es un file:// de .m4a (RecordingPresets.HIGH_QUALITY)
          formData.append("audio", {
            uri: audioUri,
            name: "recording.m4a",
            type: "audio/mp4",
          } as any);
        }
      } else if (hasUploadedAudio && fileUri && fileName) {
        const ext = fileName.split(".").pop()?.toLowerCase() ?? "mp3";
        const mimeMap: Record<string, string> = {
          mp3: "audio/mpeg",
          wav: "audio/wav",
          ogg: "audio/ogg",
          flac: "audio/flac",
          m4a: "audio/mp4",
          mp4: "audio/mp4",
          webm: "audio/webm",
        };
        const mimeType = mimeMap[ext] ?? "audio/mpeg";
        if (Platform.OS === "web") {
          const response = await fetch(fileUri);
          const blob = await response.blob();
          formData.append("audio", blob, fileName);
        } else {
          formData.append("audio", {
            uri: fileUri,
            name: fileName,
            type: mimeType,
          } as any);
        }
      }
      if (!normalizedComunidadId) {
        Alert.alert("Error", "No se encontró el identificador de la comunidad.");
        return;
      }

      const response = await fetch(`${API_URL}/api/minutes/transcribe?association_id=${encodeURIComponent(normalizedComunidadId)}&title=${encodeURIComponent(title)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ detail: "Error desconocido" }));
        if (response.status === 415) {
          Alert.alert(
            "Formato no soportado",
            "El formato de audio no es compatible. Usa MP3, WAV, OGG, FLAC, M4A o WebM.",
          );
        } else if (response.status === 413) {
          Alert.alert(
            "Archivo demasiado grande",
            "El archivo supera el límite de 150 MB.",
          );
        } else {
          Alert.alert(
            "Error al procesar",
            error.detail ?? "No se pudo generar el acta.",
          );
        }
        return;
      }
      const minutes = await response.json();
      const newActa: Acta = {
        id: minutes.id,
        association_id: minutes.association_id || normalizedComunidadId,
        title: minutes.title || title,
        scheduled_at: minutes.scheduled_at,
        location: minutes.location || "Residencial Vecinus",
        type: minutes.meeting_type || "ORDINARY",
        status: minutes.status || "DRAFT",
        version: minutes.version || 1,
        summary: minutes.summary,
        agreements: minutes.agreements || [],
        transcription: minutes.transcription,
        topics: minutes.topics || [],
        tasks: minutes.tasks || [],
        attendees: minutes.attendees || [],
        created_at: minutes.created_at,
        updated_at: minutes.updated_at,
        locked_at: minutes.locked_at,
      };
      setCreateOpen(false);
      resetForm();
      setActas((prev) => [newActa, ...prev]);
      setSelectedActa(newActa);
    } catch (err) {
      console.error("[handleGenerate] Error:", err);
      Alert.alert(
        "Error de conexión",
        "No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleEditorConfirm = (editedSummary: string) => {
    const acta = editingActaRef.current ?? selectedActa;
    if (!acta) return;
    const updated = { ...acta, summary: editedSummary };
    setActas((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    editingActaRef.current = null;
    setEditorOpen(false);
    setSelectedActa(updated);
  };

  const handleEditorClose = () => {
    const acta = editingActaRef.current;
    editingActaRef.current = null;
    setEditorOpen(false);
    if (acta) setSelectedActa(acta);
  };

  const handleSign = (_signature: string) => {
    const acta = signingActaRef.current ?? selectedActa;
    if (!acta) return;
    signingActaRef.current = null;
    setActas((prev) => prev.filter((a) => a.id !== acta.id));
    setSignatureOpen(false);
    setSelectedActa(null);
    setSignSuccessOpen(true);
  };

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
          hitSlop={10}
        >
          <Menu color="#0F172A" size={28} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            {isPresidente ? "Gestión de Actas" : "Actas de la Junta"}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {isPresidente
              ? "Graba, transcribe y publica actas"
              : "Consulta los resumenes de las reuniones"}
          </Text>
        </View>
        <FileText color="#4F46E5" size={24} />
      </View>

      <ScrollView className="flex-1 bg-background">
        <View className="p-4 gap-4">
          {/* Dialogs de creacion — trigger invisible, se abre desde el FAB */}
          {isPresidente && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generar acta con IA</DialogTitle>
                </DialogHeader>

                <View className="flex flex-col gap-4 mt-4">
                  {/* Titulo */}
                  <View className="flex flex-col gap-2">
                    <Text className="text-sm font-medium text-foreground">
                      Titulo de la reunion
                    </Text>
                    <Input
                      value={title}
                      onChangeText={setTitle}
                      placeholder="Ej: Junta Ordinaria Febrero 2024"
                    />
                  </View>

                  {/* Audio */}
                  <View className="flex flex-col gap-2">
                    <Text className="text-sm font-medium text-foreground">
                      Audio de la sesion
                    </Text>

                    {hasAnyAudio ? (
                      <View className="flex flex-col gap-2">
                        <AudioPlayer
                          uri={hasRecordedAudio ? audioUri! : fileUri!}
                          durationHint={
                            hasRecordedAudio
                              ? (audioDurationMs ?? undefined)
                              : undefined
                          }
                        />
                        <Button
                          variant="destructive"
                          onPress={
                            hasRecordedAudio
                              ? handleDeleteAudio
                              : handleDeleteFile
                          }
                        >
                          <Text className="text-sm font-medium text-destructive-foreground">
                            Eliminar audio
                          </Text>
                        </Button>
                      </View>
                    ) : (
                      <>
                        <RecordingButton
                          onRecordingComplete={handleRecordingComplete}
                        />

                        <View className="flex-row items-center gap-2 my-1">
                          <View className="flex-1 h-px bg-border" />
                          <Text className="text-xs text-muted-foreground">
                            o
                          </Text>
                          <View className="flex-1 h-px bg-border" />
                        </View>

                        <Button variant="outline" onPress={handleFileUpload}>
                          <View className="flex-row items-center gap-2">
                            <Upload size={16} color={COLORS.foreground} />
                            <Text className="text-sm font-medium text-foreground">
                              Subir archivo de audio
                            </Text>
                          </View>
                        </Button>
                      </>
                    )}
                  </View>

                  {/* Archivo no-audio adjunto */}
                  {hasUploadedNonAudio && (
                    <View className="flex flex-col gap-2">
                      <Text className="text-sm font-medium text-foreground">
                        Archivo adjunto
                      </Text>
                      <View className="flex-row items-center justify-between bg-muted/50 rounded-lg p-3">
                        <View className="flex-1 flex-row items-center gap-2">
                          <CheckCircle2 size={16} color={COLORS.primary} />
                          <Text
                            className="text-sm text-foreground flex-1"
                            numberOfLines={1}
                          >
                            {fileName}
                          </Text>
                        </View>
                        <Button
                          variant="ghost"
                          size="sm"
                          onPress={() => {
                            clearFile();
                          }}
                        >
                          <Text className="text-sm text-destructive">
                            Eliminar
                          </Text>
                        </Button>
                      </View>
                    </View>
                  )}

                  {/* Boton generar */}
                  <Button
                    className="w-full mt-2"
                    style={{ backgroundColor: COLORS.primaryHex }}
                    disabled={generating}
                    onPress={() => {
                      handleGenerate();
                    }}
                  >
                    <View className="flex-row items-center gap-2">
                      {generating ? (
                        <>
                          <Clock
                            size={16}
                            color={COLORS.primaryForegroundHex}
                          />
                          <Text
                            style={{ color: COLORS.primaryForegroundHex }}
                            className="text-sm font-medium"
                          >
                            Procesando acta con IA...
                          </Text>
                        </>
                      ) : (
                        <>
                          <Sparkles
                            size={16}
                            color={COLORS.primaryForegroundHex}
                          />
                          <Text
                            style={{ color: COLORS.primaryForegroundHex }}
                            className="text-sm font-medium"
                          >
                            Generar acta
                          </Text>
                        </>
                      )}
                    </View>
                  </Button>
                </View>
              </DialogContent>
            </Dialog>
          )}

          {/* Detalle del acta seleccionada */}
          <ActaDetailView
            acta={selectedActa}
            isPresidente={isPresidente}
            visible={!!selectedActa}
            onClose={() => {
              setSelectedActa(null);
            }}
            onEdit={
              isPresidente
                ? () => {
                    editingActaRef.current = selectedActa;
                    setSelectedActa(null);
                    setEditorOpen(true);
                  }
                : undefined
            }
            onSign={
              isPresidente
                ? () => {
                    signingActaRef.current = selectedActa;
                    setSelectedActa(null);
                    setSignatureOpen(true);
                  }
                : undefined
            }
          />

          {/* Pantalla de exito tras firmar */}
          <Dialog
            open={signSuccessOpen}
            onOpenChange={(open) => !open && setSignSuccessOpen(false)}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Acta firmada</DialogTitle>
              </DialogHeader>
              <View className="flex flex-col items-center gap-4 py-4">
                <CheckCircle2 size={48} color={COLORS.primary} />
                <Text className="text-base text-center text-foreground">
                  Acta firmada correctamente
                </Text>
              </View>
              <Button
                className="w-full bg-primary"
                onPress={() => {
                  setSignSuccessOpen(false);
                }}
              >
                <Text className="text-sm font-medium text-primary-foreground">
                  Cerrar
                </Text>
              </Button>
            </DialogContent>
          </Dialog>

          {/* Editor modal - only mount when open to fully destroy its WebView before signature opens */}
          {editorOpen && (
            <ActaEditorModal
              visible={editorOpen}
              initialContent={
                editingActaRef.current?.summary ??
                selectedActa?.summary ??
                ""
              }
              onConfirm={handleEditorConfirm}
              onClose={handleEditorClose}
            />
          )}
          <ActaSignature
            visible={signatureOpen}
            onSign={handleSign}
            onClose={() => {
              const acta = signingActaRef.current;
              signingActaRef.current = null;
              setSignatureOpen(false);
              if (acta) setSelectedActa(acta);
            }}
          />

          {/* Lista de actas */}
          <View className="flex flex-col gap-3" style={{ paddingBottom: 120 }}>
            {actas.map((acta) => (
              <ActaListItem
                key={acta.id}
                acta={acta}
                onPress={() => {
                  setSelectedActa(acta);
                }}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Accion inferior fija — Crear acta */}
      {isPresidente && (
        <View style={[styles.footerContainer, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={styles.createActaButton}
            onPress={() => {
              setCreateOpen(true);
            }}
            activeOpacity={0.85}
          >
            <Sparkles color="#ffffff" size={18} style={styles.createActaIcon} />
            <Text style={styles.createActaText}>Crear acta</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    height: 65,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    backgroundColor: "#ffffff",
  },
  headerTitleContainer: { marginLeft: 16, flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  headerSubtitle: { fontSize: 12, color: "#64748B" },
  footerContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  createActaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#4F46E5",
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  createActaIcon: {
    marginRight: 6,
  },
  createActaText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 16,
  },
  modalButton: {
    backgroundColor: "#3B6FD4",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
});
