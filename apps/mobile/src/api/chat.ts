const API_URL = "http://localhost:3000"; // Replace with your local IP for physical device testing

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
        throw new Error("Network response was not ok");
      }

      return await response.json();
    } catch (error) {
      console.error("Error in sendMessage:", error);
      throw error;
    }
  },
};
