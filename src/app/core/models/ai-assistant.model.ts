export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}

export interface ChatRequest {
  message: string;
}

// POST /api/ai/chat reply (one assistant turn).
export interface ChatResponse {
  id: string;
  role: string;
  reply: string;
  createdAt: string;
}

// One stored turn in GET /api/ai/chat history.
export interface ChatTurn {
  id: string;
  role: string; // 'USER' | 'ASSISTANT'
  content: string;
  createdAt: string;
}

export interface ChatHistoryResponse {
  messages: ChatTurn[];
}
