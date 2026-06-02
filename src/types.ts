export interface WhatsAppSession {
  id: string;
  phoneNumber: string;
  status: 'disconnected' | 'connecting' | 'pairing' | 'connected' | 'error';
  pairingCode?: string;
  codeLive?: boolean;
  lastError?: string;
  assignedPhone?: string;
  remoteCopyTrigger?: boolean;
  updatedAt: string;
}

export interface WhatsAppChat {
  id: string;
  name?: string;
  unreadCount?: number;
  lastMessage?: {
    text: string;
    timestamp: number;
    fromMe: boolean;
  };
  updatedAt: number;
}

export interface WhatsAppMessage {
  id: string;
  fromMe: boolean;
  text: string;
  timestamp: number;
}

export interface SessionListResponse {
  success: boolean;
  sessions: WhatsAppSession[];
}

export interface PairingCodeResponse {
  success: boolean;
  sessionId: string;
  pairingCode: string;
  message: string;
}

export interface SendMessageResponse {
  success: boolean;
  message: string;
}

