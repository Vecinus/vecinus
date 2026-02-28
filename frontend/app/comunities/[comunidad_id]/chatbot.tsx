import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Alert,
  useWindowDimensions 
} from 'react-native';
import { Bot, Send, Sparkles, FileText, UploadCloud, Menu } from 'lucide-react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

interface ChatAnswerSource {
  type: string;
  reference?: string | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: ChatAnswerSource;
  disclaimer?: string;
}

const isManager = true; 

export default function ChatBotScreen() {
  const { comunidad_id } = useLocalSearchParams<{ comunidad_id: string }>();
  
  const navigation = useNavigation();
  
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768; // 768px es el salto típico de móvil a tablet/PC

  // --- ESTADOS DEL CHAT ---
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: 'welcome', 
      role: 'assistant', 
      content: '👋 ¡Hola! Soy el asistente de tu comunidad. ¿En qué puedo ayudarte hoy?' 
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // --- ESTADOS DEL PANEL DE DOCUMENTOS ---
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // --- LÓGICA DEL CHAT ---
  const fetchBotResponse = async (question: string) => {
    try {
      const url = `${API_BASE_URL}/comunities/${comunidad_id}/chatbot?request=${encodeURIComponent(question)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Error en la respuesta');
      return await response.json(); 
    } catch (error) {
      return { answer: "Lo siento, hubo un error al conectar con el servidor.", source: { type: "Error" } };
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userText = input.trim();
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: userText }]);
    setInput('');
    setIsTyping(true);
    Keyboard.dismiss();

    const apiResponse = await fetchBotResponse(userText);

    setMessages(prev => [...prev, { 
      id: `a-${Date.now()}`, 
      role: 'assistant', 
      content: apiResponse.answer,
      source: apiResponse.source,
      disclaimer: apiResponse.disclaimer
    }]);
    setIsTyping(false);
  };

  const handleUploadDocument = async () => {
    if (!docTitle.trim() || !docContent.trim()) {
      Alert.alert("Atención", "Por favor, rellena el título y el contenido del documento.");
      return;
    }

    setIsUploading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/comunities/${comunidad_id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: docTitle.trim(),
          content: docContent.trim()
        })
      });

      if (!response.ok) throw new Error("Error al subir");
      
      const data = await response.json();
      Alert.alert("Éxito", `✅ ¡Subido con éxito! Generados ${data.chunks} fragmentos de conocimiento.`);
      
      setDocTitle('');
      setDocContent('');
      Keyboard.dismiss();
    } catch (error) {
      Alert.alert("Error", "❌ Hubo un error al intentar subir el documento.");
    } finally {
      setIsUploading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={{ width: '100%', flexDirection: 'row', marginBottom: 16, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
        <View style={{
          maxWidth: '85%', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16,
          backgroundColor: isUser ? '#8BA3E8' : '#F8FAFC',
          borderBottomRightRadius: isUser ? 4 : 16, borderBottomLeftRadius: !isUser ? 4 : 16,
        }}>
          <Text style={{ fontSize: 15, lineHeight: 22, color: isUser ? '#ffffff' : '#1E293B' }}>
            {item.content}
          </Text>
          {!isUser && item.source?.reference && (
            <View style={{ marginTop: 8, padding: 8, backgroundColor: 'rgba(241, 245, 249, 0.5)', borderRadius: 6 }}>
              <Text style={{ fontSize: 12, color: '#64748B', fontStyle: 'italic' }}>📄 Fuente: {item.source.reference}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: '#ffffff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* HEADER */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#ffffff' }}>
        
        {/* Botón que abre el menú lateral */}
        <TouchableOpacity 
          style={{ marginRight: 16, padding: 4 }}
          onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
        >
          <Menu color="#0F172A" size={28} />
        </TouchableOpacity>

        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Bot color="#4F46E5" size={24} />
        </View>
        <View>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0F172A' }}>Asistente Comunitario</Text>
          <Text style={{ fontSize: 13, color: '#64748B' }}>Comunidad: {comunidad_id}</Text>
        </View>
      </View>

      {/* CONTENEDOR PRINCIPAL: isDesktop dinámico */}
      <View style={{ flex: 1, flexDirection: isDesktop ? 'row' : 'column', backgroundColor: '#ffffff' }}>
        
        {/* ZONA IZQUIERDA: EL CHAT */}
        <View style={{ flex: 1, flexDirection: 'column' }}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            style={{ flex: 1, paddingHorizontal: 16, paddingTop: 24 }}
            contentContainerStyle={{ paddingBottom: 20 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />

          {isTyping && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 16, marginBottom: 16 }}>
              <Sparkles color="#64748B" size={16} />
              <Text style={{ fontSize: 13, color: '#64748B', marginLeft: 6 }}>Pensando...</Text>
            </View>
          )}

          {/* INPUT DEL CHAT */}
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
            <TextInput
              style={{
                flex: 1, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 24, 
                paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, fontSize: 15, color: '#1E293B', maxHeight: 100
              }}
              placeholder="Ej: ¿A qué hora abre la piscina?"
              placeholderTextColor="#94A3B8"
              value={input}
              onChangeText={setInput}
              multiline
            />
            <TouchableOpacity 
              style={{
                width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginLeft: 12,
                backgroundColor: input.trim() ? '#8BA3E8' : '#CBD5E1'
              }}
              onPress={handleSend}
              disabled={!input.trim() || isTyping}
            >
              {isTyping ? <ActivityIndicator color="#fff" size="small"/> : <Send color="#fff" size={20} style={{ marginLeft: -2 }} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* ZONA DERECHA: SUBIDA DE DOCUMENTOS (Solo Admin) */}
        {isManager && (
          <View 
            style={{ 
              width: isDesktop ? 340 : '100%', 
              borderLeftWidth: isDesktop ? 1 : 0,
              borderTopWidth: isDesktop ? 0 : 1,
              backgroundColor: '#F8FAFC', 
              borderColor: '#E2E8F0', 
              padding: 24 
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <FileText color="#4F46E5" size={20} />
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginLeft: 8 }}>Base de Conocimiento</Text>
            </View>
            
            <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 20, lineHeight: 18 }}>
              Añade normativas, horarios o información relevante para que el asistente pueda responder a los vecinos.
            </Text>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6, marginLeft: 4 }}>Título del documento</Text>
              <TextInput
                style={{
                  backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
                  paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: '#1E293B'
                }}
                placeholder="Ej: Normativa de la Piscina"
                placeholderTextColor="#94A3B8"
                value={docTitle}
                onChangeText={setDocTitle}
              />
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6, marginLeft: 4 }}>Contenido / Texto</Text>
              <TextInput
                style={{
                  backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
                  paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: '#1E293B', minHeight: 120
                }}
                placeholder="Escribe aquí las normas, reglas, horarios..."
                placeholderTextColor="#94A3B8"
                value={docContent}
                onChangeText={setDocContent}
                multiline
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity 
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12,
                backgroundColor: (!docTitle.trim() || !docContent.trim() || isUploading) ? '#CBD5E1' : '#4F46E5'
              }}
              onPress={handleUploadDocument}
              disabled={!docTitle.trim() || !docContent.trim() || isUploading}
            >
              {isUploading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <UploadCloud color="#ffffff" size={18} />
                  <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 14, marginLeft: 8 }}>Guardar Información</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

      </View>
    </KeyboardAvoidingView>
  );
}