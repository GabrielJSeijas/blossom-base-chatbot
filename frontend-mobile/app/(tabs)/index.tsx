import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from "react-native";
import Constants from "expo-constants";

type ChatMessage = {
  sender: "user" | "bot";
  text: string;
};

type AuthMode = "login" | "register";

type LoggedUser = {
  id: string;
  email: string;
  displayName?: string | null;
};

type HistoryMessage = {
  id: string;
  conversationId: string;
  sender: ChatMessage["sender"];
  text: string;
};

const defaultMessages: ChatMessage[] = [
  {
    sender: "bot",
    text: "Hi, I'm Blossom. How are you feeling today?",
  },
];

const getApiBaseUrl = () => {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;

  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }

  const hostUri = Constants.expoConfig?.hostUri;

  if (!hostUri) {
    return "http://localhost:8001";
  }

  const host = hostUri.split(":")[0];

  return `http://${host}:8001`;
};

const API_BASE_URL = getApiBaseUrl();

export default function HomeScreen() {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [loggedUser, setLoggedUser] = useState<LoggedUser | null>(null);
  const [authError, setAuthError] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: "bot",
      text: "Hi, I'm Blossom. How are you feeling today?",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const isLoggedIn = Boolean(authToken && loggedUser);

  const userLabel = useMemo(() => {
    if (!loggedUser) {
      return "B";
    }

    const label = loggedUser.displayName || loggedUser.email;
    return label.charAt(0).toUpperCase();
  }, [loggedUser]);

  const handleAuth = async () => {
    if (isAuthLoading) return;

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    const normalizedDisplayName = displayName.trim();

    if (!normalizedEmail || !normalizedPassword) {
      setAuthError("Email y contraseña son obligatorios.");
      return;
    }

    if (authMode === "register" && normalizedPassword.length < 8) {
      setAuthError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setIsAuthLoading(true);
    setAuthError("");

    try {
      const endpoint = authMode === "register" ? "/auth/register" : "/auth/login";
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          password: normalizedPassword,
          displayName: normalizedDisplayName || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAuthError(data?.error || "No se pudo autenticar.");
        return;
      }

      const nextToken = data.token || "";
      setAuthToken(nextToken);
      setLoggedUser(data.user || null);
      setPassword("");
      setDisplayName("");

      if (nextToken) {
        try {
          const historyResponse = await fetch(`${API_BASE_URL}/chat/history`, {
            headers: {
              Authorization: `Bearer ${nextToken}`,
            },
          });

          const historyData = await historyResponse.json();

          if (!historyResponse.ok) {
            throw new Error(historyData?.error || "No se pudo cargar el historial.");
          }

          const historyMessages = Array.isArray(historyData?.messages)
            ? (historyData.messages as HistoryMessage[])
            : [];

          setMessages(
            historyMessages.length > 0
              ? historyMessages.map((item) => ({
                  sender: item.sender,
                  text: item.text,
                }))
              : defaultMessages
          );
          setConversationId(historyData?.latestConversationId || null);
          setShowIntro(historyMessages.length === 0);
        } catch {
          setMessages(defaultMessages);
          setConversationId(null);
          setShowIntro(true);
        }
      }
    } catch {
      setAuthError("No se pudo conectar con el backend.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setAuthToken("");
    setLoggedUser(null);
    setConversationId(null);
    setMessage("");
    setMessages(defaultMessages);
    setShowIntro(true);
  };

  const sendMessage = async () => {
    if (!message.trim() || isLoading || !authToken) return;

    const userMessage = message.trim();
    setShowIntro(false);

    setMessages((prev) => [
      ...prev,
      {
        sender: "user",
        text: userMessage,
      },
    ]);

    setMessage("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          message: userMessage,
          conversationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data?.conversationId) {
          setConversationId(data.conversationId);
        }

        throw new Error(data?.error || "No se pudo enviar el mensaje.");
      }

      if (data?.conversationId) {
        setConversationId(data.conversationId);
      }

      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text:
            data.response ||
            data.message ||
            "I received your message.",
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text:
            error instanceof Error
              ? error.message
              : "Sorry, I couldn't connect to the server.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <View style={styles.backgroundCircleOne} />
          <View style={styles.backgroundCircleTwo} />
          <View style={styles.backgroundLeafOne} />
          <View style={styles.backgroundLeafTwo} />

          <View style={styles.header}>
            <View>
              <Text style={styles.logo}>✿ Blossom</Text>
              <Text style={styles.subtitle}>
                {isLoggedIn
                  ? `Sesión: ${loggedUser?.email}`
                  : "Emotional support chat"}
              </Text>
            </View>

            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{userLabel}</Text>
            </View>
          </View>

          {!isLoggedIn && (
            <View style={styles.authCard}>
              <Text style={styles.authTitle}>
                {authMode === "login" ? "Iniciar sesión" : "Crear cuenta"}
              </Text>

              <TextInput
                style={styles.authInput}
                placeholder="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor="#9A9A9A"
                value={email}
                onChangeText={setEmail}
              />

              {authMode === "register" && (
                <TextInput
                  style={styles.authInput}
                  placeholder="Nombre para mostrar"
                  placeholderTextColor="#9A9A9A"
                  value={displayName}
                  onChangeText={setDisplayName}
                />
              )}

              <TextInput
                style={styles.authInput}
                placeholder="Contraseña"
                secureTextEntry
                placeholderTextColor="#9A9A9A"
                value={password}
                onChangeText={setPassword}
              />

              {!!authError && <Text style={styles.authError}>{authError}</Text>}

              <Pressable
                style={[styles.authButton, isAuthLoading && styles.sendButtonDisabled]}
                onPress={handleAuth}
                disabled={isAuthLoading}
              >
                <Text style={styles.authButtonText}>
                  {isAuthLoading
                    ? "Cargando..."
                    : authMode === "login"
                    ? "Entrar"
                    : "Registrar"}
                </Text>
              </Pressable>

              <Pressable
                style={styles.switchModeButton}
                onPress={() => {
                  setAuthError("");
                  setAuthMode((prev) => (prev === "login" ? "register" : "login"));
                }}
              >
                <Text style={styles.switchModeText}>
                  {authMode === "login"
                    ? "¿No tienes cuenta? Regístrate"
                    : "¿Ya tienes cuenta? Inicia sesión"}
                </Text>
              </Pressable>
            </View>
          )}

          {isLoggedIn && (
            <View style={styles.sessionActions}>
              <Pressable style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
              </Pressable>
            </View>
          )}

          {showIntro && isLoggedIn && (
            <View style={styles.introCard}>
              <Pressable
                style={styles.closeIntroButton}
                onPress={() => setShowIntro(false)}
              >
                <Text style={styles.closeIntroText}>×</Text>
              </Pressable>

              <Text style={styles.introTitle}>Welcome to Blossom</Text>
              <Text style={styles.introText}>
                Send a message and receive supportive guidance from the assistant.
              </Text>
            </View>
          )}

          <ScrollView
            style={styles.chatContainer}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
          >
            {!isLoggedIn && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  Registra o inicia sesión para comenzar a chatear y guardar tus mensajes.
                </Text>
              </View>
            )}

            {isLoggedIn && messages.map((msg, index) => (
              <View
                key={index}
                style={[
                  styles.messageRow,
                  msg.sender === "user"
                    ? styles.userMessageRow
                    : styles.botMessageRow,
                ]}
              >
                {msg.sender === "bot" && (
                  <View style={styles.botIcon}>
                    <Text style={styles.botIconText}>✿</Text>
                  </View>
                )}

                <View
                  style={[
                    styles.messageBubble,
                    msg.sender === "user"
                      ? styles.userBubble
                      : styles.botBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      msg.sender === "user"
                        ? styles.userMessageText
                        : styles.botMessageText,
                    ]}
                  >
                    {msg.text}
                  </Text>
                </View>
              </View>
            ))}

            {isLoading && isLoggedIn && (
              <View style={[styles.messageRow, styles.botMessageRow]}>
                <View style={styles.botIcon}>
                  <Text style={styles.botIconText}>✿</Text>
                </View>

                <View style={[styles.messageBubble, styles.botBubble]}>
                  <Text style={styles.botMessageText}>Escribiendo...</Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.inputArea}>
            <TextInput
              style={styles.input}
              placeholder={
                isLoggedIn
                  ? "Write your message..."
                  : "Primero inicia sesión para chatear"
              }
              placeholderTextColor="#9A9A9A"
              value={message}
              onChangeText={setMessage}
              multiline
              editable={isLoggedIn}
            />

            <Pressable
              style={[
                styles.sendButton,
                (isLoading || !isLoggedIn) && styles.sendButtonDisabled,
              ]}
              onPress={sendMessage}
              disabled={isLoading || !isLoggedIn}
            >
              <Text style={styles.sendButtonText}>
                {isLoading ? "..." : "Send"}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#1D3458",
  },
  keyboardContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#1D3458",
    paddingHorizontal: 20,
    paddingTop: 20,
    position: "relative",
  },

  backgroundCircleOne: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(255,255,255,0.04)",
    top: -80,
    left: -90,
  },
  backgroundCircleTwo: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: "rgba(255,255,255,0.035)",
    bottom: -140,
    right: -130,
  },
  backgroundLeafOne: {
    position: "absolute",
    width: 150,
    height: 60,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.055)",
    top: 120,
    right: -35,
    transform: [{ rotate: "-25deg" }],
  },
  backgroundLeafTwo: {
    position: "absolute",
    width: 180,
    height: 70,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.045)",
    bottom: 180,
    left: -70,
    transform: [{ rotate: "-35deg" }],
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  logo: {
    fontSize: 30,
    color: "#FFFFFF",
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 4,
    color: "#D9E2F0",
    fontSize: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#79F141",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#FFFFFF",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
  },

  authCard: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  authTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
  },
  authInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    minHeight: 46,
    paddingHorizontal: 14,
    marginBottom: 10,
    color: "#1D3458",
  },
  authError: {
    color: "#FFD7D7",
    marginBottom: 8,
    fontWeight: "600",
  },
  authButton: {
    backgroundColor: "#79F141",
    borderRadius: 14,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  authButtonText: {
    color: "#1D3458",
    fontWeight: "800",
    fontSize: 15,
  },
  switchModeButton: {
    marginTop: 10,
    alignItems: "center",
  },
  switchModeText: {
    color: "#D9E2F0",
    fontWeight: "700",
  },
  sessionActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 10,
  },
  logoutButton: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.25)",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  logoutButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  introCard: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    },
    closeIntroButton: {
    position: "absolute",
    top: 12,
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  closeIntroText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 24,
  },
  introTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 6,
  },
  introText: {
    color: "#D9E2F0",
    fontSize: 15,
    lineHeight: 21,
  },

  chatContainer: {
    flex: 1,
  },
  chatContent: {
    paddingBottom: 18,
  },
  emptyState: {
    paddingVertical: 28,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  emptyStateText: {
    color: "#D9E2F0",
    lineHeight: 22,
    textAlign: "center",
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 14,
  },
  userMessageRow: {
    justifyContent: "flex-end",
  },
  botMessageRow: {
    justifyContent: "flex-start",
  },
  botIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F48D84",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  botIconText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  messageBubble: {
    maxWidth: "78%",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  botBubble: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 5,
  },
  userBubble: {
    backgroundColor: "#F48D84",
    borderBottomRightRadius: 5,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  botMessageText: {
    color: "#1D3458",
  },
  userMessageText: {
    color: "#FFFFFF",
  },

  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingVertical: 8,
    paddingLeft: 18,
    paddingRight: 8,
    marginBottom: 18,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    color: "#1D3458",
    fontSize: 16,
    paddingVertical: 10,
  },
  sendButton: {
    minWidth: 78,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#F48D84",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: "#C9C9C9",
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
});
