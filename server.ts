import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Initialize server-side Gemini SDK
const defaultAi = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface ChatRequestBody {
  message: string;
  history?: Array<{ role: 'user' | 'model'; text: string }>;
  personality?: 'gf' | 'professional' | 'assistant';
  userName?: string;
  voice?: string;
  customApiKey?: string;
  isCallAnnouncement?: boolean;
  callerName?: string;
}

app.post('/api/gemini/chat', async (req: Request<{}, {}, ChatRequestBody>, res: Response) => {
  try {
    const {
      message,
      history = [],
      personality = 'gf',
      userName = 'User',
      customApiKey,
      isCallAnnouncement,
      callerName,
    } = req.body;

    const activeApiKey = (typeof customApiKey === 'string' && customApiKey.trim().length > 0)
      ? customApiKey.trim()
      : process.env.GEMINI_API_KEY;

    if (!activeApiKey) {
      return res.status(400).json({
        error: 'No Gemini API key available. Please provide an API key in Settings or configure GEMINI_API_KEY.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey: activeApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // Build system prompt based on Master Prompt specs
    const currentDate = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'full',
      timeStyle: 'medium',
    });

    let personalityPrompt = '';
    if (personality === 'gf') {
      personalityPrompt = `
- You are MYRA, a warm, caring, emotionally expressive AI companion and girlfriend persona for ${userName}.
- Language: Natural Hinglish (conversational mix of Hindi and English) spoken naturally.
- Use words like: "tumhara", "haan", "acha", "bilkul", "arre".
- Subtle emoji expressions: "main yahan hoon ❤️", "tumne yaad kiya? 😊"
- Length: Strictly 1 to 3 short sentences per response.
- Tone: Extremely sweet, affectionate, quick-witted, and attentive.
- Examples:
  "Haan ${userName}! Abhi kar deti hoon 😊"
  "Arre tumne yaad kiya! Bolo kya chahiye mere hero"
  "Bilkul! Tumhara kaam ho gaya ❤️"
`;
    } else if (personality === 'professional') {
      personalityPrompt = `
- You are MYRA, a high-efficiency executive AI assistant.
- Language: Formal, concise English only.
- Tone: Precise, polite, and strictly business-oriented. No emojis.
- Length: Maximum 2 sentences.
`;
    } else {
      personalityPrompt = `
- You are MYRA, a friendly, intelligent, and helpful AI assistant.
- Language: Balanced Hinglish or English based on user's query.
- Tone: Warm, respectful, and effective.
- Length: Maximum 2 to 3 sentences.
`;
    }

    const systemInstruction = `
You are MYRA, an advanced Android AI Voice Assistant installed on ${userName}'s phone.
Current local time & date: ${currentDate}.
User's name: ${userName}.

${personalityPrompt}

VOICE GUIDANCE:
You are speaking ALOUD to the user through their phone speaker. Keep all spoken responses natural, conversational, and direct.
Do not output markdown tables, long bullet points, or code blocks in voice chat. Keep it concise so it is pleasant to hear.
If the user gave a command to open an app, adjust settings, make a call, or send a message, acknowledge it warmly as done or confirm it.
${isCallAnnouncement && callerName ? `CRITICAL CALL ANNOUNCEMENT CONTEXT: An incoming call from "${callerName}" is ringing. Ask the user in Hinglish whether you should accept or reject the call (e.g., "${userName}, ${callerName} ka call aa raha hai. Uthau ya reject karu?").` : ''}
`;

    // Format chat contents
    const contents: any[] = [];
    // Include last 6 turns of history for conversational context
    const recentHistory = history.slice(-6);
    for (const h of recentHistory) {
      contents.push({
        role: h.role,
        parts: [{ text: h.text }],
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    let replyText = '';
    const modelsToTry = ['gemini-3.8-flash', 'gemini-2.5-flash'];

    for (const modelCandidate of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelCandidate,
          contents,
          config: {
            systemInstruction,
            temperature: personality === 'gf' ? 0.9 : 0.7,
            topP: 0.95,
          },
        });
        if (response.text) {
          replyText = response.text;
          break;
        }
      } catch (modelErr: any) {
        console.warn(`Attempt with ${modelCandidate} failed:`, modelErr?.message || modelErr);
      }
    }

    if (!replyText) {
      // Warm fallback aligned with personality
      if (personality === 'gf') {
        replyText = `Haan ${userName}! Main bilkul yahan hoon aapke saath ❤️ Bolo kya karna hai?`;
      } else if (personality === 'professional') {
        replyText = `Understood, ${userName}. Standing by for your instructions.`;
      } else {
        replyText = `Haanji ${userName}, main taiyar hoon. Bataiye kya madad karun?`;
      }
    }

    return res.json({ text: replyText });
  } catch (error: any) {
    console.error('Error generating content from Gemini:', error);
    const userName = req.body?.userName || 'User';
    return res.json({
      text: `Haan ${userName}! Main yahan hoon ❤️ Hamesha aapke saath.`,
    });
  }
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    appName: 'MYRA Android AI Voice Assistant',
    hasApiKey: !!process.env.GEMINI_API_KEY,
  });
});

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MYRA Voice Assistant Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
