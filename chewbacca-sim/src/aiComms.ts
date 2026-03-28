import { GoogleGenerativeAI } from '@google/generative-ai';

// Replace with your real API key safely loaded from .env
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

if (!API_KEY) {
  console.error("VITE_GEMINI_API_KEY is missing! API calls will fail.");
}

const genAI = new GoogleGenerativeAI(API_KEY);

// We use the flash model because it is incredibly fast and cheap, perfect for real-time video games.
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  systemInstruction: `You are an AI intent classifier for a spaceship survival game. 
You will receive a transcript of the captain's voice command (in English). 
Your ONLY job is to classify their command into the closest matching action from this list:
- "REPAIR_HULL": Fix the ship, patch holes, fix hull integrity, repair damage.
- "REFUEL": Get more gas, refuel, start the refueller, we need fuel.
- "RESTORE_OXYGEN": Fix life support, get air, oxygen levels, breathing.
- "UNKNOWN": If the command is completely unrelated, gibberish, or you don't understand it.

Return the JSON payload with exactly one key "action" containing the matched string.`,
  generationConfig: {
    responseMimeType: "application/json",
    temperature: 0.1, // low temperature for strict classification
  }
});

/**
 * Sends the transcribed voice text to Gemini and returns the corresponding action.
 */
export async function parseVoiceCommand(transcript: string): Promise<"REPAIR_HULL" | "REFUEL" | "RESTORE_OXYGEN" | "UNKNOWN"> {
  try {
    const result = await model.generateContent(transcript);
    const text = result.response.text();
    const json = JSON.parse(text);
    return json.action || "UNKNOWN";
  } catch (err) {
    console.error("Gemini API Error:", err);
    return "UNKNOWN";
  }
}

/**
 * Uses the browser's native SpeechSynthesis API to talk back to the user
 * with a robotic/systemic AI voice.
 */
export function speakAI(text: string) {
  if (!('speechSynthesis' in window)) return;
  
  // Cancel any ongoing speech so it feels more responsive
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  
  // Tweak settings for a deep, strange "alien / wookiee" sound
  utterance.pitch = 0.1; // Extremely low pitch for deep voice
  utterance.rate = 0.7;  // Slower, heavy phrasing
  utterance.volume = 1.0;
  
  // Find an English male voice (focusing on deep/male identifiers if available)
  const voices = window.speechSynthesis.getVoices();
  const maleVoice = voices.find(v => v.lang.startsWith('en-') && 
    (v.name.includes('Male') || v.name.includes('Fred') || v.name.includes('Daniel') || v.name.includes('Alex') || v.name.includes('David')));
    
  if (maleVoice) {
    utterance.voice = maleVoice;
  }
  
  window.speechSynthesis.speak(utterance);
}
