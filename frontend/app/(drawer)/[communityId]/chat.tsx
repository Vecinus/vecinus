import {
  buildChatWebSocketUrl,
  createCommunityChannel,
  deleteChannelMessage,
  fetchChannelMessages,
  fetchUserChannels,
  getChatErrorMessage,
  sendChannelMessage,
  updateChannelMessage,
  type ChannelMessage,
  type CommunityChannel,
} from '@/api/chat';
import { AlertDescription, AlertTitle, Alert as InlineAlert } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { isAdminOrPresident } from '@/utils/role.util';
import { useLocalSearchParams } from 'expo-router';
import {
  ChevronDownIcon,
  CircleAlertIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  SendIcon,
  ShieldAlertIcon,
  SparklesIcon,
  Trash2Icon,
  UserIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  type TextInputContentSizeChangeEventData,
  View,
  TextInput,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

const CHAT_COMPOSER_MIN_HEIGHT = 24;
const CHAT_COMPOSER_MAX_HEIGHT = 132;

type ScreenState = 'loading' | 'ready' | 'empty' | 'error';

function ChatBubble({
  message,
  currentUserId,
  currentUserAvatarUrl,
  isDeleting,
  onDeleteMessage,
  onEditMessage,
}: {
  message: ChannelMessage;
  currentUserId: string | null;
  currentUserAvatarUrl?: string | null;
  isDeleting?: boolean;
  onDeleteMessage?: (message: ChannelMessage) => void;
  onEditMessage?: (message: ChannelMessage) => void;
}) {
  const isUser = currentUserId === message.sender_id;

  return (
    <View className={cn('mb-4 flex-row gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser ? (
        <Avatar alt="Vecino" className="mt-1 size-9 border border-border bg-primary/10">
          {message.sender?.avatar_url ? <AvatarImage source={{ uri: message.sender.avatar_url }} /> : null}
          <AvatarFallback className="bg-primary/10">
            <Icon as={UsersIcon} size={16} className="text-primary" />
          </AvatarFallback>
        </Avatar>
      ) : null}

      <View
        className={cn(
          'max-w-[85%] rounded-3xl border px-4 py-3',
          isUser ? 'border-primary bg-primary' : 'border-border bg-card'
        )}>
        {!isUser ? (
          <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
            {message.sender?.username || 'Vecino'}
          </Text>
        ) : null}

        {isUser && onEditMessage && onDeleteMessage ? (
          <View className="mb-2 flex-row justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-1 rounded-full bg-primary-foreground/10 active:bg-primary-foreground/15">
                  <Icon as={EllipsisVerticalIcon} size={6} className="text-primary-foreground/85" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                sideOffset={8}
                align="end"
                className="min-w-[11rem] rounded-2xl p-1.5">
                <DropdownMenuItem
                  onPress={() => {
                    onEditMessage(message);
                  }}
                  className="rounded-xl px-3 py-2.5">
                  <Icon as={PencilIcon} size={14} className="text-foreground" />
                  <Text className="text-sm text-foreground">Editar mensaje</Text>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  variant="destructive"
                  disabled={isDeleting}
                  onPress={() => {
                    onDeleteMessage(message);
                  }}
                  className="rounded-xl px-3 py-2.5">
                  <Icon as={Trash2Icon} size={14} className="text-destructive" />
                  <Text className="text-sm text-destructive">
                    {isDeleting ? 'Eliminando...' : 'Eliminar mensaje'}
                  </Text>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </View>
        ) : null}

        <Text
          className={cn(
            'text-sm leading-6',
            isUser ? 'text-primary-foreground' : 'text-card-foreground'
          )}>
          {message.content}
        </Text>

        <View className="mt-2 flex-row items-center justify-end gap-2">
          {message.is_edited ? (
            <Text
              className={cn(
                'text-[11px]',
                isUser ? 'text-primary-foreground/80' : 'text-muted-foreground'
              )}>
              editado
            </Text>
          ) : null}
          <Text
            className={cn(
              'text-[11px]',
              isUser ? 'text-primary-foreground/80' : 'text-muted-foreground'
            )}>
            {new Intl.DateTimeFormat('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(message.created_at))}
          </Text>
        </View>
      </View>

      {isUser ? (
        <Avatar alt="Usuario" className="mt-1 size-9 border border-border bg-secondary">
          {currentUserAvatarUrl ? <AvatarImage source={{ uri: currentUserAvatarUrl }} /> : null}
          <AvatarFallback className="bg-secondary">
            <Icon as={UserIcon} size={16} className="text-secondary-foreground" />
          </AvatarFallback>
        </Avatar>
      ) : null}
    </View>
  );
}

export default function CommunityChatScreen() {
  const { communityId } = useLocalSearchParams<{ communityId: string | string[] }>();
  const { user } = useAuth();
  const flatListRef = React.useRef<FlatList<ChannelMessage>>(null);
  const composerRef = React.useRef<TextInput>(null);

  const normalizedCommunityId = React.useMemo(() => {
    if (Array.isArray(communityId)) {
      return communityId[0] ?? '';
    }

    return communityId ?? '';
  }, [communityId]);

  const membership = React.useMemo(() => {
    return (
      user?.CommunitiesAndRole.find(
        (communityMembership) => communityMembership.community.id === normalizedCommunityId
      ) ?? null
    );
  }, [normalizedCommunityId, user]);

  const roleId =
    typeof membership?.role === 'number'
      ? membership.role
      : typeof membership?.role === 'string'
        ? Number.parseInt(membership.role, 10)
        : null;
  const [state, setState] = React.useState<ScreenState>('loading');
  const [feedbackMessage, setFeedbackMessage] = React.useState<string | null>(null);
  const [channel, setChannel] = React.useState<CommunityChannel | null>(null);
  const [messages, setMessages] = React.useState<ChannelMessage[]>([]);
  const [messageText, setMessageText] = React.useState('');
  const [composerHeight, setComposerHeight] = React.useState(CHAT_COMPOSER_MIN_HEIGHT);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = React.useState(false);
  const [hasNewMessages, setHasNewMessages] = React.useState(false);
  const [editingMessage, setEditingMessage] = React.useState<ChannelMessage | null>(null);
  const [messagePendingDelete, setMessagePendingDelete] = React.useState<ChannelMessage | null>(null);
  const [deletingMessageId, setDeletingMessageId] = React.useState<string | null>(null);
  const isAtBottomRef = React.useRef(true);

  const loadMessages = React.useCallback(async (channelId: string): Promise<void> => {
    const nextMessages = await fetchChannelMessages(channelId);
    setMessages(nextMessages);
    setHasNewMessages(false);
    setState('ready');
  }, []);

  const resolveChannel = React.useCallback(async (): Promise<void> => {
    if (!normalizedCommunityId || !membership) {
      setState('error');
      setFeedbackMessage('No encontramos una comunidad válida para este chat.');
      return;
    }

    setFeedbackMessage(null);

    try {
      const channels = await fetchUserChannels();
      const existingChannel = channels.find(
        (candidate) =>
          candidate.association_id === normalizedCommunityId && !candidate.is_direct_message
      );

      if (existingChannel) {
        setChannel(existingChannel);
        await loadMessages(existingChannel.id);
        return;
      }

      if (!isAdminOrPresident(roleId)) {
        setChannel(null);
        setMessages([]);
        setState('empty');
        return;
      }

      const createdChannel = await createCommunityChannel(normalizedCommunityId);
      setChannel(createdChannel);
      await loadMessages(createdChannel.id);
    } catch (error) {
      setState('error');
      setFeedbackMessage(getChatErrorMessage(error, 'No se pudo preparar el chat comunitario.'));
    }
  }, [roleId, loadMessages, membership, normalizedCommunityId]);

  React.useEffect(() => {
    void resolveChannel();
  }, [resolveChannel]);

  React.useEffect(() => {
    if (!feedbackMessage) {
      return;
    }

    const timeout = setTimeout(() => {
      setFeedbackMessage(null);
    }, 4000);

    return () => clearTimeout(timeout);
  }, [feedbackMessage]);

  React.useEffect(() => {
    if (!channel?.id) {
      return;
    }

    const socket = new WebSocket(buildChatWebSocketUrl(channel.id));

    socket.onmessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data as string) as
          | ChannelMessage
          | { event: 'message_edited'; message: ChannelMessage }
          | { event: 'message_deleted'; message_id: string };

        if ('event' in payload && payload.event === 'message_deleted') {
          setMessages((current) => current.filter((message) => message.id !== payload.message_id));
          setEditingMessage((current) => (current?.id === payload.message_id ? null : current));
          return;
        }

        if ('event' in payload && payload.event === 'message_edited') {
          setMessages((current) =>
            current.map((message) =>
              message.id === payload.message.id ? { ...message, ...payload.message } : message
            )
          );
          setEditingMessage((current) =>
            current?.id === payload.message.id ? { ...current, ...payload.message } : current
          );
          return;
        }

        setMessages((current) => {
          if (current.some((message) => message.id === payload.id)) {
            return current;
          }

          if (!isAtBottomRef.current) {
            setHasNewMessages(true);
          }

          return [...current, payload];
        });
      } catch {
        // Ignore malformed websocket payloads.
      }
    };

    return () => socket.close();
  }, [channel?.id]);

  const handleRefresh = React.useCallback(async (): Promise<void> => {
    if (!channel?.id) return;

    setIsRefreshing(true);
    try {
      await loadMessages(channel.id);
    } catch (error) {
      setFeedbackMessage(getChatErrorMessage(error, 'No se pudo actualizar el historial.'));
    } finally {
      setIsRefreshing(false);
    }
  }, [channel?.id, loadMessages]);

  const handleScroll = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceToBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);

    // Si estamos a menos de 50px del fondo, consideramos que estamos en el fondo
    const isAtBottom = distanceToBottom < 50;
    setShowScrollToBottom(!isAtBottom);
    isAtBottomRef.current = isAtBottom;

    if (isAtBottom) {
      setHasNewMessages(false);
    }
  }, []);

  const handleContentSizeChange = React.useCallback(
    (_width: number, _height: number) => {
      if (isAtBottomRef.current) {
        flatListRef.current?.scrollToEnd({ animated: true });
      }
    },
    []
  );

  const scrollToBottom = React.useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
    setShowScrollToBottom(false);
    setHasNewMessages(false);
    isAtBottomRef.current = true;
  }, []);

  const resetComposer = React.useCallback(() => {
    setMessageText('');
    setComposerHeight(CHAT_COMPOSER_MIN_HEIGHT);
    setEditingMessage(null);
  }, []);

  const handleStartEditing = React.useCallback((message: ChannelMessage) => {
    setEditingMessage(message);
    setMessageText(message.content);

    setTimeout(() => {
      composerRef.current?.focus();
    }, 0);
  }, []);

  const handleDelete = React.useCallback(
    async (message: ChannelMessage) => {
      if (!channel?.id || deletingMessageId) {
        return;
      }

      setDeletingMessageId(message.id);

      try {
        await deleteChannelMessage({
          channelId: channel.id,
          messageId: message.id,
        });

        setMessages((current) => current.filter((currentMessage) => currentMessage.id !== message.id));
        setEditingMessage((current) => (current?.id === message.id ? null : current));
        setMessagePendingDelete((current) => (current?.id === message.id ? null : current));
      } catch (error) {
        setFeedbackMessage(getChatErrorMessage(error, 'No se pudo eliminar el mensaje.'));
      } finally {
        setDeletingMessageId(null);
      }
    },
    [channel?.id, deletingMessageId]
  );

  const handleRequestDelete = React.useCallback(
    (message: ChannelMessage) => {
      setMessagePendingDelete(message);
    },
    []
  );

  const handleSend = React.useCallback(async () => {
    const trimmedMessage = messageText.trim();

    if (!trimmedMessage || !channel?.id || isSending) {
      return;
    }

    setIsSending(true);

    try {
      if (editingMessage) {
        const updatedMessage = await updateChannelMessage({
          channelId: channel.id,
          messageId: editingMessage.id,
          content: trimmedMessage,
        });

        setMessages((current) =>
          current.map((message) =>
            message.id === updatedMessage.id ? { ...message, ...updatedMessage } : message
          )
        );
      } else {
        const newMessage = await sendChannelMessage({
          channelId: channel.id,
          content: trimmedMessage,
        });

        setMessages((current) => {
          if (current.some((message) => message.id === newMessage.id)) {
            return current;
          }

          return [...current, newMessage];
        });
      }

      resetComposer();
      scrollToBottom();
    } catch (error) {
      setFeedbackMessage(
        getChatErrorMessage(
          error,
          editingMessage ? 'No se pudo actualizar el mensaje.' : 'No se pudo enviar el mensaje.'
        )
      );
    } finally {
      setIsSending(false);
    }
  }, [channel?.id, editingMessage, isSending, messageText, resetComposer, scrollToBottom]);

  if (!normalizedCommunityId || !membership) {
    return (
      <View className="flex-1 bg-background p-4">
        <InlineAlert icon={CircleAlertIcon} variant="destructive">
          <AlertTitle>Comunidad no disponible</AlertTitle>
          <AlertDescription>
            No encontramos una comunidad asociada a esta ruta o tu usuario ya no tiene acceso.
          </AlertDescription>
        </InlineAlert>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View className="flex-1 bg-background p-4">
        <Card className="min-h-0 flex-1 gap-0 overflow-hidden py-0">

          <View className="flex-1 bg-muted/30">
            {state === 'loading' ? (
              <View className="flex-1 items-center justify-center gap-4 px-6">
                <ActivityIndicator size="large" />
                <Text className="text-center text-base font-medium text-foreground">
                  Preparando el chat de la comunidad...
                </Text>
              </View>
            ) : null}

            {state === 'error' ? (
              <View className="flex-1 items-center justify-center px-4">
                <InlineAlert icon={CircleAlertIcon} variant="destructive" className="max-w-xl">
                  <AlertTitle>No pudimos abrir el chat</AlertTitle>
                  <AlertDescription>
                    {feedbackMessage || 'Ha ocurrido un error preparando el chat comunitario.'}
                  </AlertDescription>
                </InlineAlert>
              </View>
            ) : null}

            {state === 'empty' ? (
              <View className="flex-1 items-center justify-center px-4">
                <Card className="w-full max-w-xl">
                  <CardContent className="gap-4 px-6 py-8">
                    <View className="items-center gap-3">
                      <View className="rounded-full bg-muted p-4">
                        <Icon as={ShieldAlertIcon} size={24} className="text-primary" />
                      </View>
                      <Text className="text-center text-lg font-semibold text-foreground">
                        Chat aún no disponible
                      </Text>
                      <Text className="text-center text-sm leading-6 text-muted-foreground">
                        Aún no existe el chat general de esta comunidad. Un administrador debe
                        crear el canal la primera vez.
                      </Text>
                    </View>
                  </CardContent>
                </Card>
              </View>
            ) : null}

            {state === 'ready' ? (
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <ChatBubble
                    message={item}
                    currentUserId={user?.id ?? null}
                    currentUserAvatarUrl={user?.avatarUrl}
                    isDeleting={deletingMessageId === item.id}
                    onEditMessage={item.sender_id === user?.id ? handleStartEditing : undefined}
                    onDeleteMessage={item.sender_id === user?.id ? handleRequestDelete : undefined}
                  />
                )}
                contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} />
                }
                onScroll={handleScroll}
                onContentSizeChange={handleContentSizeChange}
                ListEmptyComponent={
                  <View className="items-center gap-3 px-6 py-16">
                    <View className="rounded-full bg-primary/10 p-4">
                      <Icon as={SparklesIcon} size={22} className="text-primary" />
                    </View>
                    <Text className="text-center text-lg font-semibold text-foreground">
                      Todavía no hay mensajes
                    </Text>
                    <Text className="text-center text-sm leading-6 text-muted-foreground">
                      Cuando el chat exista, aquí aparecerán los mensajes de la comunidad.
                    </Text>
                  </View>
                }
              />
            ) : null}

            {state === 'ready' && showScrollToBottom && messages.length > 0 ? (
              <View className="absolute bottom-4 right-4 z-10">
                {hasNewMessages ? (
                  <View className="mb-2 self-end rounded-full bg-primary px-3 py-1">
                    <Text className="text-xs font-medium text-primary-foreground">
                      Nuevos mensajes
                    </Text>
                  </View>
                ) : null}
                <Button
                  onPress={scrollToBottom}
                  size="lg"
                  className="size-15 rounded-full shadow-lg bg-cyan-500 hover:bg-cyan-600">
                  <Icon as={ChevronDownIcon} size={32} className="text-white" />
                </Button>
              </View>
            ) : null}
          </View>

          {state === 'ready' ? (
            <CardContent className="gap-3 border-t border-border px-4 py-4">
              {feedbackMessage ? (
                <InlineAlert icon={CircleAlertIcon} variant="destructive">
                  <AlertTitle>Atención</AlertTitle>
                  <AlertDescription>{feedbackMessage}</AlertDescription>
                </InlineAlert>
              ) : null}

              {editingMessage ? (
                <View className="flex-row items-center justify-between rounded-2xl border border-border bg-muted/60 px-3 py-2">
                  <View className="min-w-0 flex-1 pr-3">
                    <Text className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Editando mensaje
                    </Text>
                    <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                      {editingMessage.content}
                    </Text>
                  </View>

                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={resetComposer}
                    className="h-8 rounded-full px-2">
                    <Icon as={XIcon} size={14} className="text-muted-foreground" />
                    <Text className="text-xs text-muted-foreground">Cancelar</Text>
                  </Button>
                </View>
              ) : null}

              <View className="flex-row items-end gap-3 rounded-3xl border border-border bg-background px-3 py-2">
                <TextInput
                  ref={composerRef}
                  value={messageText}
                  onChangeText={setMessageText}
                  onContentSizeChange={(event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
                    const nextHeight = Math.max(
                      CHAT_COMPOSER_MIN_HEIGHT,
                      Math.min(
                        CHAT_COMPOSER_MAX_HEIGHT,
                        Math.ceil(event.nativeEvent.contentSize.height)
                      )
                    );
                    setComposerHeight(nextHeight);
                  }}
                  onKeyPress={(e) => {
                    const isShiftPressed =
                      'shiftKey' in e.nativeEvent &&
                      typeof e.nativeEvent.shiftKey === 'boolean' &&
                      e.nativeEvent.shiftKey;

                    if (
                      Platform.OS === 'web' &&
                      e.nativeEvent.key === 'Enter' &&
                      !isShiftPressed
                    ) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder={editingMessage ? 'Actualiza tu mensaje' : 'Escribe tu mensaje'}
                  multiline
                  numberOfLines={1}
                  scrollEnabled={composerHeight >= CHAT_COMPOSER_MAX_HEIGHT}
                  style={{
                    height: composerHeight,
                    maxHeight: CHAT_COMPOSER_MAX_HEIGHT,
                    ...(Platform.OS === 'web' ? { resize: 'none' as const } : {}),
                  }}
                  className="min-h-0 flex-1 border-0 bg-transparent px-0 py-1 shadow-none"
                />

                <Button
                  onPress={() => {
                    void handleSend();
                  }}
                  disabled={!messageText.trim() || isSending}
                  size="icon"
                  className="size-11 rounded-full">
                  {isSending ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Icon as={editingMessage ? PencilIcon : SendIcon} size={16} className="text-primary-foreground" />
                  )}
                </Button>
              </View>
            </CardContent>
          ) : null}
        </Card>
      </View>

      <Dialog
        open={messagePendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMessagePendingDelete(null);
          }
        }}>
        <DialogContent className="max-w-md rounded-3xl px-6 py-6">
          <DialogHeader className="gap-3">
            <DialogTitle>Eliminar mensaje</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          {messagePendingDelete ? (
            <View className="rounded-2xl border border-border bg-muted/50 px-4 py-3">
              <Text className="text-sm leading-6 text-muted-foreground" numberOfLines={3}>
                {messagePendingDelete.content}
              </Text>
            </View>
          ) : null}

          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onPress={() => {
                setMessagePendingDelete(null);
              }}
              className="rounded-2xl">
              <Text>Cancelar</Text>
            </Button>
            <Button
              variant="destructive"
              disabled={!messagePendingDelete || deletingMessageId === messagePendingDelete?.id}
              onPress={() => {
                if (!messagePendingDelete) {
                  return;
                }

                void handleDelete(messagePendingDelete);
              }}
              className="rounded-2xl">
              <Text>
                {deletingMessageId === messagePendingDelete?.id ? 'Eliminando...' : 'Eliminar'}
              </Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </KeyboardAvoidingView>
  );
}
