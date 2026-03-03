import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Keyboard, Alert, useWindowDimensions, StyleSheet, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bot, Send, Sparkles, FileText, UploadCloud, Menu, MessageSquare, Library } from 'lucide-react-native';
import { useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { useCommunityStore } from '@/store/useCommunityStore';
import { API_URL } from '@/constants/api'; //

// --- TYPES  ---
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

export default function ChatBotScreen() {
  const { activeCommunityId, activeCommunityName } = useCommunityStore();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  
  const isDesktop = width >= 768;
  const [activeTab, setActiveTab] = useState<'chat' | 'docs'>('chat');
  const isManager = true; 

  // --- ESTADOS ---
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'assistant', content: `👋 ¡Hola! Soy el asistente de ${activeCommunityName}. ¿En qué puedo ayudarte?` },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);

  // --- LÓGICA ---
const handleSend = useCallback(async () => {
  if (!input.trim()) return;

  const userText = input.trim();
  const newUserMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: userText };
  
  setMessages(prev => [...prev, newUserMsg]);
  setInput('');
  setIsTyping(true);
  
  try {
    const response = await fetch(`${API_URL}/comunities/${activeCommunityId}/chatbot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        comunidad_id: activeCommunityId, // OBLIGATORIO: según ChatBotRequest
        question: userText,
        history: [] // Opcional, pero lo puedes inicializar vacío
      }),
    });

    if (!response.ok) throw new Error('Error 422 o similar');

    const data = await response.json(); // Data es de tipo ChatBotResponse

    const botMsg: Message = { 
      id: `a-${Date.now()}`, 
      role: 'assistant', 
      content: data.answer,
      source: data.source,      // Mapeo directo del objeto source
      disclaimer: data.disclaimer // Guardamos el aviso legal
    };
    
    setMessages(prev => [...prev, botMsg]);
  } catch (error) {
    const msg = "No se pudo conectar con el asistente.";
    Platform.OS === 'web' ? alert(msg) : Alert.alert("Error", msg);
  } finally {
    setIsTyping(false);
  }
}, [input, activeCommunityId, activeCommunityName]);

  const handleUploadDocument = async () => {
  if (!docTitle.trim() || !docContent.trim()) {
    const msg = "Por favor, rellena todos los campos.";
    Platform.OS === 'web' ? alert(msg) : Alert.alert("Atención", msg);
    return;
  }
  
  setIsUploading(true);
  
  try {
    const response = await fetch(`${API_URL}/comunities/${activeCommunityId}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // Activamos el caso JSON del backend
      body: JSON.stringify({
        title: docTitle,
        content: docContent
      }),
    });

    if (!response.ok) throw new Error('Error al subir documento');

    const msg = `✅ ¡Subido!\n"${docTitle}" ya es parte del conocimiento.`;
    Platform.OS === 'web' ? alert(msg) : Alert.alert("Éxito", msg);
    setDocTitle('');
    setDocContent('');
  } catch (error) {
    const msg = "Hubo un problema al subir el documento.";
    Platform.OS === 'web' ? alert(msg) : Alert.alert("Error", msg);
  } finally {
    setIsUploading(false);
  }
};
  // --- COMPONENTES INTERNOS ---
  const renderMessage = ({ item }: { item: Message }) => (
  <View style={[styles.msgRow, { justifyContent: item.role === 'user' ? 'flex-end' : 'flex-start' }]}>
    <View style={[styles.msgBubble, { 
      backgroundColor: item.role === 'user' ? '#4F46E5' : '#F1F5F9',
      maxWidth: isDesktop ? '70%' : '85%',
    }]}>
      <Text style={{ fontSize: 15, color: item.role === 'user' ? '#fff' : '#1E293B' }}>{item.content}</Text>
      
      {/* Renderizado de la fuente única */}
      {item.source && (
        <View style={styles.sourceTag}>
          <Text style={[styles.sourceText, { fontWeight: '700' }]}>Fuente: {item.source.type}</Text>
          {item.source.reference && (
            <Text style={styles.sourceText}>• {item.source.reference}</Text>
          )}
        </View>
      )}

      {/* Renderizado del disclaimer */}
      {item.disclaimer && (
        <Text style={[styles.sourceText, { marginTop: 4, color: '#EF4444' }]}>
          ⚠️ {item.disclaimer}
        </Text>
      )}
    </View>
  </View>
);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())} hitSlop={10}>
          <Menu color="#0F172A" size={28} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Asistente VecinUs</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {activeCommunityName} • ID: {activeCommunityId}
          </Text>
        </View>
        <Bot color="#4F46E5" size={24} />
      </View>

      {/* TABS MÓVIL */}
      {!isDesktop && (
        <View style={styles.tabBar}>
          <TabItem 
            label="Chat" 
            icon={<MessageSquare color={activeTab === 'chat' ? '#4F46E5' : '#64748B'} size={20} />} 
            active={activeTab === 'chat'} 
            onPress={() => setActiveTab('chat')} 
          />
          <TabItem 
            label="Documentos" 
            icon={<Library color={activeTab === 'docs' ? '#4F46E5' : '#64748B'} size={20} />} 
            active={activeTab === 'docs'} 
            onPress={() => setActiveTab('docs')} 
          />
        </View>
      )}

        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20} 
        >
        <View style={{ flex: 1, flexDirection: isDesktop ? 'row' : 'column' }}>
          
          {/* SECCIÓN CHAT */}
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
                    placeholder="Haz una pregunta sobre la comunidad..."
                    value={input}
                    onChangeText={setInput}
                    placeholderTextColor="#94A3B8"
                    multiline
                    maxLength={500}
                  />
                  <TouchableOpacity 
                    onPress={handleSend}
                    style={[styles.sendBtn, { backgroundColor: '#4F46E5' }]}
                  >
                    <Send color="#fff" size={18} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* SECCIÓN DOCUMENTOS */}
          {isManager && (isDesktop || activeTab === 'docs') && (
            <View style={[styles.docsPanel, { width: isDesktop ? 380 : '100%' }]}>
              <View style={styles.docsHeader}>
                <FileText color="#4F46E5" size={22} />
                <Text style={styles.docsTitle}>Base de Conocimiento</Text>
              </View>

              <Text style={styles.label}>Título</Text>
              <TextInput
                style={styles.docInput}
                placeholder="Ej: Normas de la Piscina"
                value={docTitle}
                onChangeText={setDocTitle}
              />

              <Text style={styles.label}>Contenido</Text>
              <TextInput
                style={[styles.docInput, { flex: 1, textAlignVertical: 'top', minHeight: 120 }]}
                placeholder="Pega el reglamento o información relevante..."
                multiline
                value={docContent}
                onChangeText={setDocContent}
              />

              <TouchableOpacity 
                onPress={handleUploadDocument}
                disabled={isUploading}
                style={[styles.uploadBtn, { backgroundColor: isUploading ? '#CBD5E1' : '#4F46E5' }]}
              >
                {isUploading ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <UploadCloud color="#fff" size={20} style={{ marginRight: 8 }} />
                    <Text style={styles.uploadBtnText}>Subir Documento</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const TabItem = ({ label, icon, active, onPress }: any) => (
  <TouchableOpacity onPress={onPress} style={[styles.tabItem, active && styles.activeTab]}>
    {icon}
    <Text style={[styles.tabLabel, { color: active ? '#4F46E5' : '#64748B' }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
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
    alignItems: 'center', // Cambiado de 'flex-end' a 'center' para mejor alineación
    backgroundColor: '#fff', // Fondo blanco puro para resaltar del fondo gris
    borderRadius: 28, // Más redondeado
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    // Añadimos una pequeña sombra para dar profundidad
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
  docsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  docsTitle: { fontSize: 18, fontWeight: '700', marginLeft: 10, color: '#0F172A' },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 8 },
  docInput: { backgroundColor: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  uploadBtn: { height: 50, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 'auto' },
  uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});