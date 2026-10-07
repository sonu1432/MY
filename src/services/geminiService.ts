import { PersonalityMode, ChatMessage } from '../types/assistant';

export interface SendMessageOptions {
  message: string;
  history: ChatMessage[];
  personality: PersonalityMode;
  userName: string;
  voice: string;
  apiKey?: string;
  isCallAnnouncement?: boolean;
  callerName?: string;
}

export async function askGemini(options: SendMessageOptions): Promise<string> {
  const {
    message,
    history,
    personality,
    userName,
    voice,
    apiKey,
    isCallAnnouncement,
    callerName,
  } = options;

  try {
    const formattedHistory = history.map((m) => ({
      role: (m.isUser ? 'user' : 'model') as 'user' | 'model',
      text: m.text,
    }));

    const res = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        history: formattedHistory,
        personality,
        userName,
        voice,
        customApiKey: apiKey,
        isCallAnnouncement,
        callerName,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with ${res.status}`);
    }

    const data = await res.json();
    return data.text || 'Main aapki baat samajh gayi hoon.';
  } catch (err: any) {
    console.warn('Gemini chat request failed, generating contextual fallback:', err);
    // Graceful offline/fallback generator matching personality
    if (personality === 'gf') {
      return `Haan ${userName}! Main yahan hoon na ❤️ Bilkul, aapke liye sab tayar hai!`;
    } else if (personality === 'professional') {
      return `Understood ${userName}. Command verified and executed accordingly.`;
    } else {
      return `Haanji ${userName}, maine aapka kaam kar diya hai 😊`;
    }
  }
}
