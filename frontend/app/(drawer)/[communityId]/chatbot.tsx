import {
  useCommunityDocumentsQuery,
  useDeleteCommunityDocumentMutation,
  useSendCommunityQuestionMutation,
  useUploadCommunityDocumentMutation,
  getErrorMessage,
} from '@/api/chatbot';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import type { ChatMessage, UploadDocumentFile } from '@/types/chatbot.types';
import { ADMIN_ROLE_ID } from '@/utils/role.util';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams } from 'expo-router';
import {
  CircleAlertIcon,
  FileTextIcon,
  LibraryIcon,
  MessageSquareIcon,
  PaperclipIcon,
  SendIcon,
  SparklesIcon,
  Trash2Icon,
  UploadCloudIcon,
  UserIcon,
} from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  type TextInputContentSizeChangeEventData,
  View,
  useWindowDimensions,
} from 'react-native';

type ChatTabValue = 'chat' | 'documents';
const CHAT_COMPOSER_MIN_HEIGHT = 24;
const CHAT_COMPOSER_MAX_HEIGHT = 132;

function toRoleId(role: string | number | null | undefined): number | null {
  if (typeof role === 'number' && Number.isFinite(role)) {
    return role;
  }

  if (typeof role === 'string') {
    const parsedRole = Number.parseInt(role, 10);
    return Number.isNaN(parsedRole) ? null : parsedRole;
  }

  return null;
}

function isAdministratorRole(role: string | number | null | undefined): boolean {
  return toRoleId(role) === ADMIN_ROLE_ID;
}

function buildMessage(
  partial: Omit<ChatMessage, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
): ChatMessage {
  const timestamp = partial.createdAt ?? new Date().toISOString();

  return {
    ...partial,
    id: partial.id ?? `${partial.role}-${timestamp}`,
    createdAt: timestamp,
  };
}

function toChatTabValue(value: string): ChatTabValue {
  return value === 'documents' ? 'documents' : 'chat';
}

function normalizeDocumentAsset(
  asset: DocumentPicker.DocumentPickerAsset
): UploadDocumentFile | null {
  const mimeType = asset.mimeType ?? 'application/octet-stream';

  if (Platform.OS === 'web') {
    const webAsset = asset as DocumentPicker.DocumentPickerAsset & { file?: Blob | null };

    if (!webAsset.file) {
      return null;
    }

    return {
      kind: 'web',
      name: asset.name,
      mimeType,
      blob: webAsset.file,
    };
  }

  return {
    kind: 'native',
    uri: asset.uri,
    name: asset.name,
    mimeType,
  };
}

function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <View className={cn('mb-4 flex-row gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser ? (
        <Avatar alt="Asistente Vecinus" className="mt-1 size-9 border border-border bg-primary/10">
          <AvatarFallback className="bg-primary/10">
            <Icon as={SparklesIcon} size={16} className="text-primary" />
          </AvatarFallback>
        </Avatar>
      ) : null}

      <View
        className={cn(
          'max-w-[85%] rounded-3xl border px-4 py-3',
          isUser ? 'border-primary bg-primary' : 'border-border bg-card'
        )}>
        <Text
          className={cn(
            'text-sm leading-6',
            isUser ? 'text-primary-foreground' : 'text-card-foreground'
          )}>
          {message.content}
        </Text>

        {message.source ? (
          <View className="mt-3 flex-row flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/30 bg-primary/5">
              <Text className="text-xs text-primary">Fuente: {message.source.type}</Text>
            </Badge>
            {message.source.reference ? (
              <Text className="text-xs text-muted-foreground">{message.source.reference}</Text>
            ) : null}
          </View>
        ) : null}

        {message.disclaimer ? (
          <Text className="mt-3 text-xs leading-5 text-destructive">{message.disclaimer}</Text>
        ) : null}
      </View>

      {isUser ? (
        <Avatar alt="Usuario" className="mt-1 size-9 border border-border bg-secondary">
          <AvatarFallback className="bg-secondary">
            <Icon as={UserIcon} size={16} className="text-secondary-foreground" />
          </AvatarFallback>
        </Avatar>
      ) : null}
    </View>
  );
}

export default function CommunityChatbotScreen() {
  const { communityId } = useLocalSearchParams<{ communityId: string | string[] }>();
  const { width } = useWindowDimensions();
  const { user, activeCommunity, setActiveCommunity } = useAuth();
  const flatListRef = React.useRef<FlatList<ChatMessage>>(null);

  const normalizedCommunityId = React.useMemo(() => {
    if (Array.isArray(communityId)) {
      return communityId[0] ?? '';
    }

    return communityId ?? '';
  }, [communityId]);

  const isDesktop = width >= 1024;
  const [activeTab, setActiveTab] = React.useState<ChatTabValue>('chat');
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [question, setQuestion] = React.useState('');
  const [documentTitle, setDocumentTitle] = React.useState('');
  const [documentContent, setDocumentContent] = React.useState('');
  const [selectedFile, setSelectedFile] = React.useState<UploadDocumentFile | null>(null);
  const [feedbackMessage, setFeedbackMessage] = React.useState<string | null>(null);
  const [pendingDeleteTitle, setPendingDeleteTitle] = React.useState<string | null>(null);
  const [composerHeight, setComposerHeight] = React.useState(CHAT_COMPOSER_MIN_HEIGHT);

  const membership = React.useMemo(() => {
    return (
      user?.CommunitiesAndRole.find(
        (communityMembership) => communityMembership.community.id === normalizedCommunityId
      ) ?? null
    );
  }, [normalizedCommunityId, user]);

  const communityName = membership?.community.name ?? activeCommunity?.name ?? 'tu comunidad';
  const canManageDocuments = isAdministratorRole(membership?.role);

  React.useEffect(() => {
    if (!membership) {
      return;
    }

    if (activeCommunity?.id === membership.community.id) {
      return;
    }

    void setActiveCommunity({
      id: membership.community.id,
      name: membership.community.name,
      role: membership.role,
    });
  }, [activeCommunity?.id, membership, setActiveCommunity]);

  React.useEffect(() => {
    if (!normalizedCommunityId) {
      setMessages([]);
      return;
    }

    setMessages([
      buildMessage({
        role: 'assistant',
        content: `Hola, soy el asistente de ${communityName}. Puedes preguntarme por normas, incidencias, actas o documentación de la comunidad.`,
      }),
    ]);
  }, [communityName, normalizedCommunityId]);

  React.useEffect(() => {
    if (!feedbackMessage) {
      return;
    }

    const timeout = setTimeout(() => {
      setFeedbackMessage(null);
    }, 4000);

    return () => {
      clearTimeout(timeout);
    };
  }, [feedbackMessage]);

  const shouldLoadDocuments =
    Boolean(normalizedCommunityId) &&
    canManageDocuments &&
    (isDesktop || activeTab === 'documents');

  const documentsQuery = useCommunityDocumentsQuery({
    communityId: normalizedCommunityId,
    enabled: shouldLoadDocuments,
  });
  const sendQuestionMutation = useSendCommunityQuestionMutation();
  const uploadDocumentMutation = useUploadCommunityDocumentMutation();
  const deleteDocumentMutation = useDeleteCommunityDocumentMutation();

  const handleSend = React.useCallback(async () => {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion || !normalizedCommunityId || sendQuestionMutation.isPending) {
      return;
    }

    const userMessage = buildMessage({
      role: 'user',
      content: trimmedQuestion,
    });

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setQuestion('');
    setComposerHeight(CHAT_COMPOSER_MIN_HEIGHT);

    try {
      const response = await sendQuestionMutation.mutateAsync({
        communityId: normalizedCommunityId,
        question: trimmedQuestion,
      });

      setMessages((currentMessages) => [
        ...currentMessages,
        buildMessage({
          role: 'assistant',
          content: response.answer,
          source: response.source,
          disclaimer: response.disclaimer,
        }),
      ]);
    } catch (error) {
      setFeedbackMessage(
        getErrorMessage(error, 'No se pudo conectar con el asistente de la comunidad.')
      );
    }
  }, [normalizedCommunityId, question, sendQuestionMutation]);

  const handleComposerSizeChange = React.useCallback(
    (event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
      const nextHeight = Math.max(
        CHAT_COMPOSER_MIN_HEIGHT,
        Math.min(CHAT_COMPOSER_MAX_HEIGHT, Math.ceil(event.nativeEvent.contentSize.height))
      );

      setComposerHeight(nextHeight);
    },
    []
  );

  const handlePickDocument = React.useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];

      if (!asset) {
        setFeedbackMessage('No se pudo recuperar el archivo seleccionado.');
        return;
      }

      const normalizedAsset = normalizeDocumentAsset(asset);

      if (!normalizedAsset) {
        setFeedbackMessage(
          'No se pudo leer el archivo seleccionado. Instala la dependencia y vuelve a intentarlo.'
        );
        return;
      }

      setSelectedFile(normalizedAsset);
      setDocumentTitle(asset.name);
    } catch (error) {
      setFeedbackMessage(getErrorMessage(error, 'No se pudo abrir el selector de archivos.'));
    }
  }, []);

  const handleUploadDocument = React.useCallback(async () => {
    if (!normalizedCommunityId || uploadDocumentMutation.isPending) {
      return;
    }

    if (!selectedFile && (!documentTitle.trim() || !documentContent.trim())) {
      setFeedbackMessage('Escribe un título y contenido, o selecciona un archivo PDF/TXT.');
      return;
    }

    try {
      const response = await uploadDocumentMutation.mutateAsync(
        selectedFile
          ? {
              communityId: normalizedCommunityId,
              file: selectedFile,
            }
          : {
              communityId: normalizedCommunityId,
              title: documentTitle.trim(),
              content: documentContent.trim(),
            }
      );

      setFeedbackMessage(response.message);
      setSelectedFile(null);
      setDocumentTitle('');
      setDocumentContent('');
    } catch (error) {
      setFeedbackMessage(getErrorMessage(error, 'No se pudo indexar el documento.'));
    }
  }, [documentContent, documentTitle, normalizedCommunityId, selectedFile, uploadDocumentMutation]);

  const handleDeleteDocument = React.useCallback(async () => {
    if (!pendingDeleteTitle || !normalizedCommunityId || deleteDocumentMutation.isPending) {
      return;
    }

    try {
      const response = await deleteDocumentMutation.mutateAsync({
        communityId: normalizedCommunityId,
        documentTitle: pendingDeleteTitle,
      });

      setFeedbackMessage(response.message);
      setPendingDeleteTitle(null);
    } catch (error) {
      setFeedbackMessage(getErrorMessage(error, 'No se pudo eliminar el documento.'));
    }
  }, [deleteDocumentMutation, normalizedCommunityId, pendingDeleteTitle]);

  const documents = documentsQuery.data ?? [];

  if (!normalizedCommunityId || !membership) {
    return (
      <View className="flex-1 bg-background p-4">
        <Alert icon={CircleAlertIcon} variant="destructive">
          <AlertTitle>Comunidad no disponible</AlertTitle>
          <AlertDescription>
            No encontramos una comunidad asociada a esta ruta o tu usuario ya no tiene acceso.
          </AlertDescription>
        </Alert>
      </View>
    );
  }

  const renderChatArea = (
    <Card className="min-h-0 flex-1 gap-0 overflow-hidden py-0">
      <View className="flex-1 bg-muted/30">
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatMessageBubble message={item} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          className="flex-1"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            sendQuestionMutation.isPending ? (
              <View className="flex-row items-center gap-3 px-2 py-2">
                <Avatar
                  alt="Asistente escribiendo"
                  className="size-9 border border-border bg-primary/10">
                  <AvatarFallback className="bg-primary/10">
                    <Icon as={SparklesIcon} size={16} className="text-primary" />
                  </AvatarFallback>
                </Avatar>
                <View className="rounded-full border border-border bg-card px-4 py-3">
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator size="small" />
                    <Text className="text-sm text-muted-foreground">Generando respuesta...</Text>
                  </View>
                </View>
              </View>
            ) : null
          }
        />
      </View>

      <CardContent className="gap-3 border-t border-border px-4 py-4">
        {feedbackMessage ? (
          <Alert icon={CircleAlertIcon} variant="destructive">
            <AlertTitle>Atención</AlertTitle>
            <AlertDescription>{feedbackMessage}</AlertDescription>
          </Alert>
        ) : null}

        <View className="flex-row items-end gap-3 rounded-3xl border border-border bg-background px-3 py-2">
          <Textarea
            value={question}
            onChangeText={setQuestion}
            onContentSizeChange={handleComposerSizeChange}
            placeholder="Haz una pregunta sobre la comunidad..."
            numberOfLines={1}
            scrollEnabled={composerHeight >= CHAT_COMPOSER_MAX_HEIGHT}
            style={{ height: composerHeight, maxHeight: CHAT_COMPOSER_MAX_HEIGHT }}
            className="min-h-0 flex-1 border-0 bg-transparent px-0 py-1 shadow-none"
          />

          <Button
            onPress={() => {
              void handleSend();
            }}
            disabled={!question.trim() || sendQuestionMutation.isPending}
            size="icon"
            className="size-11 rounded-full">
            {sendQuestionMutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Icon as={SendIcon} size={16} className="text-primary-foreground" />
            )}
          </Button>
        </View>
      </CardContent>
    </Card>
  );

  const renderDocumentsArea = canManageDocuments ? (
    <Card
      className={cn(
        'min-h-0 flex-1 gap-0 overflow-hidden py-0',
        isDesktop ? 'h-full max-h-[calc(100vh-12rem)] w-[360px]' : ''
      )}>
      <ScrollView
        className="min-h-0 flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator>
        <View className="gap-3">
          <Button
            variant="outline"
            onPress={() => {
              void handlePickDocument();
            }}
            className="h-12 justify-start rounded-2xl px-4">
            <Icon as={PaperclipIcon} size={16} className="text-foreground" />
            <Text className="flex-1 text-left" numberOfLines={1}>
              {selectedFile ? selectedFile.name : 'Seleccionar PDF o TXT'}
            </Text>
          </Button>

          {selectedFile ? (
            <Pressable
              onPress={() => {
                setSelectedFile(null);
              }}
              className="rounded-xl border border-dashed border-border bg-muted/50 px-4 py-3">
              <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                Archivo listo: {selectedFile.name}
              </Text>
              <Text className="mt-1 text-xs text-muted-foreground">
                Pulsa aquí si quieres descartarlo y cargar el contenido manualmente.
              </Text>
            </Pressable>
          ) : null}

          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Título del documento</Text>
            <Input
              value={documentTitle}
              onChangeText={setDocumentTitle}
              placeholder="Ej: Normas de convivencia"
            />
          </View>

          {!selectedFile ? (
            <View className="gap-2">
              <Text className="text-sm font-medium text-foreground">Contenido manual</Text>
              <Textarea
                value={documentContent}
                onChangeText={setDocumentContent}
                placeholder="Pega aquí el contenido del documento..."
                numberOfLines={8}
                className="min-h-36 bg-background"
              />
            </View>
          ) : null}

          <Button
            onPress={() => {
              void handleUploadDocument();
            }}
            disabled={uploadDocumentMutation.isPending}
            className="h-12 rounded-2xl">
            {uploadDocumentMutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Icon as={UploadCloudIcon} size={16} className="text-primary-foreground" />
                <Text>Indexar información</Text>
              </>
            )}
          </Button>
        </View>

        <View className="mt-6 gap-3">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-base font-semibold text-foreground">Documentos indexados</Text>
            <Badge variant="secondary">
              <Text>{documents.length}</Text>
            </Badge>
          </View>

          {documentsQuery.isLoading ? (
            <View className="rounded-2xl border border-border bg-muted/40 px-4 py-6">
              <View className="flex-row items-center gap-3">
                <ActivityIndicator size="small" />
                <Text className="text-sm text-muted-foreground">Cargando documentos...</Text>
              </View>
            </View>
          ) : null}

          {documentsQuery.error ? (
            <Alert icon={CircleAlertIcon} variant="destructive">
              <AlertTitle>Error al listar documentos</AlertTitle>
              <AlertDescription>
                {getErrorMessage(documentsQuery.error, 'No se pudo cargar el índice documental.')}
              </AlertDescription>
            </Alert>
          ) : null}

          {!documentsQuery.isLoading && !documentsQuery.error && documents.length === 0 ? (
            <View className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-6">
              <Text className="text-sm text-muted-foreground">
                Todavía no hay documentos indexados para esta comunidad.
              </Text>
            </View>
          ) : null}

          {documents.map((documentName) => (
            <View
              key={documentName}
              className="flex-row items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3">
              <View className="rounded-xl bg-primary/10 p-2">
                <Icon as={FileTextIcon} size={16} className="text-primary" />
              </View>
              <Text className="flex-1 text-sm font-medium text-foreground">{documentName}</Text>
              <Button
                variant="ghost"
                size="icon"
                onPress={() => {
                  setPendingDeleteTitle(documentName);
                }}
                className="rounded-full">
                <Icon as={Trash2Icon} size={16} className="text-destructive" />
              </Button>
            </View>
          ))}
        </View>
      </ScrollView>
    </Card>
  ) : null;

  return (
    <>
      <KeyboardAvoidingView
        className="flex-1 bg-background"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-1 bg-background p-4">
          <View className="mb-4 min-h-0 flex-1 gap-4">
            {!isDesktop && canManageDocuments ? (
              <View className="min-h-0 flex-1 gap-4">
                <View className="rounded-2xl bg-muted p-1">
                  <View className="flex-row">
                    <Button
                      variant={activeTab === 'chat' ? 'secondary' : 'ghost'}
                      onPress={() => {
                        setActiveTab(toChatTabValue('chat'));
                      }}
                      className="flex-1 rounded-xl">
                      <Icon as={MessageSquareIcon} size={14} />
                      <Text>Chat</Text>
                    </Button>
                    <Button
                      variant={activeTab === 'documents' ? 'secondary' : 'ghost'}
                      onPress={() => {
                        setActiveTab(toChatTabValue('documents'));
                      }}
                      className="flex-1 rounded-xl">
                      <Icon as={LibraryIcon} size={14} />
                      <Text>Documentos</Text>
                    </Button>
                  </View>
                </View>

                <View className="min-h-0 flex-1">
                  {activeTab === 'chat' ? renderChatArea : renderDocumentsArea}
                </View>
              </View>
            ) : (
              <View
                className={cn(
                  'min-h-0 flex-1 gap-4',
                  isDesktop ? 'flex-row items-stretch' : 'flex-col'
                )}>
                {renderChatArea}
                {renderDocumentsArea}
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      <Dialog
        open={Boolean(pendingDeleteTitle)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteTitle(null);
          }
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar documento</DialogTitle>
            <DialogDescription>
              {pendingDeleteTitle
                ? `Se eliminará "${pendingDeleteTitle}" del índice del chatbot para esta comunidad.`
                : 'Se eliminará el documento del índice del chatbot.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleteDocumentMutation.isPending}
              onPress={() => {
                setPendingDeleteTitle(null);
              }}>
              <Text>Cancelar</Text>
            </Button>
            <Button
              variant="destructive"
              disabled={deleteDocumentMutation.isPending}
              onPress={() => {
                void handleDeleteDocument();
              }}
              className="bg-destructive">
              {deleteDocumentMutation.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text>Eliminar</Text>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
