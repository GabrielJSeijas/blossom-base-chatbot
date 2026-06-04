import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
  Modal,
} from "react-native";
import Markdown from "react-native-markdown-display";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";

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

type RiskAlert = {
  id: string;
  createdAt: string;
  severity: "Alta" | "Crítica";
  status: "Pendiente";
  person: {
    name: string;
    email: string;
    phone: string;
    age: string;
  };
  summary: string;
  triggerMessage: string;
  recommendedAction: string;
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

const createDemoRiskAlert = (): RiskAlert => ({
  id: `alert-${Date.now()}`,
  createdAt: new Date().toLocaleString(),
  severity: "Alta",
  status: "Pendiente",
  person: {
    name: "Andrea Rodríguez",
    email: "andrea.demo@blossom.local",
    phone: "+58 412-0000000",
    age: "24 años",
  },
  summary:
    "El bot detectó lenguaje asociado con una posible situación de riesgo emocional.",
  triggerMessage:
    "No quiero seguir con esto. Siento que ya no puedo más.",
  recommendedAction:
    "Contactar a la persona, validar su seguridad inmediata y escalar el caso según el protocolo clínico.",
});

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
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
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);  
  const [selectedAlert, setSelectedAlert] = useState<RiskAlert | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const show = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

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

  const handleCreateDemoAlert = () => {
    const newAlert = createDemoRiskAlert();

    setAlerts((prev) => [newAlert, ...prev]);
    setSelectedAlert(newAlert);
  };

  const handleDeleteAlert = (alertId: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));

    setSelectedAlert((current) =>
      current?.id === alertId ? null : current
    );
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
    Keyboard.dismiss();
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
  <KeyboardAvoidingView
    style={styles.safeArea}
    behavior={Platform.OS === "ios" ? "padding" : undefined}
    keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
  >
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom }]}>
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

            <View style={styles.headerActions}>
              <Pressable
                style={styles.notificationButton}
                onPress={() => setIsAlertsOpen(true)}
                accessibilityLabel="Abrir bandeja de alertas"
              >
                <Ionicons
                  name="notifications-outline"
                  size={27}
                  color="#FFFFFF"
                />

                {alerts.length > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {alerts.length > 9 ? "9+" : alerts.length}
                    </Text>
                  </View>
                )}
              </Pressable>

              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{userLabel}</Text>
              </View>
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
            ref={scrollViewRef}
            style={styles.chatContainer}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
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
                  {msg.sender === "bot" ? (
                    <Markdown style={markdownStyles}>
                      {msg.text}
                    </Markdown>
                  ) : (
                    <Text style={[styles.messageText, styles.userMessageText]}>
                      {msg.text}
                    </Text>
                  )}
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
          <Modal
            visible={isAlertsOpen}
            animationType="slide"
            transparent
            onRequestClose={() => setIsAlertsOpen(false)}
          >
            <View style={styles.modalBackdrop}>
              <View
                style={[
                  styles.alertPanel,
                  {
                    paddingTop: insets.top + 18,
                    paddingBottom: insets.bottom + 18,
                  },
                ]}
              >
                <View style={styles.alertHeader}>
                  <View>
                    <Text style={styles.alertHeaderTitle}>Alertas de riesgo</Text>
                    <Text style={styles.alertHeaderSubtitle}>
                      {alerts.length === 0
                        ? "No hay casos pendientes"
                        : `${alerts.length} ${
                            alerts.length === 1 ? "caso pendiente" : "casos pendientes"
                          }`}
                    </Text>
                  </View>

                  <Pressable
                    style={styles.closeAlertsButton}
                    onPress={() => {
                      setIsAlertsOpen(false);
                      setSelectedAlert(null);
                    }}
                  >
                    <Ionicons name="close" size={26} color="#1D3458" />
                  </Pressable>
                </View>

                <Pressable
                  style={styles.createDemoAlertButton}
                  onPress={handleCreateDemoAlert}
                >
                  <Ionicons name="add-circle-outline" size={21} color="#FFFFFF" />
                  <Text style={styles.createDemoAlertButtonText}>
                    Crear alerta de prueba
                  </Text>
                </Pressable>

                {selectedAlert ? (
                  <ScrollView
                    style={styles.alertContent}
                    showsVerticalScrollIndicator={false}
                  >
                    <Pressable
                      style={styles.backToAlertsButton}
                      onPress={() => setSelectedAlert(null)}
                    >
                      <Ionicons name="arrow-back" size={19} color="#1D3458" />
                      <Text style={styles.backToAlertsText}>Volver a la bandeja</Text>
                    </Pressable>

                    <View style={styles.alertDetailCard}>
                      <View style={styles.alertDetailTopRow}>
                        <View style={styles.criticalChip}>
                          <Ionicons name="warning" size={16} color="#FFFFFF" />
                          <Text style={styles.criticalChipText}>
                            Riesgo {selectedAlert.severity.toLowerCase()}
                          </Text>
                        </View>

                        <Text style={styles.alertDate}>
                          {selectedAlert.createdAt}
                        </Text>
                      </View>

                      <Text style={styles.alertDetailTitle}>
                        Persona posiblemente en riesgo
                      </Text>

                      <Text style={styles.alertDetailDescription}>
                        {selectedAlert.summary}
                      </Text>

                      <View style={styles.personInformationCard}>
                        <Text style={styles.informationSectionTitle}>
                          Información de la persona
                        </Text>

                        <Text style={styles.informationLabel}>Nombre</Text>
                        <Text style={styles.informationValue}>
                          {selectedAlert.person.name}
                        </Text>

                        <Text style={styles.informationLabel}>Edad</Text>
                        <Text style={styles.informationValue}>
                          {selectedAlert.person.age}
                        </Text>

                        <Text style={styles.informationLabel}>Correo electrónico</Text>
                        <Text style={styles.informationValue}>
                          {selectedAlert.person.email}
                        </Text>

                        <Text style={styles.informationLabel}>Teléfono</Text>
                        <Text style={styles.informationValue}>
                          {selectedAlert.person.phone}
                        </Text>
                      </View>

                      <View style={styles.triggerMessageCard}>
                        <Text style={styles.informationSectionTitle}>
                          Fragmento detectado
                        </Text>

                        <Text style={styles.triggerMessageText}>
                          “{selectedAlert.triggerMessage}”
                        </Text>
                      </View>

                      <View style={styles.recommendedActionCard}>
                        <Text style={styles.informationSectionTitle}>
                          Acción recomendada
                        </Text>

                        <Text style={styles.recommendedActionText}>
                          {selectedAlert.recommendedAction}
                        </Text>
                      </View>

                      <Pressable
                        style={styles.deleteAlertButton}
                        onPress={() => handleDeleteAlert(selectedAlert.id)}
                      >
                        <Ionicons name="trash-outline" size={19} color="#FFFFFF" />
                        <Text style={styles.deleteAlertButtonText}>
                          Eliminar alerta
                        </Text>
                      </Pressable>
                    </View>
                  </ScrollView>
                ) : alerts.length === 0 ? (
                  <View style={styles.emptyAlertsState}>
                    <View style={styles.emptyAlertsIcon}>
                      <Ionicons
                        name="notifications-off-outline"
                        size={35}
                        color="#1D3458"
                      />
                    </View>

                    <Text style={styles.emptyAlertsTitle}>
                      No hay alertas pendientes
                    </Text>

                    <Text style={styles.emptyAlertsText}>
                      Cuando el bot detecte una conversación de riesgo, aparecerá
                      una notificación en esta bandeja.
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    style={styles.alertContent}
                    showsVerticalScrollIndicator={false}
                  >
                    {alerts.map((alert) => (
                      <Pressable
                        key={alert.id}
                        style={styles.alertListItem}
                        onPress={() => setSelectedAlert(alert)}
                      >
                        <View style={styles.alertListIcon}>
                          <Ionicons name="warning" size={22} color="#FFFFFF" />
                        </View>

                        <View style={styles.alertListInformation}>
                          <View style={styles.alertListTopRow}>
                            <Text style={styles.alertPersonName}>
                              {alert.person.name}
                            </Text>

                            <Text style={styles.alertListDate}>
                              {alert.createdAt}
                            </Text>
                          </View>

                          <Text style={styles.alertListSummary} numberOfLines={2}>
                            {alert.summary}
                          </Text>

                          <Text style={styles.alertListLink}>
                            Ver información del caso
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>
            </View>
          </Modal>
        </View>
        
    </KeyboardAvoidingView>
  );
}

const markdownStyles = {
  body: {
    color: "#1D3458",
    fontSize: 15,
    lineHeight: 21,
  },
  strong: {
    fontWeight: "bold" as const,
    color: "#1D3458",
  },
  em: {
    fontStyle: "italic" as const,
  },
  bullet_list: {
    marginVertical: 4,
  },
  ordered_list: {
    marginVertical: 4,
  },
  list_item: {
    marginBottom: 2,
  },
  code_inline: {
    backgroundColor: "#E8EEF7",
    borderRadius: 4,
    paddingHorizontal: 4,
    fontFamily: "monospace",
    fontSize: 13,
    color: "#1D3458",
  },
};

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

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  notificationBadge: {
    position: "absolute",
    top: -4,
    right: -3,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: "#E64C5D",
    borderWidth: 2,
    borderColor: "#1D3458",
    alignItems: "center",
    justifyContent: "center",
  },

  notificationBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },

  alertPanel: {
    flex: 1,
    backgroundColor: "#F7F9FC",
    paddingHorizontal: 20,
  },

  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  alertHeaderTitle: {
    color: "#1D3458",
    fontSize: 26,
    fontWeight: "800",
  },

  alertHeaderSubtitle: {
    color: "#6D7890",
    fontSize: 14,
    marginTop: 3,
  },

  closeAlertsButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E4E9F1",
  },

  createDemoAlertButton: {
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: "#F48D84",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  createDemoAlertButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },

  alertContent: {
    flex: 1,
  },

  emptyAlertsState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },

  emptyAlertsIcon: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "#E8EEF7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  emptyAlertsTitle: {
    color: "#1D3458",
    fontSize: 21,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 7,
  },

  emptyAlertsText: {
    color: "#6D7890",
    textAlign: "center",
    fontSize: 15,
    lineHeight: 21,
  },

  alertListItem: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4E9F1",
    padding: 14,
    marginBottom: 12,
  },
  
  alertListIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E64C5D",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  alertListInformation: {
    flex: 1,
  },
  alertListTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  alertPersonName: {
    flex: 1,
    color: "#1D3458",
    fontSize: 16,
    fontWeight: "800",
  },
  alertListDate: {
    color: "#8B95A8",
    fontSize: 11,
  },
  alertListSummary: {
    color: "#667085",
    fontSize: 14,
    lineHeight: 19,
    marginTop: 5,
  },
  alertListLink: {
    color: "#E56864",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 7,
  },

  backToAlertsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  backToAlertsText: {
    color: "#1D3458",
    fontSize: 14,
    fontWeight: "800",
  },
  alertDetailCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E4E9F1",
    padding: 16,
    marginBottom: 18,
  },
  alertDetailTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  criticalChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#E64C5D",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  criticalChipText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  alertDate: {
    color: "#8B95A8",
    fontSize: 12,
  },
  alertDetailTitle: {
    color: "#1D3458",
    fontSize: 21,
    fontWeight: "800",
    marginTop: 16,
  },
  alertDetailDescription: {
    color: "#667085",
    fontSize: 15,
    lineHeight: 21,
    marginTop: 7,
    marginBottom: 14,
  },
  personInformationCard: {
    backgroundColor: "#F4F7FB",
    borderRadius: 15,
    padding: 14,
    marginBottom: 12,
  },
  triggerMessageCard: {
    backgroundColor: "#FFF2F1",
    borderRadius: 15,
    padding: 14,
    marginBottom: 12,
  },
  recommendedActionCard: {
    backgroundColor: "#EDF9E9",
    borderRadius: 15,
    padding: 14,
    marginBottom: 16,
  },
  informationSectionTitle: {
    color: "#1D3458",
    fontWeight: "800",
    fontSize: 15,
    marginBottom: 8,
  },
  informationLabel: {
    color: "#7A8496",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 7,
  },
  informationValue: {
    color: "#1D3458",
    fontSize: 15,
    marginTop: 2,
  },
  triggerMessageText: {
    color: "#7D3434",
    fontSize: 15,
    fontStyle: "italic",
    lineHeight: 21,
  },
  recommendedActionText: {
    color: "#315C30",
    fontSize: 15,
    lineHeight: 21,
  },
  deleteAlertButton: {
    minHeight: 48,
    backgroundColor: "#E64C5D",
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  deleteAlertButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },

});
