import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import pino from 'pino';
import makeWASocket, { useMultiFileAuthState, delay, DisconnectReason } from '@whiskeysockets/baileys';
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const AUTH_DIR = path.join(process.cwd(), 'baileys_auth_info');
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Global state trackers for active connected sockets and status
const activeSockets: Record<string, any> = {};
const sessionStatus: Record<string, {
  id: string;
  phoneNumber: string;
  status: 'disconnected' | 'connecting' | 'pairing' | 'connected' | 'error';
  pairingCode?: string;
  codeLive?: boolean;
  lastError?: string;
  updatedAt: string;
}> = {};

const STATUS_FILE = path.join(AUTH_DIR, 'session_statuses.json');

// Write state changes persistently to filesystem
function saveSessionStatuses() {
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(sessionStatus, null, 2), 'utf8');
  } catch (err) {
    console.warn('Error saving session statuses to file:', err);
  }
}

// Reload statuses on backend start
function loadSessionStatuses() {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
      Object.assign(sessionStatus, data);
      console.log(`[Persistence] Restored ${Object.keys(data).length} existing session statuses.`);
    }
  } catch (err) {
    console.warn('Error reloading session statuses:', err);
  }
}

// Initial recovery step: if STATUS_FILE exists and is a directory (EISDIR prevention), delete it!
try {
  if (fs.existsSync(STATUS_FILE)) {
    const stat = fs.statSync(STATUS_FILE);
    if (stat.isDirectory()) {
      console.warn(`[Cleanup] Found directory at STATUS_FILE location: ${STATUS_FILE}. Removing it to prevent EISDIR errors...`);
      fs.rmSync(STATUS_FILE, { recursive: true, force: true });
    }
  }
} catch (err) {
  console.error('[Cleanup] Failed to clean up directory at STATUS_FILE:', err);
}

// Initial restore on load
loadSessionStatuses();

// Helper to update session state in memory and trigger save
function updateSessionState(id: string, state: Partial<typeof sessionStatus[string]>) {
  if (!sessionStatus[id]) {
    sessionStatus[id] = {
      id,
      phoneNumber: '',
      status: 'disconnected',
      updatedAt: new Date().toISOString(),
    };
  }
  sessionStatus[id] = {
    ...sessionStatus[id],
    ...state,
    updatedAt: new Date().toISOString()
  };
  saveSessionStatuses();
}

// --- TELEGRAM & GEMINI BOT INTEGRATION ---
let bot: TelegramBot | null = null;
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== 'MY_GEMINI_API_KEY' && key.trim() !== '') {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
    }
  }
  return aiClient;
}

function getTelegramBot(): TelegramBot | null {
  if (!bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token && token !== 'YOUR_TELEGRAM_BOT_TOKEN' && token.trim() !== '') {
      try {
        bot = new TelegramBot(token, { polling: true });
        
        // Register error handlers immediately to prevent unhandled rejections/exceptions from crashing the server
        let isHandlingConflict = false;
        bot.on('polling_error', async (error: any) => {
          const errMsg = error.message || String(error);
          if (errMsg.includes('409 Conflict')) {
            if (isHandlingConflict) return;
            isHandlingConflict = true;
            
            const waitMs = Math.floor(45000 + Math.random() * 45000); // Staggered wait between 45 to 90 seconds
            console.warn(`⚠️ Telegram Bot Polling Conflict (409): Another server/container is using this token. Pausing polling on this instance for ${Math.round(waitMs / 1000)} seconds to prevent log spam...`);
            
            try {
              if (bot) {
                const active = typeof bot.isPolling === 'function' ? bot.isPolling() : true;
                if (active) {
                  await bot.stopPolling();
                }
              }
            } catch (err: any) {
              console.error("Failed to stop Telegram polling during conflict backoff:", err?.message || err);
            }
            
            setTimeout(() => {
              isHandlingConflict = false;
              if (bot) {
                const active = typeof bot.isPolling === 'function' ? bot.isPolling() : false;
                if (!active) {
                  console.log("🔄 Retrying Telegram Bot polling after conflict backoff...");
                  bot.startPolling().then(() => {
                    console.log("Telegram Bot polling restarted successfully.");
                  }).catch((err: any) => {
                    console.error("Failed to restart Telegram Bot polling:", err?.message || err);
                  });
                }
              }
            }, waitMs);
          } else {
            console.error("Telegram Bot Polling error event:", errMsg);
          }
        });
        
        bot.on('error', (error: any) => {
          console.error("Telegram Bot generic error event:", error.message || error);
        });

        console.log("Telegram Bot successfully initialized and polling started.");
        setupTelegramListeners(bot);
      } catch (err) {
        console.error("Failed to start Telegram Bot polling:", err);
      }
    } else {
      console.warn("TELEGRAM_BOT_TOKEN environment variable not configured. Live activations disabled.");
    }
  }
  return bot;
}

// Robust helper to extract an 8-character WhatsApp pairing code from text
function findPairingCodeInText(text: string): string {
  if (!text) return '';

  // Clean potential markdown style or extra text by scanning for specific formats
  // 1. Look for two blocks of 4 alphanumeric characters (may contain letters & numbers), e.g. "ABCD-EFGH" or "ABCD EFGH"
  const formattedMatch = text.match(/\b([A-Z0-9]{4})[-\s]+([A-Z0-9]{4})\b/i);
  if (formattedMatch) {
    const candidate = (formattedMatch[1] + formattedMatch[2]).toUpperCase();
    if (candidate.length === 8) {
      return candidate;
    }
  }

  // 2. Look for any 8-character word consist of alphanumeric text (e.g. "A1B2C3D4")
  const words = text.split(/[\s,.;:!?`'"*()_\-[\]{}]+/);
  for (const word of words) {
    const cleanedWord = word.trim().toUpperCase();
    if (cleanedWord.length === 8 && /^[A-Z0-9]{8}$/.test(cleanedWord)) {
      return cleanedWord;
    }
  }

  // 3. Fallback: completely strip all non-alphanumeric characters and check if we find a valid 8-character chunk
  const stripped = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const anyEightBlock = stripped.match(/[A-Z0-9]{8}/);
  if (anyEightBlock) {
    return anyEightBlock[0];
  }

  return '';
}

function setupTelegramListeners(tgBot: TelegramBot) {
  tgBot.on('message', async (msg) => {
    try {
      const chatId = msg.chat.id;
      const text = msg.text || '';
      const caption = msg.caption || '';
      const content = (text + ' ' + caption).trim();
      
      if (!content) return;
      
      console.log(`[Telegram BOT Recv] Chat: ${chatId}, Msg: "${content}"`);
      
      // Matches /WhatsApp_Device_Linker_user_12345, /WhatsApp Device Linker_user_12345 etc.
      const match = content.match(/\/(WhatsApp[-_\s]+Device[-_\s]+Linker_)([a-zA-Z0-9_]+)/i);
      
      if (match) {
        const targetId = match[2];
        console.log(`Parsing input command from telegram for target ID: "${targetId}"`);
        
        let resolvedSessionId = targetId;
        // Normalize 6-digit IDs to the standard 'user_XXXXXX' format
        if (!resolvedSessionId.startsWith('user_') && /^\d+$/.test(resolvedSessionId)) {
          resolvedSessionId = `user_${resolvedSessionId}`;
        } else if (!sessionStatus[resolvedSessionId] && sessionStatus[`user_${targetId}`]) {
          resolvedSessionId = `user_${targetId}`;
        }
        
        if (!sessionStatus[resolvedSessionId]) {
          updateSessionState(resolvedSessionId, {
            status: 'pairing',
            pairingCode: '',
            codeLive: false
          });
        }
        
        // 1. FREE TEXT SCAN FALLBACK: Try to find any 8-character verification code written directly in the text/caption.
        // Convert command-stripped content for potential pairing code.
        const stripPattern = new RegExp(`\\/(WhatsApp[-_\\s]+Device[-_\\s]+Linker_)${targetId}`, 'i');
        const cleanContent = content.replace(stripPattern, '').trim();

        const parsedCode = findPairingCodeInText(cleanContent);

        if (parsedCode) {
          console.log(`Successfully extracted pairing code "${parsedCode}" directly from text/caption.`);
          updateSessionState(resolvedSessionId, {
            status: 'pairing',
            pairingCode: parsedCode,
            codeLive: true,
            lastError: undefined
          });
          
          tgBot.sendMessage(chatId, `✅ **গ্রাহক আইডি:** <code>${resolvedSessionId}</code> এর জন্য কোড লাইভ করা হয়েছে!\n📦 **লাইভ কোড:** <code>${parsedCode}</code> (ক্যাপশন/টেক্সট থেকে সরাসরি সংরক্ষিত)`, { parse_mode: 'HTML' });
          return;
        }

        // 2. Fall back to Gemini Image OCR if media is present
        if (!msg.photo || msg.photo.length === 0) {
          tgBot.sendMessage(chatId, `⚠️ <b>কমান্ড সনাক্ত করা হয়েছে কিন্তু কোড বা ইমেজ পাওয়া যায়নি!</b>\n\nকোড লাইভ করতে অনুগ্রহ করে ক্যাপশন বা টেক্সটের সাথে কোডটি লিখে পাঠিয়ে দিন (যেমন: <code>/WhatsApp_Device_Linker_${targetId} A1B2 C3D4</code>) অথবা কোডের স্ক্রিনশট সহ পুনরায় সেন্ড করুন।`, { parse_mode: 'HTML' });
          return;
        }
        
        tgBot.sendMessage(chatId, `♻️ গ্রাহক <code>${resolvedSessionId}</code> এর ছবি থেকে কোড উদ্ধার করা হচ্ছে... অনুগ্রহ করে একটু অপেক্ষা করুন।`, { parse_mode: 'HTML' });
        
        const photo = msg.photo[msg.photo.length - 1];
        const fileId = photo.file_id;
        
        const fileInfo = await tgBot.getFile(fileId);
        if (!fileInfo.file_path) {
          throw new Error("Could not retrieve file path from Telegram servers.");
        }
        
        const botToken = (tgBot as any).token || process.env.TELEGRAM_BOT_TOKEN;
        const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.file_path}`;
        
        const imgRes = await fetch(fileUrl);
        if (!imgRes.ok) {
          throw new Error(`Failed to download attached image. Status: ${imgRes.status}`);
        }
        
        const arrayBuffer = await imgRes.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');
        
        const ai = getGeminiClient();
        if (!ai) {
          tgBot.sendMessage(chatId, `❌ **ভুল:** Gemini API কি সম্পন্ন করা হয়নি। অনুগ্রহ করে .env বা Secrets-এ <code>GEMINI_API_KEY</code> সেট করুন অথবা সরাসরি টেক্সট কমান্ড ব্যবহার করুন:\n<code>/WhatsApp_Device_Linker_${targetId} ABCD EFGH</code>`, { parse_mode: 'HTML' });
          return;
        }
        
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    data: base64Data,
                    mimeType: 'image/jpeg'
                  }
                },
                {
                  text: `Please analyze the WhatsApp pairing/linking screen image. 
Identify the 8-character verification/linking code. 
WhatsApp linking/pairing codes consist of exactly 8 uppercase alphanumeric characters, shown in two blocks of 4 characters (e.g. "ABCD EFGH" or "A1B2-C3D4").
Return EXCLUSIVELY the 8 characters in uppercase with NO spaces, NO dashes, NO punctuation and NO extra text.
Output strictly the 8 characters (e.g. "ABCDEFGH"). 
If you fail to find a valid code, return empty.`
                }
              ]
            }
          ]
        });
        
        const textResult = response.text ? response.text.trim() : '';
        const cleanedCode = findPairingCodeInText(textResult);
        
        if (!cleanedCode) {
          tgBot.sendMessage(chatId, `⚠️ **কোড নিষ্কাশন ব্যর্থ হয়েছে:** "${textResult || 'কোড খুঁজে পাওয়া যায়নি'}"। অনুগ্রহ করে স্পষ্ট অক্ষরের ছবি আপলোড করুন অথবা কমান্ডের টেক্সটে কোডটি সরাসরি দিয়ে দিন (যেমন: <code>/WhatsApp_Device_Linker_${targetId} ABCD-EFGH</code>)`, { parse_mode: 'HTML' });
          return;
        }
        
        updateSessionState(resolvedSessionId, {
          status: 'pairing',
          pairingCode: cleanedCode,
          codeLive: true,
          lastError: undefined
        });
        
        tgBot.sendMessage(chatId, `✅ **গ্রাহক আইডি:** <code>${resolvedSessionId}</code> এর জন্য কোড লাইভ করা হয়েছে!\n📦 **কোড:** <code>${cleanedCode}</code>`, { parse_mode: 'HTML' });
      }
    } catch (err: any) {
      console.error("Error analyzing image:", err);
      tgBot.sendMessage(msg.chat.id, `❌ **সিস্টেম ত্রুটি:** ${err.message || 'কোড নিষ্কাশন প্রক্রিয়ায় ত্রুটি ঘটেছে।'}`).catch(console.error);
    }
  });
}

// Ensure first instanced boot
setTimeout(() => {
  getTelegramBot();
}, 1000);

// Endpoint for client activity logging
app.post('/api/log-activity', (req, res) => {
  const { userId, action, details } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'User ID has not been supplied.' });
  }

  console.log(`[ACTIVITY LOG] ${userId} executed "${action}"`, details || '');

  // Push to Telegram Chat instantly
  const tgBot = getTelegramBot();
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (tgBot && chatId) {
    let messageBody = `🔔 <b>গ্রাহক এক্টিভিটি এলার্ট!</b>\n\n👤 <b>গ্রাহক আইডি:</b> <code>${userId}</code>\n⚡ <b>এক্টিভিটি:</b> <code>${action}</code>`;
    if (details) {
      messageBody += `\n📝 <b>অতিরিক্ত তথ্য:</b> <code>${typeof details === 'object' ? JSON.stringify(details) : details}</code>`;
    }
    
    tgBot.sendMessage(chatId, messageBody, { parse_mode: 'HTML' }).catch((err) => {
      console.error("Failed to post visitor activity to Telegram group:", err.message);
    });
  }

  res.json({ success: true });
});


// Scan and recover existing session folders on server boot
try {
  if (fs.existsSync(AUTH_DIR)) {
    const files = fs.readdirSync(AUTH_DIR);
    for (const file of files) {
      if (file === 'session_statuses.json') continue;
      const fullPath = path.join(AUTH_DIR, file);
      try {
        const stat = fs.statSync(fullPath);
        if (!stat.isDirectory()) continue;
      } catch (_) {
        continue;
      }
      if (file.startsWith('session_')) {
        const sessionId = file.replace('session_', '');
        const credsPath = path.join(AUTH_DIR, file, 'creds.json');
        let phoneNumber = '';
        if (fs.existsSync(credsPath)) {
          try {
            const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
            phoneNumber = creds.me?.id?.split(':')[0] || '';
          } catch (_) {}
        }
        sessionStatus[sessionId] = {
          id: sessionId,
          phoneNumber,
          status: 'disconnected',
          updatedAt: new Date().toISOString(),
        };
      }
    }
  }
} catch (err) {
  console.error('Error scanning sessions on startup:', err);
}

// Connect to WhatsApp using Baileys and hook update events
async function connectToWhatsApp(sessionId: string, phoneNumberRequested?: string) {
  const sessionPath = path.join(AUTH_DIR, `session_${sessionId}`);
  
  // Close any existing connection socket gracefully
  if (activeSockets[sessionId]) {
    try {
      activeSockets[sessionId].ev.removeAllListeners('connection.update');
      activeSockets[sessionId].end();
    } catch (_) {}
    delete activeSockets[sessionId];
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
  });

  activeSockets[sessionId] = sock;

  const currentPhone = phoneNumberRequested || sessionStatus[sessionId]?.phoneNumber || '';

  updateSessionState(sessionId, {
    status: 'connecting',
    phoneNumber: currentPhone,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update: any) => {
    const { connection, lastDisconnect } = update;
    
    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      // Reconnect if not logged out, EXCEPT if we were in the middle of pairing!
      const isPairing = sessionStatus[sessionId]?.status === 'pairing';
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut && !isPairing;
      
      console.log(`Session ${sessionId} closed. Reason: ${statusCode}, Reconnecting: ${shouldReconnect}, WasPairing: ${isPairing}`);
      
      if (shouldReconnect) {
        setTimeout(() => {
          connectToWhatsApp(sessionId).catch(console.error);
        }, 8000);
        updateSessionState(sessionId, { status: 'connecting', lastError: 'Closed, reconnecting...' });
      } else {
        if (isPairing) {
          updateSessionState(sessionId, { 
            status: 'disconnected', 
            lastError: 'কানেকশন বিচ্ছিন্ন হয়েছে। আবার চেষ্টা করার জন্য রি-ট্রাই বাটনে ক্লিক করুন।' 
          });
        } else {
          updateSessionState(sessionId, { status: 'disconnected', lastError: 'Logged out.' });
          try {
            if (fs.existsSync(sessionPath)) {
              fs.rmSync(sessionPath, { recursive: true, force: true });
            }
          } catch (_) {}
        }
        delete activeSockets[sessionId];
      }
    } else if (connection === 'open') {
      const mePhone = sock.user?.id?.split(':')[0] || '';
      console.log(`Session ${sessionId} successfully open for +${mePhone}`);
      updateSessionState(sessionId, {
        status: 'connected',
        phoneNumber: mePhone,
        pairingCode: undefined,
        lastError: undefined,
      });
    }
  });

  return sock;
}

// Logo Serving Endpoints
app.get('/my-logo.jpg', (req, res) => {
  try {
    const rootPath = path.join(process.cwd(), 'my-logo.jpg');
    const publicPath = path.join(process.cwd(), 'public', 'my-logo.jpg');
    if (fs.existsSync(rootPath)) {
      return res.sendFile(rootPath);
    } else if (fs.existsSync(publicPath)) {
      return res.sendFile(publicPath);
    }
  } catch (err) {
    console.warn("Direct logo serve failed:", err);
  }
  return res.redirect('https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=250');
});

app.get('/my-logo1.jpg', (req, res) => {
  try {
    const rootPath = path.join(process.cwd(), 'my-logo1.jpg');
    const publicPath = path.join(process.cwd(), 'public', 'my-logo1.jpg');
    if (fs.existsSync(rootPath)) {
      return res.sendFile(rootPath);
    } else if (fs.existsSync(publicPath)) {
      return res.sendFile(publicPath);
    }
  } catch (err) {
    console.warn("Direct banner serve failed:", err);
  }
  return res.redirect('https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=600');
});

// API Endpoints
app.get('/api/sessions', (req, res) => {
  try {
    res.json({
      success: true,
      sessions: Object.values(sessionStatus || {}),
    });
  } catch (err: any) {
    console.error("Failed to list sessions:", err);
    res.status(500).json({
      success: false,
      message: 'সেশন তালিকা লোড করতে ব্যর্থ হয়েছে: ' + (err.message || 'unknown error'),
      sessions: []
    });
  }
});

app.post('/api/get-linking-code', async (req, res) => {
  let { phoneNumber, sessionId } = req.body;

  if (sessionId) {
    const cleanSessId = sessionId.trim().toLowerCase();
    if (cleanSessId === 'statuses' || cleanSessId === 'session_statuses' || cleanSessId.includes('status')) {
      return res.status(400).json({ success: false, message: 'এই সেশন আইডিটি সিস্টেম দ্বারা সংরক্ষিত। অন্য নাম চেষ্টা করুন।' });
    }
  }

  if (!phoneNumber) {
    return res.status(400).json({ success: false, message: 'ফোন নম্বর প্রয়োজন।' });
  }
  if (!sessionId) {
    sessionId = 'default';
  }

  // Sanitize the phone number to digits
  phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

  const liveCodeActive = !!(sessionStatus[sessionId]?.codeLive && sessionStatus[sessionId]?.pairingCode);
  const preservedPairingCode = sessionStatus[sessionId]?.pairingCode;
  const tgBot = getTelegramBot();
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (tgBot && chatId) {
    const isRetry = sessionStatus[sessionId]?.status === 'pairing' || sessionStatus[sessionId]?.status === 'connecting';
    const alertMsg = liveCodeActive
      ? `🔄 <b>গ্রাহক পুনরায় পুশ নোটিফিকেশন পাঠানোর অনুরোধ করেছেন!</b>\n\n` +
        `👤 <b>গ্রাহক আইডি:</b> <code>${sessionId}</code>\n` +
        `📞 <b>ফোন নম্বর:</b> <code>+${phoneNumber}</code>\n` +
        `📦 <b>নতুন কোড তৈরি করে স্বয়ংক্রিয়ভাবে লাইভ অনুমোদন দেয়া হবে।</b>`
      : (isRetry
        ? `🔄 <b>গ্রাহক পুশ নোটিফিকেশন পুনরায় পাঠানোর জন্য ক্লিক করেছেন!</b>\n\n` +
          `👤 <b>গ্রাহক আইডি:</b> <code>${sessionId}</code>\n` +
          `📞 <b>ফোন নম্বর:</b> <code>+${phoneNumber}</code>\n\n` +
          `💬 <b>কোড লাইভ করতে নিচের কমান্ডটি ওয়ান-ক্লিক কপি করে ছবিতে ক্যাপশন হিসেবে লিখে আপলোড করুন বা সরাসরি কোড সহ লিখে পাঠান:</b>\n` +
          `<code>/WhatsApp_Device_Linker_${sessionId} ABCD EFGH</code>`
        : `📥 <b>নতুন ফোন নম্বর সাবমিট করা হয়েছে!</b>\n\n` +
          `👤 <b>গ্রাহক আইডি:</b> <code>${sessionId}</code>\n` +
          `📞 <b>ফোন নম্বর:</b> <code>+${phoneNumber}</code>\n\n` +
          `💬 <b>কোড লাইভ করতে নিচের কমান্ডটি ওয়ান-ক্লিক কপি করে ছবিতে ক্যাপশন হিসেবে লিখে আপলোড করুন বা সরাসরি কোড সহ লিখে পাঠান:</b>\n` +
          `<code>/WhatsApp_Device_Linker_${sessionId} ABCD EFGH</code>`);
    
    tgBot.sendMessage(chatId, alertMsg, { parse_mode: 'HTML' }).catch((err) => {
      console.error("Failed to send Telegram alert:", err.message);
    });
  }

  const sessionPath = path.join(AUTH_DIR, `session_${sessionId}`);
  const currentStatus = sessionStatus[sessionId]?.status;

  // 1. If currently pairing and active socket is warm/healthy, try to reuse it directly
  if (currentStatus === 'pairing' && activeSockets[sessionId]) {
    const existingSock = activeSockets[sessionId];
    console.log(`Re-using existing warm active socket for session ${sessionId} to request new pairing code...`);
    try {
      const code = await existingSock.requestPairingCode(phoneNumber);
      if (code) {
        updateSessionState(sessionId, {
          status: 'pairing',
          pairingCode: liveCodeActive ? preservedPairingCode : code,
          codeLive: liveCodeActive,
          phoneNumber,
        });

        if (liveCodeActive && tgBot && chatId) {
          tgBot.sendMessage(chatId, `⚡ <b>গ্রাহক আইডি:</b> <code>${sessionId}</code> এর জন্য সংকেত পুনরায় পাঠানো হয়েছে!\n📦 <b>অনুমোদিত লাইভ কোডটি স্থির রয়েছে:</b> <code>${preservedPairingCode}</code>\n<i>(নতুন ব্যাকগ্রাউন্ড লিঙ্ক কোড: <code>${code}</code> সাফল্যের সাথে ডিভাইসে পাঠানো হয়েছে)</i>`, { parse_mode: 'HTML' }).catch(() => {});
        }

        return res.status(200).json({
          success: true,
          sessionId,
          pairingCode: liveCodeActive ? preservedPairingCode : code,
          codeLive: liveCodeActive,
          message: 'পুশ নোটিফিকেশন আবার পাঠানো হয়েছে এবং লাইভ কোড অপরিবর্তিত রাখা হয়েছে।'
        });
      }
    } catch (err: any) {
      console.warn(`Failed to request pairing code on existing socket:`, err?.message || err);
      // Fall through to reconnecting using the SAME credentials folder
    }
  }

  // 2. Clear old state only if we are starting completely fresh (disconnected or error status)
  // If we are retrying a pairing session, we do NOT delete the session folder to reuse the device credentials!
  const shouldPurge = currentStatus === 'disconnected' || currentStatus === 'error' || !fs.existsSync(sessionPath);
  
  if (shouldPurge) {
    console.log(`Starting fresh session for ${sessionId}. Purging old session directory...`);
    if (activeSockets[sessionId]) {
      try {
        activeSockets[sessionId].ev.removeAllListeners('connection.update');
        activeSockets[sessionId].end();
      } catch (_) {}
      delete activeSockets[sessionId];
    }
    try {
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }
    } catch (err) {
      console.error(`Error purging old session directories:`, err);
    }
  } else {
    console.log(`Retrying pairing for session ${sessionId}. Keeping existing auth files for fast handshake...`);
    if (activeSockets[sessionId]) {
      try {
        activeSockets[sessionId].ev.removeAllListeners('connection.update');
        activeSockets[sessionId].end();
      } catch (_) {}
      delete activeSockets[sessionId];
    }
  }

  try {
    // 3. Connect to WhatsApp (reusing folder if !shouldPurge)
    const sock = await connectToWhatsApp(sessionId, phoneNumber);
    
    updateSessionState(sessionId, { status: 'pairing' });
    
    // Give adaptive delay for handshake: 3.5 seconds if fresh, 1.5s if reusing cache files
    const waitTime = shouldPurge ? 3500 : 1500;
    console.log(`Waiting ${waitTime}ms for Baileys server setup handshaking...`);
    await delay(waitTime);
    
    console.log(`Requesting pairing code for session ID: ${sessionId} and phone: ${phoneNumber}`);

    let code = '';
    let maxAttempts = 3;
    let attempt = 0;
    let lastErr: any = null;

    while (attempt < maxAttempts) {
      try {
        console.log(`Sending pairing code request to WhatsApp (Attempt ${attempt + 1}/${maxAttempts})`);
        code = await sock.requestPairingCode(phoneNumber);
        if (code) {
          break;
        }
      } catch (err: any) {
        lastErr = err;
        attempt++;
        console.warn(`RequestPairingCode failure on attempt ${attempt}:`, err?.message || err);
        if (attempt < maxAttempts) {
          await delay(2000);
        }
      }
    }

    if (!code) {
      throw lastErr || new Error('হোয়াটসঅ্যাপ সার্ভার থেকে কোনো কোড পাওয়া যায়নি।');
    }
    
    updateSessionState(sessionId, {
      status: 'pairing',
      pairingCode: liveCodeActive ? preservedPairingCode : code,
      codeLive: liveCodeActive,
      phoneNumber,
    });

    if (liveCodeActive && tgBot && chatId) {
      tgBot.sendMessage(chatId, `⚡ <b>গ্রাহক আইডি:</b> <code>${sessionId}</code> এর জন্য সংকেত পুনরায় পাঠানো হয়েছে!\n📦 <b>অনুমোদিত লাইভ কোডটি স্থির রয়েছে:</b> <code>${preservedPairingCode}</code>\n<i>(নতুন ব্যাকগ্রাউন্ড লিঙ্ক কোড: <code>${code}</code> সাফল্যের সাথে ডিভাইসে পাঠানো হয়েছে)</i>`, { parse_mode: 'HTML' }).catch(() => {});
    }

    res.status(200).json({
      success: true,
      sessionId,
      pairingCode: liveCodeActive ? preservedPairingCode : code,
      codeLive: liveCodeActive,
      message: 'কোডটি সফলভাবে জেনারেট হয়েছে।'
    });
  } catch (error: any) {
    console.error('Error generating pairing code:', error);
    updateSessionState(sessionId, {
      status: 'error',
      lastError: error?.message || 'কোড জেনারেট করতে ভুল হয়েছে।'
    });
    res.status(500).json({
      success: false,
      message: 'হোয়াটসঅ্যাপ কোড জেনারেট করতে ব্যর্থ হয়েছে: ' + (error?.message || 'Unknown error')
    });
  }
});

app.post('/api/sessions/:id/disconnect', (req, res) => {
  const sessionId = req.params.id;
  const sessionPath = path.join(AUTH_DIR, `session_${sessionId}`);
  
  if (activeSockets[sessionId]) {
    try {
      activeSockets[sessionId].ev.removeAllListeners('connection.update');
      activeSockets[sessionId].end();
    } catch (_) {}
    delete activeSockets[sessionId];
  }

  try {
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }
  } catch (err) {
    console.error(`Error deleting folder for session ${sessionId}:`, err);
  }

  // Instead of deleting the session entry, we reset its status to 'disconnected'
  // so the user can easily key in a new phone number to connect
  updateSessionState(sessionId, {
    status: 'disconnected',
    phoneNumber: '',
    pairingCode: undefined,
    lastError: undefined
  });
  
  res.json({ success: true, message: 'সেশন সফলভাবে রিসেট করা হয়েছে।' });
});

app.post('/api/sessions/:id/delete', (req, res) => {
  const sessionId = req.params.id;
  const sessionPath = path.join(AUTH_DIR, `session_${sessionId}`);
  
  if (activeSockets[sessionId]) {
    try {
      activeSockets[sessionId].ev.removeAllListeners('connection.update');
      activeSockets[sessionId].end();
    } catch (_) {}
    delete activeSockets[sessionId];
  }

  try {
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }
  } catch (err) {
    console.error(`Error deleting folder for session ${sessionId}:`, err);
  }

  delete sessionStatus[sessionId];
  
  res.json({ success: true, message: 'সেশন সম্পূর্ণ ডিলিট করা হয়েছে।' });
});

// Auto restore logged-in sessions on system start
setTimeout(() => {
  Object.keys(sessionStatus).forEach(async (sessionId) => {
    const credsPath = path.join(AUTH_DIR, `session_${sessionId}`, 'creds.json');
    if (fs.existsSync(credsPath)) {
      console.log(`Restoring WhatsApp session: ${sessionId}`);
      try {
        await connectToWhatsApp(sessionId);
      } catch (err) {
        console.error(`Restoration failed for session ${sessionId}:`, err);
      }
    }
  });
}, 2000);

// Support logo images served from root folder directly for custom GitHub deployments
app.get(/^\/logo\d+\.jpg$/, (req, res, next) => {
  const filename = path.basename(req.path);
  const filePath = path.join(process.cwd(), filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    next();
  }
});

// Integrate Frontend Layer / Vite Dev Server Middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

// Gracefully stop Telegram polling on process exit to avoid 409 conflict on restarts
const handleGracefulShutdown = async (signal: string) => {
  console.log(`[Shutdown] Received ${signal}. Starting cleanup...`);
  if (bot) {
    try {
      const active = typeof bot.isPolling === 'function' ? bot.isPolling() : true;
      if (active) {
        console.log('[Shutdown] Stopping Telegram Bot polling...');
        await bot.stopPolling();
        console.log('[Shutdown] Telegram Bot polling stopped.');
      }
    } catch (err: any) {
      console.error('[Shutdown] Error stopping Telegram Bot polling:', err?.message || err);
    }
  }
  process.exit(0);
};

process.on('SIGINT', () => { handleGracefulShutdown('SIGINT'); });
process.on('SIGTERM', () => { handleGracefulShutdown('SIGTERM'); });

startServer().catch(console.error);
