import { useState } from "react";
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

type ChatMessage = {
  sender: "user" | "bot";
  text: string;
};

const API_URL = "http://192.168.1.5:8001/chat";

export default function HomeScreen() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: "bot",
      text: "Hi, I'm Blossom. How are you feeling today?",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage = message.trim();

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
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
        }),
      });

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: data.response || data.message || "I received your message.",
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "Sorry, I couldn't connect to the server.",
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
              <Text style={styles.subtitle}>Emotional support chat</Text>
            </View>

            <View style={styles.avatar}>
              <Text style={styles.avatarText}>B</Text>
            </View>
          </View>

          <View style={styles.introCard}>
            <Text style={styles.introTitle}>Welcome to Blossom</Text>
            <Text style={styles.introText}>
              Send a message and receive supportive guidance from the assistant.
            </Text>
          </View>

          <ScrollView
            style={styles.chatContainer}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((msg, index) => (
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

            {isLoading && (
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
              placeholder="Write your message..."
              placeholderTextColor="#9A9A9A"
              value={message}
              onChangeText={setMessage}
              multiline
            />

            <Pressable
              style={[
                styles.sendButton,
                isLoading && styles.sendButtonDisabled,
              ]}
              onPress={sendMessage}
              disabled={isLoading}
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

  introCard: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
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