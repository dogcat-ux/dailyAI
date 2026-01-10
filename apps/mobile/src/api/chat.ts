import Constants from "expo-constants";
import { Platform } from "react-native";

// 自动检测 API URL
// 在真机上，使用开发服务器的 IP 地址；在模拟器/Web 上使用 localhost
const getApiUrl = () => {
  // 如果设置了环境变量，优先使用
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 在真机上，从 Expo 开发服务器地址推断后端地址
  // Constants.expoConfig?.hostUri 格式类似 "192.168.43.190:8081"
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri && Platform.OS !== "web") {
    const debuggerHost = hostUri.split(":")[0];
    // 检查是否是本地 IP 地址（不是 localhost）
    if (debuggerHost && debuggerHost !== "localhost" && debuggerHost !== "127.0.0.1") {
      // 使用开发服务器的 IP，但端口改为 3000（后端服务端口）
      return `http://${debuggerHost}:3000`;
    }
  }

  // 默认使用 localhost（适用于模拟器和 Web）
  return "http://localhost:3000";
};

export const API_URL = getApiUrl();

// 导出用于调试
if (__DEV__) {
  console.log("API URL:", API_URL);
}

export interface SendMessageRequest {
  content: string;
  userId: string;
  sessionId?: string;
}

export interface SendMessageResponse {
  sessionId: string;
  response: string;
}

export const chatApi = {
  async sendMessage(data: SendMessageRequest): Promise<SendMessageResponse> {
    try {
      const response = await fetch(`${API_URL}/chat/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error Response:", errorText);
        throw new Error(`Network response was not ok: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error in sendMessage:", error);
      throw error;
    }
  },
};
