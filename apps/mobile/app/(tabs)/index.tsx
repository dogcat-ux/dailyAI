import React, { useState, useRef, useEffect } from "react";
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
  Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { chatApi } from "../../src/api/chat";

// 条件导入 @react-native-voice/voice（仅在开发构建中可用）
let Voice: any = null;
try {
  if (Platform.OS !== "web") {
    Voice = require("@react-native-voice/voice").default;
  }
} catch (error) {
  console.warn("@react-native-voice/voice 不可用，需要开发构建才能使用语音功能");
}

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
  const [aiStatus, setAiStatus] = useState<"idle" | "listening" | "thinking">("idle");
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [recognizedText, setRecognizedText] = useState("");
  const recognizedTextRef = useRef<string>(""); // 用于保存最新的识别结果

  // 检查是否有真正的用户消息（除了初始欢迎消息）
  const hasUserMessages = messages.some((msg) => msg.sender === "user");

  // 初始化 @react-native-voice/voice（仅在开发构建中可用）
  useEffect(() => {
    if (Platform.OS !== "web" && Voice) {
      // 设置事件监听器
      Voice.onSpeechStart = () => {
        console.log("语音识别开始");
        setIsRecording(true);
        setAiStatus("listening");
      };

      Voice.onSpeechRecognized = () => {
        console.log("语音识别中...");
      };

      Voice.onSpeechEnd = () => {
        console.log("语音识别结束");
        setIsRecording(false);
        setAiStatus("idle");
        // 识别结束后，如果有识别结果，发送消息
        const finalText = recognizedTextRef.current.trim();
        if (finalText) {
          console.log("发送最终识别结果:", finalText);
          handleVoiceMessage(finalText);
          recognizedTextRef.current = ""; // 清空
          setRecognizedText("");
        }
      };

      Voice.onSpeechError = (e: any) => {
        // 如果是"已经启动"的错误，忽略它（可能是重复启动导致的，但识别仍在正常进行）
        if (e.error?.message?.includes("already started")) {
          console.log("语音识别已启动，忽略此错误（识别仍在进行）");
          return; // 不更新状态，让识别继续进行
        }
        
        console.error("语音识别错误:", e);
        setIsRecording(false);
        setAiStatus("idle");
        if (e.error?.code === "ERROR_AUDIO" || e.error?.code === "ERROR_CLIENT") {
          Alert.alert("权限错误", "请允许麦克风权限以使用语音功能");
        } else {
          // 其他错误才显示提示
          Alert.alert("识别错误", "语音识别失败，请重试");
        }
      };

      Voice.onSpeechResults = (e: any) => {
        if (e.value && e.value.length > 0) {
          const text = e.value[0];
          console.log("识别结果:", text);
          // 只更新识别文本，不立即发送，等待用户松开按钮
          setRecognizedText(text);
          recognizedTextRef.current = text; // 同时保存到 ref 中，避免状态更新延迟
        }
      };

      Voice.onSpeechPartialResults = (e: any) => {
        if (e.value && e.value.length > 0) {
          console.log("部分识别结果:", e.value[0]);
        }
      };

      // 清理函数
      return () => {
        Voice.destroy().then(Voice.removeAllListeners);
      };
    }
  }, []);

  // 初始化语音识别（仅 Web 平台）
  useEffect(() => {
    const isSpeechRecognitionAvailable = () => {
      if (Platform.OS === "web") {
        const window = global as any;
        return (
          typeof window !== "undefined" &&
          ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)
        );
      }
      return false;
    };

    if (Platform.OS === "web" && isSpeechRecognitionAvailable()) {
      const window = global as any;
      const SpeechRecognition =
        window.webkitSpeechRecognition || window.SpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "zh-CN"; // 设置为中文

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          // 只保存识别结果，不立即发送
          setRecognizedText(transcript);
          recognizedTextRef.current = transcript;
        };

        recognition.onend = () => {
          setIsRecording(false);
          setAiStatus("idle");
          // 识别结束后，如果有识别结果，发送消息
          const finalText = recognizedTextRef.current.trim();
          if (finalText) {
            console.log("发送最终识别结果:", finalText);
            handleVoiceMessage(finalText);
            recognizedTextRef.current = ""; // 清空
            setRecognizedText("");
          }
        };

        recognition.onerror = (event: any) => {
          console.error("语音识别错误:", event.error);
          setIsRecording(false);
          setAiStatus("idle");
          if (event.error === "not-allowed") {
            Alert.alert("权限错误", "请允许麦克风权限以使用语音功能");
          } else {
            Alert.alert("识别错误", "语音识别失败，请重试");
          }
        };


        recognitionRef.current = recognition;
      }
    }
  }, []);

  // 处理语音消息
  const handleVoiceMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const newUserMessage: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setIsLoading(true);
    setAiStatus("thinking");

    try {
      const result = await chatApi.sendMessage({
        content: text.trim(),
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
      setAiStatus("idle");
    }
  };

  // 获取 AI 状态文本
  const getAiStatusText = () => {
    if (aiStatus === "thinking") return "思考中...";
    if (aiStatus === "listening") return "聆听中...";
    return "等待中...";
  };

  // 处理音频转文字（回退方案：使用 expo-av + 后端 API）

  // 开始录音
  const handleStartRecording = async () => {
    // 如果已经在录音中，直接返回，避免重复启动
    if (isRecording) {
      console.log("语音识别已在进行中，忽略重复启动");
      return;
    }

    if (Platform.OS === "web" && recognitionRef.current) {
      // Web 平台使用 Web Speech API
      try {
        recognitionRef.current.start();
        setIsRecording(true);
        setAiStatus("listening");
      } catch (error) {
        console.error("启动语音识别失败:", error);
        Alert.alert("错误", "无法启动语音识别，请检查麦克风权限");
      }
    } else if (Platform.OS !== "web") {
      // React Native 平台：优先使用 @react-native-voice/voice，否则回退到 expo-av
      if (Voice) {
        // 使用原生语音识别（开发构建）
        try {
          // 先检查是否已经在识别中
          const isRecognizing = await Voice.isRecognizing();
          if (isRecognizing) {
            console.log("语音识别已在进行中，忽略重复启动");
            return;
          }

          const isAvailable = await Voice.isAvailable();
          if (!isAvailable) {
            Alert.alert("错误", "语音识别功能不可用");
            return;
          }
          await Voice.start("zh-CN");
          // 状态会在 Voice.onSpeechStart 回调中更新
        } catch (error: any) {
          console.error("启动语音识别失败:", error);
          // 如果是"已经启动"的错误，忽略它
          if (error?.error?.message?.includes("already started")) {
            console.log("语音识别已启动，忽略错误");
            return;
          }
          setIsRecording(false);
          setAiStatus("idle");
          Alert.alert("错误", "无法启动语音识别，请检查麦克风权限");
        }
      } else {
        // 回退方案：expo-av 不支持语音识别，需要开发构建
        Alert.alert(
          "语音功能不可用",
          "在 Expo Go 中，语音识别功能需要使用开发构建。\n\n请使用以下命令创建开发构建：\n\nnpx expo run:ios\n或\nnpx expo run:android",
          [{ text: "确定" }]
        );
      }
    } else {
      Alert.alert(
        "语音功能不可用",
        "当前浏览器不支持语音识别功能。",
        [{ text: "确定" }]
      );
    }
  };

  // 停止录音并处理
  const handleStopRecording = async () => {
    if (Platform.OS === "web" && recognitionRef.current && isRecording) {
      // Web 平台
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error("停止语音识别失败:", error);
      }
      setIsRecording(false);
      setAiStatus("idle");
    } else if (Platform.OS !== "web" && isRecording) {
      // React Native 平台
      if (Voice) {
        // 使用原生语音识别
        try {
          await Voice.stop();
          // 状态会在 Voice.onSpeechEnd 回调中更新
          // 识别结果会在 Voice.onSpeechEnd 回调中发送
        } catch (error) {
          console.error("停止语音识别失败:", error);
          setIsRecording(false);
          setAiStatus("idle");
          Alert.alert("错误", "停止语音识别时出现问题");
        }
      } else {
        // 回退方案：expo-av 不支持语音识别，需要 @react-native-voice/voice
        // 提示用户需要开发构建才能使用语音功能
        Alert.alert(
          "语音功能不可用",
          "在 Expo Go 中，语音识别功能需要使用开发构建。\n\n请使用以下命令创建开发构建：\n\nnpx expo run:ios\n或\nnpx expo run:android",
          [{ text: "确定" }]
        );
        setIsRecording(false);
        setAiStatus("idle");
      }
    } else {
      setIsRecording(false);
      setAiStatus("idle");
    }
  };

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
    setAiStatus("thinking");

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
      setAiStatus("idle");
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
        ListHeaderComponent={() => {
          // 如果有用户消息，不显示大的 AI 视觉容器
          if (hasUserMessages) return null;
          
          return (
            <View style={styles.aiVisualContainer}>
              <View style={styles.aiOrb}>
                <View style={styles.aiOrbInner} />
              </View>
              <Text style={styles.aiStatusText}>{getAiStatusText()}</Text>
            </View>
          );
        }}
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
                <TouchableOpacity
                  style={[
                    styles.voiceButton,
                    isRecording && styles.voiceButtonRecording,
                  ]}
                  onPressIn={handleStartRecording}
                  onPressOut={handleStopRecording}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.voiceButtonInner,
                      isRecording && styles.voiceButtonInnerRecording,
                    ]}
                  >
                    {isRecording ? (
                      <View style={styles.recordingIndicator} />
                    ) : (
                      <Ionicons name="mic" size={32} color={COLORS.background} />
                    )}
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
  voiceButtonRecording: {
    backgroundColor: "rgba(249, 217, 73, 0.4)",
    transform: [{ scale: 1.1 }],
  },
  voiceButtonInnerRecording: {
    backgroundColor: "#FF4444",
    transform: [{ scale: 0.9 }],
  },
  recordingIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.white,
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
