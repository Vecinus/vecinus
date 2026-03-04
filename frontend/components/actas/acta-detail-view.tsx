import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  StyleSheet,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import {
  X,
  Calendar,
  CheckCircle2,
  Sparkles,
  Download,
  Tag,
  Pencil,
  FilePenLine,
} from "lucide-react-native";
import { COLORS } from "@/lib/colors";
import { Acta } from "@/types/acta";
import { API_URL } from "@/constants/api";
import { Button } from "@/components/ui/button";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ActaDetailViewProps {
  acta: Acta | null;
  isPresidente: boolean;
  visible: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onSign?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type TabKey = "summary" | "agreements" | "topics" | "tasks" | "transcript";

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ActaDetailView({
  acta,
  isPresidente,
  visible,
  onClose,
  onEdit,
  onSign,
}: ActaDetailViewProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("summary");
  const [downloading, setDownloading] = useState(false);
  const [tabBarWidth, setTabBarWidth] = useState(0);
  const [tabContentWidth, setTabContentWidth] = useState(0);

  // Reiniciar tab y medidas del tab bar al abrir
  React.useEffect(() => {
    if (visible) {
      setActiveTab("summary");
      setTabBarWidth(0);
      setTabContentWidth(0);
    }
  }, [visible]);

  if (!acta) return null;

  // ── Tabs disponibles ────────────────────────────────────────────────────────

  const tabs: { key: TabKey; label: string }[] = [
    { key: "summary", label: "Resumen" },
    { key: "agreements", label: "Acuerdos" },
    ...(acta.topics && acta.topics.length > 0
      ? [{ key: "topics" as TabKey, label: "Temas" }]
      : []),
    ...(acta.tasks && acta.tasks.length > 0
      ? [{ key: "tasks" as TabKey, label: "Tareas" }]
      : []),
    ...(isPresidente
      ? [{ key: "transcript" as TabKey, label: "Transcripción" }]
      : []),
  ];

  // ── Descarga ────────────────────────────────────────────────────────────────

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const payload = {
        transcription: acta.transcript,
        summary: acta.executiveSummary,
        agreements: acta.agreements,
        topics: acta.topics ?? [],
        tasks: acta.tasks ?? [],
      };

      const response = await fetch(`${API_URL}/api/minutes/generate-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ detail: "Error desconocido" }));
        Alert.alert(
          "Error al generar el documento",
          error.detail ?? "No se pudo generar el archivo .docx.",
        );
        return;
      }

      if (Platform.OS === "web") {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "acta_reunion.docx";
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const arrayBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        const cacheUri = `${FileSystem.cacheDirectory}acta_reunion.docx`;
        await FileSystem.writeAsStringAsync(cacheUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const permissions =
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

        if (permissions.granted) {
          const destUri =
            await FileSystem.StorageAccessFramework.createFileAsync(
              permissions.directoryUri,
              "acta_reunion.docx",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            );
          await FileSystem.StorageAccessFramework.writeAsStringAsync(
            destUri,
            base64,
            { encoding: FileSystem.EncodingType.Base64 },
          );
          Alert.alert("Descargado", "El archivo se ha guardado correctamente.");
        } else {
          Alert.alert(
            "Permiso denegado",
            "No se pudo acceder a la carpeta para guardar el archivo.",
          );
        }
      }
    } catch (err) {
      console.error("[handleDownload] Error:", err);
      Alert.alert(
        "Error de conexión",
        "No se pudo conectar con el servidor para generar el documento.",
      );
    } finally {
      setDownloading(false);
    }
  };

  // ── Contenido de la tab activa ───────────────────────────────────────────────

  const renderTabContent = () => {
    switch (activeTab) {
      case "summary":
        return (
          <View style={styles.tabSection}>
            <View style={styles.tabSectionHeader}>
              <Sparkles size={16} color={COLORS.primary} />
              <Text style={styles.tabSectionTitle}>Resumen Ejecutivo</Text>
            </View>
            <Text style={styles.bodyText}>{acta.executiveSummary}</Text>
          </View>
        );

      case "agreements":
        return (
          <View style={styles.gap8}>
            {acta.agreements.map((agreement, index) => (
              <View key={index} style={styles.listItem}>
                <CheckCircle2 size={16} color={COLORS.primary} />
                <Text style={[styles.bodyText, styles.flex1]}>{agreement}</Text>
              </View>
            ))}
          </View>
        );

      case "topics":
        return (
          <View style={styles.gap8}>
            {acta.topics?.map((topic, index) => (
              <View key={index} style={styles.listItem}>
                <Tag size={14} color={COLORS.mutedForeground} />
                <Text style={[styles.bodyText, styles.flex1]}>{topic}</Text>
              </View>
            ))}
          </View>
        );

      case "tasks":
        return (
          <View style={styles.gap8}>
            {acta.tasks?.map((task, index) => (
              <View key={index} style={styles.taskCard}>
                <View style={styles.taskRow}>
                  <Text style={styles.taskLabel}>Responsable:</Text>
                  <Text style={styles.taskValue}>{task.responsible}</Text>
                </View>
                <View style={styles.taskRow}>
                  <Text style={styles.taskLabel}>Descripción:</Text>
                  <Text style={[styles.taskValue, styles.flex1]}>
                    {task.description}
                  </Text>
                </View>
                <View style={styles.taskRow}>
                  <Text style={styles.taskLabel}>Plazo:</Text>
                  <Text style={styles.taskValue}>{task.deadline}</Text>
                </View>
              </View>
            ))}
          </View>
        );

      case "transcript":
        return (
          <View style={styles.tabSection}>
            <Text style={styles.bodyText}>{acta.transcript}</Text>
          </View>
        );

      default:
        return null;
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const expandTabs = tabBarWidth > 0 && tabContentWidth <= tabBarWidth;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/*
        Contenedor raíz: solo para centrar el card, sin handlers de toque.
      */}
      <View style={styles.backdrop}>
        {/*
          Backdrop táctil: absolutamente posicionado detrás del card.
          No envuelve el card, por lo que los toques sobre el card
          nunca llegan aquí.
        */}
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />

        {/*
          Card: View independiente encima del backdrop.
          Sin handlers de toque → ningún gesto queda bloqueado.
          Layout: column con flex fijo → el ScrollView ocupa el espacio
          disponible entre header/tabs y footer sin maxHeight arbitrario.
        */}
        <View style={styles.card}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={2}>
                {acta.title}
              </Text>
              <View style={styles.meta}>
                <Calendar size={14} color={COLORS.mutedForeground} />
                <Text style={styles.metaText}>{formatDate(acta.date)}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>{acta.createdBy}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={COLORS.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* ── Selector de tabs ── */}
          {/*
            View wrapper lleva el fondo y borderRadius para evitar que el
            overflow:hidden del ScrollView recorte el último tab en Android.
          */}
          <View style={styles.tabBarWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabBar}
              contentContainerStyle={[
                styles.tabBarContent,
                expandTabs && styles.tabBarContentFill,
              ]}
              onLayout={(e) => {
                setTabBarWidth(e.nativeEvent.layout.width);
              }}
              onContentSizeChange={(w) => {
                setTabContentWidth(w);
              }}
              keyboardShouldPersistTaps="handled"
            >
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => {
                      setActiveTab(tab.key);
                    }}
                    style={[
                      styles.tabBtn,
                      isActive && styles.tabBtnActive,
                      expandTabs && styles.tabBtnFlex,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabBtnText,
                        isActive
                          ? styles.tabBtnTextActive
                          : styles.tabBtnTextInactive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* ── Contenido scrollable ── */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
            nestedScrollEnabled
          >
            {renderTabContent()}
          </ScrollView>

          {/* ── Footer de botones ── */}
          <View style={styles.footer}>
            {onEdit && isPresidente && (
              <Button variant="outline" className="w-full" onPress={onEdit}>
                <View style={styles.btnInner}>
                  <Pencil size={16} color={COLORS.foreground} />
                  <Text style={styles.btnText}>Editar acta</Text>
                </View>
              </Button>
            )}

            <Button
              variant="outline"
              className="w-full"
              disabled={downloading}
              onPress={handleDownload}
            >
              <View style={styles.btnInner}>
                <Download size={16} color={COLORS.foreground} />
                <Text style={styles.btnText}>
                  {downloading
                    ? "Generando documento..."
                    : "Descargar acta (.docx)"}
                </Text>
              </View>
            </Button>

            {onSign && isPresidente && (
              <Button variant="outline" className="w-full" onPress={onSign}>
                <View style={styles.btnInner}>
                  <FilePenLine size={16} color={COLORS.foreground} />
                  <Text style={styles.btnText}>Firmar acta</Text>
                </View>
              </Button>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Modal
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  card: {
    width: "91.666667%",
    maxWidth: 512,
    height: "85%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "hsl(214.3 31.8% 91.4%)",
    backgroundColor: "hsl(0 0% 100%)",
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    flexDirection: "column",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 8,
  },
  headerText: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "hsl(222.2 84% 4.9%)",
    lineHeight: 24,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  metaText: {
    fontSize: 12,
    color: "hsl(215.4 16.3% 46.9%)",
  },
  metaDot: {
    fontSize: 12,
    color: "hsl(215.4 16.3% 46.9%)",
  },
  closeBtn: {
    padding: 4,
  },

  // Tab bar
  tabBarWrapper: {
    flexGrow: 0,
    marginBottom: 12,
    backgroundColor: "hsl(210 40% 96.1%)",
    borderRadius: 8,
    overflow: "hidden",
  },
  tabBar: {
    flexGrow: 0,
  },
  tabBarContent: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
  },
  tabBarContentFill: {
    flex: 1,
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnFlex: {
    flex: 1,
  },
  tabBtnActive: {
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: "500",
  },
  tabBtnTextActive: {
    color: "hsl(222.2 84% 4.9%)",
  },
  tabBtnTextInactive: {
    color: "hsl(215.4 16.3% 46.9%)",
  },

  // Scroll
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
    flexGrow: 1,
  },

  // Tab sections
  tabSection: {
    backgroundColor: "hsl(210 40% 96.1%)",
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  tabSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  tabSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "hsl(222.2 84% 4.9%)",
  },
  bodyText: {
    fontSize: 14,
    color: "hsl(222.2 84% 4.9%)",
    lineHeight: 22,
  },
  gap8: {
    gap: 8,
  },
  flex1: {
    flex: 1,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "hsl(210 40% 96.1%)",
    borderRadius: 8,
    padding: 12,
  },
  taskCard: {
    backgroundColor: "hsl(210 40% 96.1%)",
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    flexWrap: "wrap",
  },
  taskLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "hsl(215.4 16.3% 46.9%)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  taskValue: {
    fontSize: 14,
    color: "hsl(222.2 84% 4.9%)",
  },

  // Footer
  footer: {
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "hsl(214.3 31.8% 91.4%)",
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  btnText: {
    fontSize: 14,
    fontWeight: "500",
    color: "hsl(222.2 84% 4.9%)",
  },
});
