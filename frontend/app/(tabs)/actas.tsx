import React, { useState, useEffect, useRef } from "react";
import { ScrollView, View, Text, Alert } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Sparkles, Upload, CheckCircle2, Clock } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { MOCK_ACTAS } from "@/data/mock-actas";
import { Acta } from "@/types/acta";

// ─── Pantalla principal ──────────────────────────────────────────────

export default function MeetingMinutesScreen() {
  // TODO: obtener del contexto de autenticacion
  const isPresidente = true;
  const userName = "Carlos Garcia";

  // --- Estado global ---
  const [actas, setActas] = useState<Acta[]>(MOCK_ACTAS);
  const [selectedActa, setSelectedActa] = useState<Acta | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pendingActa, setPendingActa] = useState<Acta | null>(null);

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

  // --- Handlers de audio ---

  const handleRecordingComplete = ({ uri, durationMs }: RecordingResult) => {
    if (!uri) {
      Alert.alert("Error", "No se recibio el archivo de audio correctamente");
      return;
    }
    setAudioUri(uri);
    setAudioDurationMs(durationMs);
    Alert.alert("Exito", "Audio grabado correctamente");
  };

  const clearAudio = () => {
    setAudioUri(null);
    setAudioDurationMs(null);
  };

  const clearFile = () => {
    setFileUri(null);
    setFileName(null);
  };

  const handleDeleteAudio = () =>
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

  const handleDeleteFile = () =>
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

  const handleFileUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/*", "application/pdf"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const file = result.assets[0];
        setFileUri(file.uri);
        setFileName(file.name);
        const tipo = isAudioFile(file.name) ? "audio" : "archivo";
        Alert.alert("Exito", `${tipo} "${file.name}" adjuntado correctamente`);
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

  const handleGenerate = () => {
    if (!title || !hasAnyAudio) return;
    setGenerating(true);

    // Simula llamada al backend (reemplazar por API real)
    setTimeout(() => {
      const newActa: Acta = {
        id: `a-${Date.now()}`,
        title,
        date: new Date().toISOString().split("T")[0],
        executiveSummary: `Resumen generado por IA de la reunion "${title}". Se trataron los puntos del orden del dia y se alcanzaron los acuerdos que se detallan a continuacion.`,
        agreements: [
          "Aprobacion del acta de la sesion anterior",
          "Revision de cuentas del trimestre",
          "Propuestas de mejora presentadas por los vecinos",
          "Asignacion de presupuesto para mantenimiento",
        ],
        transcript:
          "El presidente abre la sesion y procede a la lectura del orden del dia. Se someten a votacion los puntos propuestos y se alcanzan los acuerdos recogidos en la presente acta.",
        createdBy: userName,
        status: "draft",
      };

      setGenerating(false);
      setCreateOpen(false);
      resetForm();
      setPendingActa(newActa);
      setEditorOpen(true);
    }, 3000);
  };

  // Flag: the editor confirmed and we need to open signature once it's fully closed
  const pendingSignatureRef = useRef(false);

  // When editorOpen transitions to false AND we have a pending signature, open it after a delay
  useEffect(() => {
    if (!editorOpen && pendingSignatureRef.current) {
      pendingSignatureRef.current = false;
      // Wait for the editor Modal's slide animation to fully finish on Android
      const timer = setTimeout(() => setSignatureOpen(true), 200);
      return () => clearTimeout(timer);
    }
  }, [editorOpen]);

  const handleEditorConfirm = (editedTranscript: string) => {
    if (!pendingActa) return;
    setPendingActa({ ...pendingActa, transcript: editedTranscript });
    pendingSignatureRef.current = true;
    setEditorOpen(false);
  };

  const handleEditorClose = () => {
    setEditorOpen(false);
    setPendingActa(null);
  };

  const signActa = (acta: Acta, signature: string): Acta => ({
    ...acta,
    status: "published",
    signature,
    signedBy: userName,
    signedAt: new Date().toISOString(),
  });

  const handleSign = (signature: string) => {
    if (!pendingActa) return;
    const signed = signActa(pendingActa, signature);
    setActas((prev) => [signed, ...prev]);
    setPendingActa(null);
    setSignatureOpen(false);
    Alert.alert("Exito", "Acta firmada y publicada correctamente");
  };

  const handleSignFromDetail = (signature: string) => {
    if (!selectedActa) return;
    const signed = signActa(selectedActa, signature);
    setActas((prev) => prev.map((a) => (a.id === signed.id ? signed : a)));
    setSelectedActa(signed);
    setSignatureOpen(false);
    Alert.alert("Exito", "Acta firmada correctamente");
  };

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="p-4 gap-4">
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-lg font-semibold text-foreground">
              {isPresidente ? "Gestion de Actas" : "Actas de la Junta"}
            </Text>
            <Text className="text-sm text-muted-foreground mt-1">
              {isPresidente
                ? "Graba, transcribe y publica actas"
                : "Consulta los resumenes de las reuniones"}
            </Text>
          </View>

          {isPresidente && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary">
                  <View className="flex-row items-center gap-2">
                    <Sparkles size={16} color={COLORS.primaryForeground} />
                    <Text className="text-sm font-medium text-primary-foreground">
                      Nueva acta
                    </Text>
                  </View>
                </Button>
              </DialogTrigger>

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
                          onPress={() => clearFile()}
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
                    className="w-full bg-primary mt-2"
                    disabled={!title || !hasAnyAudio || generating}
                    onPress={handleGenerate}
                  >
                    <View className="flex-row items-center gap-2">
                      {generating ? (
                        <>
                          <Clock size={16} color={COLORS.primaryForeground} />
                          <Text className="text-sm font-medium text-primary-foreground">
                            Procesando acta con IA...
                          </Text>
                        </>
                      ) : (
                        <>
                          <Sparkles
                            size={16}
                            color={COLORS.primaryForeground}
                          />
                          <Text className="text-sm font-medium text-primary-foreground">
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
        </View>

        {/* Detalle del acta seleccionada */}
        <Dialog
          open={!!selectedActa}
          onOpenChange={(open) => !open && setSelectedActa(null)}
        >
          <DialogContent>
            {selectedActa && (
              <>
                <DialogHeader>
                  <DialogTitle>{selectedActa.title}</DialogTitle>
                </DialogHeader>
                <ActaDetailView
                  acta={selectedActa}
                  isPresidente={isPresidente}
                />
                {isPresidente && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onPress={() => setSignatureOpen(true)}
                  >
                    <Text className="text-sm font-medium text-foreground">
                      Firmar acta
                    </Text>
                  </Button>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Editor modal - only mount when open to fully destroy its WebView before signature opens */}
        {editorOpen && (
          <ActaEditorModal
            visible={editorOpen}
            initialContent={pendingActa?.transcript ?? ""}
            onConfirm={handleEditorConfirm}
            onClose={handleEditorClose}
          />
        )}
        <ActaSignature
          visible={signatureOpen}
          onSign={pendingActa ? handleSign : handleSignFromDetail}
          onClose={() => setSignatureOpen(false)}
        />

        {/* Lista de actas */}
        <View className="flex flex-col gap-3">
          {actas.map((acta) => (
            <ActaListItem
              key={acta.id}
              acta={acta}
              onPress={() => setSelectedActa(acta)}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
