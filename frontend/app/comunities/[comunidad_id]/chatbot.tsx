import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, useWindowDimensions, StyleSheet, StatusBar,
  Animated, Modal, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bot, Send, Sparkles, FileText, UploadCloud,
  Menu, MessageSquare, Library, X, CheckCircle, Trash2
} from 'lucide-react-native';
import { useNavigation, useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { DrawerActions } from '@react-navigation/native';

// Store & Services
import { useCommunityStore } from '@/store/useCommunityStore';
import { useAuthStore } from '@/store/useAuthStore';
import { API_URL, globalJwtToken } from '@/constants/api';
import { loadUserCommunities } from '@/services/communityService';

// --- TYPES ---
interface ChatAnswerSource {
  type: string;
  reference?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: ChatAnswerSource;
  disclaimer?: string;
}

type NativeFile = { uri: string; name: string; type: string };

export default function ChatBotScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { comunidad_id } = useLocalSearchParams();

  const normalizedComunidadId = useMemo(() =>
    Array.isArray(comunidad_id) ? comunidad_id[0] : comunidad_id
  , [comunidad_id]);

  const isDesktop = width >= 768;

  const {
    activeCommunityId,
    activeCommunityName,
    activeCommunityRole,
    userToken,
    setActiveCommunity,
    communities
  } = useCommunityStore();

  const { token: authToken } = useAuthStore();
  const authHeaderToken = authToken || userToken || globalJwtToken;

  const isManager = activeCommunityRole === 1;

  const [activeTab, setActiveTab] = useState<'chat' | 'docs'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

  const [documents, setDocuments] = useState<string[]>([]);
  const [isDocsLoading, setIsDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- ESTADO PARA EL AVISO (TOAST) ---
  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const flatListRef = useRef<FlatList>(null);

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setToast(null));
    }, 3000);
  };

  useEffect(() => {
    if (communities.length === 0 && authHeaderToken) {
      void loadUserCommunities(authHeaderToken);
    }
  }, [authHeaderToken, communities.length]);

  useEffect(() => {
    if (normalizedComunidadId && communities.length > 0) {
      const currentComm = communities.find(c => String(c.id) === String(normalizedComunidadId));
      if (currentComm && currentComm.id !== activeCommunityId) {
        setActiveCommunity(currentComm.id, currentComm.name, currentComm.address, currentComm.role);
      }
    }
  }, [normalizedComunidadId, communities, activeCommunityId, setActiveCommunity]);

  useEffect(() => {
    if (activeCommunityId && normalizedComunidadId && activeCommunityId !== normalizedComunidadId) {
      router.replace(`/comunities/${activeCommunityId}/chatbot`);
    }
  }, [activeCommunityId, normalizedComunidadId, router]);

  useEffect(() => {
    if (!activeCommunityId) return;

    if (!authHeaderToken) {
      setMessages([]);
      setInput('');
      setIsTyping(false);
      setDocuments([]);
      return;
    }

    setMessages([
      {
        id: `welcome-${activeCommunityId}-${authHeaderToken.slice(0, 8)}`,
        role: 'assistant',
        content: `Hola, soy el asistente de ${activeCommunityName || "tu comunidad"}. ¿En qué puedo ayudarte?`
      },
    ]);
    setInput('');
    setIsTyping(false);
    setDocuments([]);
    setDocsError(null);
  }, [activeCommunityId, activeCommunityName, authHeaderToken]);

  const fetchDocuments = useCallback(async () => {
    if (!normalizedComunidadId || !authHeaderToken) return;
    setIsDocsLoading(true);
    setDocsError(null);
    try {
      const response = await fetch(`${API_URL}/comunities/${normalizedComunidadId}/documents`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authHeaderToken}` },
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ detail: 'Error al listar' }));
        throw new Error(errData.detail || 'Error al listar documentos');
      }
      const data = await response.json();
      setDocuments(Array.isArray(data.documents) ? data.documents : []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al listar documentos';
      setDocsError(message);
    } finally {
      setIsDocsLoading(false);
    }
  }, [normalizedComunidadId, authHeaderToken]);

  useEffect(() => {
    if (!isManager) return;
    if (isDesktop || activeTab === 'docs') {
      void fetchDocuments();
    }
  }, [isDesktop, activeTab, isManager, fetchDocuments]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !normalizedComunidadId || isTyping) return;

    const userText = input.trim();
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: userText }]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch(`${API_URL}/comunities/${normalizedComunidadId}/chatbot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authHeaderToken}`
        },
        body: JSON.stringify({ question: userText, history: [] }),
      });

      if (!response.ok) throw new Error('Error en el servidor');
      const data = await response.json();

      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        source: data.source,
        disclaimer: data.disclaimer
      }]);
    } catch (error: unknown) {
      Alert.alert("Error", "No se pudo conectar con el asistente.");
    } finally {
      setIsTyping(false);
    }
  }, [input, normalizedComunidadId, authHeaderToken, isTyping]);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        setSelectedFile(result.assets[0]);
        setDocTitle(result.assets[0].name);
      }
    } catch (err) {
      Alert.alert("Error", "No se pudo abrir el selector de archivos");
    }
  };

  const handleUploadDocument = async () => {
    if (!selectedFile && (!docTitle.trim() || !docContent.trim())) {
      Alert.alert("Atención", "Escribe el contenido o selecciona un archivo PDF/TXT.");
      return;
    }

    if (!authHeaderToken) {
      Alert.alert("Error", "No hay sesión activa.");
      return;
    }

    setIsUploading(true);
    try {
      let body: FormData | string;
      const headers: Record<string, string> = { 'Authorization': `Bearer ${authHeaderToken}` };

      if (selectedFile) {
        const formData = new FormData();
        if (Platform.OS === 'web') {
          const webAsset = selectedFile as DocumentPicker.DocumentPickerAsset & { file?: File };
          const fileToUpload = webAsset.file;
          if (!fileToUpload) throw new Error("No se pudo obtener el archivo del selector.");
          formData.append('file', fileToUpload);
        } else {
          const filePayload: NativeFile = {
            uri: selectedFile.uri,
            name: selectedFile.name,
            type: selectedFile.mimeType || 'application/octet-stream',
          };
          formData.append('file', filePayload as unknown as Blob);
        }
        body = formData;
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({ title: docTitle, content: docContent });
      }

      const response = await fetch(`${API_URL}/comunities/${normalizedComunidadId}/documents`, {
        method: 'POST',
        headers: headers,
        body: body,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ detail: "Error desconocido" }));
        throw new Error(errData.detail || 'Error al subir');
      }

      const data = await response.json();

      showToast(data.message || `"${docTitle}" indexado correctamente.`);

      setSelectedFile(null);
      setDocTitle('');
      setDocContent('');
      void fetchDocuments();

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al subir';
      Alert.alert("Error", message);
    } finally {
      setIsUploading(false);
    }
  };

  const openDeleteModal = (title: string) => {
    setDocToDelete(title);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!docToDelete || !normalizedComunidadId || !authHeaderToken) return;
    setIsDeleting(true);
    try {
      const response = await fetch(
        `${API_URL}/comunities/${normalizedComunidadId}/documents?document_title=${encodeURIComponent(docToDelete)}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${authHeaderToken}` },
        }
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ detail: 'Error al borrar' }));
        throw new Error(errData.detail || 'Error al borrar documento');
      }
      setDocuments(prev => prev.filter(name => name !== docToDelete));
      showToast(`Documento '${docToDelete}' eliminado.`);
      setDeleteModalVisible(false);
      setDocToDelete(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al borrar documento';
      Alert.alert("Error", message);
    } finally {
      setIsDeleting(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.msgRow, { justifyContent: item.role === 'user' ? 'flex-end' : 'flex-start' }]}>
      <View style={[styles.msgBubble, {
        backgroundColor: item.role === 'user' ? '#4F46E5' : '#F1F5F9',
        maxWidth: isDesktop ? '70%' : '85%',
      }]}>
        <Text style={{ fontSize: 15, color: item.role === 'user' ? '#fff' : '#1E293B' }}>{item.content}</Text>
        {item.source && (
          <View style={styles.sourceTag}>
            <Text style={[styles.sourceText, { fontWeight: '700' }]}>Fuente: {item.source.type}</Text>
            {item.source.reference && <Text style={styles.sourceText}>• {item.source.reference}</Text>}
          </View>
        )}
        {item.disclaimer && (
          <Text style={[styles.sourceText, { marginTop: 4, color: '#EF4444' }]}>Aviso: {item.disclaimer}</Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" />

      {toast && (
        <Animated.View style={[styles.toastContainer, { opacity: fadeAnim }]}>
          <CheckCircle color="#fff" size={20} />
          <Text style={styles.toastText}>{toast.message}</Text>
        </Animated.View>
      )}

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())} hitSlop={10}>
          <Menu color="#0F172A" size={28} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Asistente VecinUs</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {activeCommunityName} • ID: {normalizedComunidadId}
          </Text>
        </View>
        <Bot color="#4F46E5" size={24} />
      </View>

      {!isDesktop && (
        <View style={styles.tabBar}>
          <TabItem
            label="Chat"
            icon={<MessageSquare color={activeTab === 'chat' ? '#4F46E5' : '#64748B'} size={20} />}
            active={activeTab === 'chat'}
            onPress={() => setActiveTab('chat')}
          />
          {isManager && (
            <TabItem
              label="Documentos"
              icon={<Library color={activeTab === 'docs' ? '#4F46E5' : '#64748B'} size={20} />}
              active={activeTab === 'docs'}
              onPress={() => setActiveTab('docs')}
            />
          )}
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={{ flex: 1, flexDirection: isDesktop ? 'row' : 'column' }}>
          {(isDesktop || activeTab === 'chat') && (
            <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={item => item.id}
                renderItem={renderMessage}
                contentContainerStyle={[styles.chatScroll, { paddingHorizontal: isDesktop ? '10%' : 16 }]}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                showsVerticalScrollIndicator={isDesktop}
              />
              {isTyping && (
                <View style={[styles.typing, { marginLeft: isDesktop ? '10%' : 20 }]}>
                  <Sparkles color="#64748B" size={14} />
                  <Text style={styles.typingText}>Generando respuesta...</Text>
                </View>
              )}
              <View style={[styles.inputContainer, { paddingHorizontal: isDesktop ? '10%' : 16 }]}>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Haz una pregunta..."
                    value={input}
                    onChangeText={setInput}
                    placeholderTextColor="#94A3B8"
                    multiline
                  />
                  <TouchableOpacity
                    onPress={() => { void handleSend(); }}
                    disabled={isTyping}
                    style={[styles.sendBtn, { backgroundColor: isTyping ? '#94A3B8' : '#4F46E5' }]}
                  >
                    <Send color="#fff" size={18} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {isManager && (isDesktop || activeTab === 'docs') && (
            <View style={[styles.docsPanel, { width: isDesktop ? 380 : '100%' }]}>
              <ScrollView contentContainerStyle={styles.docsScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.docsHeader}>
                  <FileText color="#4F46E5" size={22} />
                  <Text style={styles.docsTitle}>Conocimiento</Text>
                </View>

                <Text style={styles.label}>Cargar Archivo (PDF o TXT)</Text>
                <TouchableOpacity onPress={() => { void pickDocument(); }} style={styles.filePickerBtn}>
                  <Library color="#4F46E5" size={20} />
                  <Text style={styles.filePickerText} numberOfLines={1}>
                    {selectedFile ? selectedFile.name : "Seleccionar documento..."}
                  </Text>
                  {selectedFile && (
                    <TouchableOpacity onPress={() => setSelectedFile(null)}>
                      <X color="#EF4444" size={18} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>

                <Text style={styles.label}>Título del documento</Text>
                <TextInput
                  style={styles.docInput}
                  placeholder="Ej: Normas de Convivencia"
                  value={docTitle}
                  onChangeText={setDocTitle}
                />

                {!selectedFile && (
                  <>
                    <Text style={styles.label}>O pega el contenido manual</Text>
                    <TextInput
                      style={[styles.docInput, { flex: 1, textAlignVertical: 'top', minHeight: 120 }]}
                      placeholder="Escribe aquí la información..."
                      multiline
                      value={docContent}
                      onChangeText={setDocContent}
                    />
                  </>
                )}

                <TouchableOpacity
                  onPress={() => { void handleUploadDocument(); }}
                  disabled={isUploading}
                  style={[styles.uploadBtn, { backgroundColor: isUploading ? '#CBD5E1' : '#4F46E5' }]}
                >
                  {isUploading ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <UploadCloud color="#fff" size={20} style={{ marginRight: 8 }} />
                      <Text style={styles.uploadBtnText}>Indexar Información</Text>
                    </>
                  )}
                </TouchableOpacity>

                <View style={styles.docsDivider} />

                <Text style={styles.docsListTitle}>Documentos subidos</Text>
                {isDocsLoading && (
                  <View style={styles.docsLoadingRow}>
                    <ActivityIndicator color="#4F46E5" />
                    <Text style={styles.docsLoadingText}>Cargando documentos...</Text>
                  </View>
                )}
                {docsError && <Text style={styles.docsErrorText}>{docsError}</Text>}
                {!isDocsLoading && !docsError && documents.length === 0 && (
                  <Text style={styles.docsEmptyText}>No hay documentos todavía.</Text>
                )}
                {documents.map((name, idx) => (
                  <View key={`${name}-${idx}`} style={styles.docRow}>
                    <Text style={styles.docName} numberOfLines={1}>{name}</Text>
                    <TouchableOpacity onPress={() => openDeleteModal(name)} style={styles.docDeleteBtn}>
                      <Trash2 color="#EF4444" size={18} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal visible={deleteModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Eliminar documento</Text>
            <Text style={styles.modalSubtitle}>
              ¿Seguro que quieres borrar permanentemente este documento?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setDeleteModalVisible(false)}
                disabled={isDeleting}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, styles.dangerButton]}
                onPress={() => { void confirmDelete(); }}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Eliminar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

type TabItemProps = {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onPress: () => void;
};

const TabItem = ({ label, icon, active, onPress }: TabItemProps) => (
  <TouchableOpacity onPress={onPress} style={[styles.tabItem, active && styles.activeTab]}>
    {icon}
    <Text style={[styles.tabLabel, { color: active ? '#4F46E5' : '#64748B' }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  toastContainer: {
    position: 'absolute',
    top: 80,
    left: 20,
    right: 20,
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  toastText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 12,
    fontSize: 14,
    flex: 1,
  },
  header: {
    height: 65,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleContainer: { marginLeft: 16, flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  headerSubtitle: { fontSize: 12, color: '#64748B' },
  tabBar: {
    height: 50,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#4F46E5' },
  tabLabel: { fontSize: 14, fontWeight: '600', marginLeft: 8 },
  chatScroll: { paddingVertical: 20 },
  msgRow: { width: '100%', flexDirection: 'row', marginBottom: 16 },
  msgBubble: { padding: 14, borderRadius: 18 },
  sourceTag: { marginTop: 6, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.05)' },
  sourceText: { fontSize: 10, fontStyle: 'italic', opacity: 0.7 },
  typing: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  typingText: { fontSize: 12, color: '#64748B', marginLeft: 6 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
    maxHeight: 120,
    paddingTop: 8,
    paddingBottom: 8,
    marginRight: 10,
  },
  inputContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#fff',
    marginBottom: Platform.OS === 'android' ? 10 : 0,
  },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  docsPanel: { backgroundColor: '#F8FAFC', padding: 24, borderLeftWidth: 1, borderLeftColor: '#E2E8F0' },
  docsScroll: { paddingBottom: 20 },
  docsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  docsTitle: { fontSize: 18, fontWeight: '700', marginLeft: 10, color: '#0F172A' },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 8 },
  docInput: { backgroundColor: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  filePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#4F46E5',
    marginBottom: 16,
  },
  filePickerText: {
    marginLeft: 10,
    color: '#4F46E5',
    fontWeight: '600',
    flex: 1,
  },
  uploadBtn: { height: 50, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  docsDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 20 },
  docsListTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  docsLoadingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  docsLoadingText: { marginLeft: 8, color: '#64748B', fontSize: 12 },
  docsErrorText: { color: '#EF4444', fontSize: 12, marginBottom: 8 },
  docsEmptyText: { color: '#94A3B8', fontSize: 12, marginBottom: 8 },
  docRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  docName: { flex: 1, color: '#1E293B', fontSize: 13, fontWeight: '600' },
  docDeleteBtn: { padding: 6, backgroundColor: '#FEF2F2', borderRadius: 8, marginLeft: 8 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  modalSubtitle: { fontSize: 13, color: '#64748B', marginBottom: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: { color: '#64748B', fontWeight: '700' },
  submitButton: {
    flex: 1,
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    borderRadius: 12,
    marginLeft: 8,
    alignItems: 'center',
  },
  dangerButton: { backgroundColor: '#EF4444' },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700' },
});
