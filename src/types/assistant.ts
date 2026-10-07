export type PersonalityMode = 'gf' | 'professional' | 'assistant';

export type OrbState = 'idle' | 'listening' | 'speaking' | 'thinking';

export interface PrimeContact {
  id: string;
  name: string;
  number: string;
  relationship?: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: number;
}

export type CommandType =
  | 'OPEN_APP'
  | 'CLOSE_APP'
  | 'CALL'
  | 'SMS'
  | 'WHATSAPP_MSG'
  | 'WHATSAPP_CALL'
  | 'PRIME_CALL'
  | 'PRIME_MSG'
  | 'VOLUME_UP'
  | 'VOLUME_DOWN'
  | 'FLASHLIGHT_ON'
  | 'FLASHLIGHT_OFF'
  | 'WIFI_ON'
  | 'WIFI_OFF'
  | 'BLUETOOTH_ON'
  | 'BLUETOOTH_OFF';

export interface AppCommand {
  type: CommandType;
  params: Record<string, string>;
  rawQuery: string;
  description: string;
}

export interface AssistantSettings {
  apiKey: string;
  userName: string;
  personalityMode: PersonalityMode;
  geminiModel: string;
  geminiVoice: string;
  primeContacts: PrimeContact[];
  accessibilityEnabled: boolean;
  overlayEnabled: boolean;
  keepAliveSeconds: number;
}
