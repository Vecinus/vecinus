import {
  buildChatWebSocketUrl,
  createCommunityChannel,
  fetchChannelMessages,
  fetchUserChannels,
  getChatErrorMessage,
  sendChannelMessage,
  type ChannelMessage,
  type CommunityChannel,
} from '@/api/chat';
import { apiClient } from '@/api/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { ADMIN_ROLE_ID } from '@/utils/role.util';
import { isAxiosError } from 'axios';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  CircleAlertIcon,
  MessageSquareIcon,
  SendIcon,
  ShieldAlertIcon,
  SparklesIcon,
  UserIcon,
  UsersIcon,
} from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  View,
} from 'react-native';

const CHAT_COMPOSER_MIN_HEIGHT = 24;
const CHAT_COMPOSER_MAX_HEIGHT = 132;

type ScreenState = 'loading' | 'ready' | 'empty' | 'error';

function ChatBubble({
  message,
  currentUserId,
  currentUserAvatarUrl,
}: {
  message: ChannelMessage;
  currentUserId: string | null;
  currentUserAvatarUrl?: string | null;
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
  const isAdmin = roleId === ADMIN_ROLE_ID;

  const [state, setState] = React.useState<ScreenState>('loading');
  const [feedbackMessage, setFeedbackMessage] = React.useState<string | null>(null);
  const [channel, setChannel] = React.useState<CommunityChannel | null>(null);
  const [messages, setMessages] = React.useState<ChannelMessage[]>([]);
  const [messageText, setMessageText] = React.useState('');
  const [composerHeight, setComposerHeight] = React.useState(CHAT_COMPOSER_MIN_HEIGHT);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);

  const loadMessages = React.useCallback(async (channelId: string) => {
    const nextMessages = await fetchChannelMessages(channelId);
    setMessages(nextMessages);
    setState('ready');
  }, []);

  const resolveChannel = React.useCallback(async () => {
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

      if (!isAdmin) {
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
  }, [isAdmin, loadMessages, membership, normalizedCommunityId]);

  const verifyCommunityAccess = React.useCallback(async (): Promise<boolean> => {
    if (!normalizedCommunityId) return true;
    try {
      await apiClient.get(`/communities/${normalizedCommunityId}/verify-access`);
      return true;
    } catch (error) {
      if (!isAxiosError(error) || error?.response?.status !== 402) {
        console.error('verify-access (chat) failed:', error);
      }
      return false;
    }
  }, [normalizedCommunityId]);

  useFocusEffect(
    React.useCallback(() => {
      void (async () => {
        const hasAccess = await verifyCommunityAccess();
        if (hasAccess) {
          await resolveChannel();
        }
      })();
    }, [verifyCommunityAccess, resolveChannel])
  );

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

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as
          | ChannelMessage
          | { event: 'message_edited'; message: ChannelMessage }
          | { event: 'message_deleted'; message_id: string };

        if ('event' in payload && payload.event === 'message_deleted') {
          setMessages((current) =>
            current.filter((message) => message.id !== payload.message_id)
          );
          return;
        }

        if ('event' in payload && payload.event === 'message_edited') {
          setMessages((current) =>
            current.map((message) =>
              message.id === payload.message.id ? { ...message, ...payload.message } : message
            )
          );
          return;
        }

        setMessages((current) => {
          if (current.some((message) => message.id === payload.id)) {
            return current;
          }

          return [...current, payload];
        });
      } catch {
        // Ignore malformed websocket payloads.
      }
    };

    return () => socket.close();
  }, [channel?.id]);

  const handleRefresh = React.useCallback(async () => {
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

  const handleSend = React.useCallback(async () => {
    const trimmedMessage = messageText.trim();

    if (!trimmedMessage || !channel?.id || isSending) {
      return;
    }

    setIsSending(true);
    setMessageText('');
    setComposerHeight(CHAT_COMPOSER_MIN_HEIGHT);

    try {
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
    } catch (error) {
      setMessageText(trimmedMessage);
      setFeedbackMessage(getChatErrorMessage(error, 'No se pudo enviar el mensaje.'));
    } finally {
      setIsSending(false);
    }
  }, [channel?.id, isSending, messageText]);

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
                <Alert icon={CircleAlertIcon} variant="destructive" className="max-w-xl">
                  <AlertTitle>No pudimos abrir el chat</AlertTitle>
                  <AlertDescription>
                    {feedbackMessage || 'Ha ocurrido un error preparando el chat comunitario.'}
                  </AlertDescription>
                </Alert>
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
                  />
                )}
                contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} />
                }
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
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
          </View>

          {state === 'ready' ? (
            <CardContent className="gap-3 border-t border-border px-4 py-4">
              {feedbackMessage ? (
                <Alert icon={CircleAlertIcon} variant="destructive">
                  <AlertTitle>Atención</AlertTitle>
                  <AlertDescription>{feedbackMessage}</AlertDescription>
                </Alert>
              ) : null}

              <View className="flex-row items-end gap-3 rounded-3xl border border-border bg-background px-3 py-2">
                <Textarea
                  value={messageText}
                  onChangeText={setMessageText}
                  onContentSizeChange={(event) => {
                    const nextHeight = Math.max(
                      CHAT_COMPOSER_MIN_HEIGHT,
                      Math.min(
                        CHAT_COMPOSER_MAX_HEIGHT,
                        Math.ceil(event.nativeEvent.contentSize.height)
                      )
                    );
                    setComposerHeight(nextHeight);
                  }}
                  placeholder="Escribe tu mensaje"
                  numberOfLines={1}
                  scrollEnabled={composerHeight >= CHAT_COMPOSER_MAX_HEIGHT}
                  style={{ height: composerHeight, maxHeight: CHAT_COMPOSER_MAX_HEIGHT }}
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
                    <Icon as={SendIcon} size={16} className="text-primary-foreground" />
                  )}
                </Button>
              </View>
            </CardContent>
          ) : null}
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
}
