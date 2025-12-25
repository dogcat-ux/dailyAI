import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { chatApi } from "../../src/api/chat";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
}

const MOCK_USER_ID = "test-user-id"; // In real app, this would come from auth

const COLORS = {
  primary: "#E8C39E", // 温暖的金粉色/米黄色
  secondary: "#2C2621", // 深咖啡色气泡
  accent: "#F9D949", // 明亮的金黄色（用于语音按钮）
  background: "#1A1614", // 沉浸式深啡色背景
  white: "#FFFFFF",
  text: "#E8C39E",
  textLight: "#A0948C",
  aiBubble: "#2C2621",
  userBubble: "#E8C39E",
  userText: "#1A1614",
};

export default function ChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Welcome Back! How can I assist you today?",
      sender: "ai",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(true);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);

  const sendMessage = async () => {
    if (inputText.trim().length === 0 || isLoading) return;

    const userMessageText = inputText;
    const newUserMessage: Message = {
      id: Date.now().toString(),
      text: userMessageText,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInputText("");
    setIsLoading(true);

    try {
      const result = await chatApi.sendMessage({
        content: userMessageText,
        userId: MOCK_USER_ID,
        sessionId: sessionId,
      });

      setSessionId(result.sessionId);

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: result.response,
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "抱歉，服务出现了一点问题，请稍后再试。",
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageContainer,
        item.sender === "user" ? styles.userMessage : styles.aiMessage,
      ]}
    >
      <Text
        style={[
          styles.messageText,
          { color: item.sender === "user" ? COLORS.userText : COLORS.white },
        ]}
      >
        {item.text}
      </Text>
      <Text
        style={[
          styles.timestamp,
          {
            color:
              item.sender === "user" ? "rgba(26,22,20,0.5)" : COLORS.textLight,
            alignSelf: item.sender === "user" ? "flex-end" : "flex-start",
          },
        ]}
      >
        {item.timestamp.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* 沉浸式头部 */}
      <SafeAreaView style={styles.safeHeader}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-down" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>DailyAI</Text>
            <View style={styles.statusDot} />
          </View>
          <TouchableOpacity style={styles.headerIconButton}>
            <Ionicons
              name="ellipsis-horizontal"
              size={24}
              color={COLORS.text}
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => (
          <View style={styles.aiVisualContainer}>
            <View style={styles.aiOrb}>
              <View style={styles.aiOrbInner} />
            </View>
            <Text style={styles.aiStatusText}>Listening...</Text>
          </View>
        )}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        style={styles.inputWrapper}
      >
        <View style={styles.bottomControls}>
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={styles.modeToggle}
              onPress={() => setIsVoiceMode(!isVoiceMode)}
            >
              <Ionicons
                name={isVoiceMode ? "chatbox-outline" : "mic-outline"}
                size={24}
                color={COLORS.text}
              />
            </TouchableOpacity>

            {isVoiceMode ? (
              <View style={styles.voiceContainer}>
                <TouchableOpacity style={styles.voiceButton}>
                  <View style={styles.voiceButtonInner}>
                    <Ionicons name="mic" size={32} color={COLORS.background} />
                  </View>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.textInputContainer}>
                <TextInput
                  style={styles.input}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Type a message..."
                  placeholderTextColor={COLORS.textLight}
                  multiline
                />
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    !inputText.trim() && styles.sendButtonDisabled,
                  ]}
                  onPress={sendMessage}
                  disabled={!inputText.trim() || isLoading}
                >
                  <Ionicons
                    name="arrow-up"
                    size={20}
                    color={COLORS.background}
                  />
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.modeToggle}>
              <Ionicons name="add" size={28} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeHeader: {
    backgroundColor: "transparent",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4ADE80",
    marginLeft: 6,
  },
  messageList: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  aiVisualContainer: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 40,
  },
  aiOrb: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(232, 195, 158, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(232, 195, 158, 0.2)",
  },
  aiOrbInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  aiStatusText: {
    color: COLORS.text,
    fontSize: 18,
    marginTop: 20,
    fontWeight: "500",
  },
  messageContainer: {
    maxWidth: "85%",
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
  },
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: COLORS.userBubble,
    borderBottomRightRadius: 4,
  },
  aiMessage: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.aiBubble,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
  },
  inputWrapper: {
    width: "100%",
  },
  bottomControls: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
    paddingTop: 10,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modeToggle: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  voiceContainer: {
    flex: 1,
    alignItems: "center",
  },
  voiceButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(249, 217, 73, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  voiceButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accent,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  textInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 5,
    marginHorizontal: 10,
  },
  input: {
    flex: 1,
    color: COLORS.white,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.secondary,
    opacity: 0.5,
  },
});
