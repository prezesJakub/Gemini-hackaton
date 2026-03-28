export type ShipAction = {
  action: string;
  type?: string;
  recognized_speech?: string;
  [key: string]: any;
};

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private apiKey: string;

  public onActionParsed: ((action: ShipAction) => void) | null = null;
  public onStatusChange: ((status: string) => void) | null = null;

  private isSetupComplete: boolean = false;
  private responseBuffer: string = "";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  connect() {
    this.isSetupComplete = false;
    // Endpoint WebSocket BidiGenerateContent dla Gemini Live API
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log("WebSocket z Gemini połączony.");
      this.updateStatus("Połączono");
      this.sendSetupMessage();
    };

    this.ws.onmessage = async (event) => {
      let data = event.data;
      if (data instanceof Blob) {
        data = await data.text();
      }
      this.parseServerMessage(data);
    };

    this.ws.onclose = () => {
      console.log("Rozłączono z Gemini.");
      this.updateStatus("Rozłączono");
    };

    this.ws.onerror = (error) => {
      console.error("Błąd WebSocket:", error);
      this.updateStatus("Błąd połączenia");
    };
  }

  sendAudioChunk(base64Audio: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isSetupComplete) return;

    const realtimeMsg = {
      realtimeInput: {
        audio: {
          mimeType: "audio/pcm;rate=16000",
          data: base64Audio
        }
      }
    };

    this.ws.send(JSON.stringify(realtimeMsg));
  }

  private sendSetupMessage() {
    if (!this.ws) return;
    const systemPrompt = `You are the AI interface of the "Void Marauder" spaceship.
The player is a pilot issuing voice commands in the heat of battle. Commands can be in Polish OR English, often using nervous slang or fragmented sentences (e.g., "strzelaj do nich!", "fire!", "shields up", "dawaj boosta!").
Your task is to map their INTENT directly by calling the 'execute_ship_command' function. Be extremely forgiving regarding voice recognition mistakes, typos, phonetical similarities, or stuttering. If a word sounds somewhat like a command, assume it is that command. Ignore filler words and background noise.

Map speech to these exact intents for the function arguments:
1. Primary Weapons (strzelaj, fire, ognia, rozwal ich) -> action: "fire_weapons", type: "primary"
2. Missiles (rakiety, launch rockets, jazda z wrogami) -> action: "fire_weapons", type: "missiles"
3. Shields (tarcze, osłony, shields up, defend) -> action: "activate_shields"
4. Energy (ładuj, przelej energię, recharge) -> action: "transfer_energy", type: "thrusters"
5. Boost / Overdrive (dawaj boosta, boost, uciekamy) -> action: "overdrive_mode"

If the speech makes no sense at all, still call the function but pass action: "unknown".`;

    const setupMessage = {
      setup: {
        model: "models/gemini-3.1-flash-live-preview",
        generationConfig: {
          responseModalities: ["AUDIO"]
        },
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        tools: [{
          functionDeclarations: [{
            name: "execute_ship_command",
            description: "Directly executes the determined intent on the ship system based on the pilot's voice.",
            parameters: {
              type: "OBJECT",
              properties: {
                action: { type: "STRING" },
                type: { type: "STRING" },
                recognized_speech: { type: "STRING", description: "The raw transcribed sentence from the microphone" }
              },
              required: ["action", "recognized_speech"]
            }
          }]
        }]
      }
    };
    this.ws.send(JSON.stringify(setupMessage));
  }

  private parseServerMessage(jsonText: string) {
    try {
      const response = JSON.parse(jsonText);

      if (response.setupComplete) {
        console.log("Sesja Live z Gemini gotowa.");
        this.isSetupComplete = true;
        return;
      }

      // Live API Tool Calling implementation
      if (response.toolCall) {
        console.log("Serwer wykonał toolCall:", response.toolCall);
        const calls = response.toolCall.functionCalls;
        if (calls && calls.length > 0) {
          for (const call of calls) {
            if (call.name === "execute_ship_command") {
              const args = call.args;
              if (args.action && this.onActionParsed) {
                 this.onActionParsed(args as ShipAction);
              }
            }
          }
        }
        return;
      }

      if (response.serverContent?.modelTurn?.parts) {
        for (const part of response.serverContent.modelTurn.parts) {
          if (part.functionCall && part.functionCall.name === "execute_ship_command") {
            const args = part.functionCall.args;
            console.log("Wywołano Funkcję Statku (stary format):", args);
            if (args.action && this.onActionParsed) {
               this.onActionParsed(args as ShipAction);
            }
          } else if (part.text) {
             this.responseBuffer += part.text;
             console.log("Surowy tekst z AI:", part.text);
             
             try {
                const start = this.responseBuffer.indexOf('{');
                const end = this.responseBuffer.lastIndexOf('}');
                if (start !== -1 && end !== -1 && end > start) {
                    const jsonStr = this.responseBuffer.slice(start, end + 1);
                    const parsed = JSON.parse(jsonStr);
                    if (parsed.action && this.onActionParsed) {
                        this.onActionParsed(parsed as ShipAction);
                        this.responseBuffer = "";
                    }
                }
             } catch (e) {
                // Ignore partial JSON
             }
          } else if (part.inlineData) {
             // Modalities = AUDIO can return inlineData containing PCM binary.
             // We drop it since we only care about commands.
          } else {
             console.log("Inna część odpowiedzi:", part);
          }
        }
      } else if (response.serverContent?.turnComplete) {
         // Silently ignore ending turns so we don't spam the console.
      } else {
         console.log("Odebrano systemową ramkę ignorowaną/weryfikującą:", response);
      }
    } catch (e) {
      console.error("Błąd parsowania ramki Gemini:", e);
    }
  }

  private updateStatus(status: string) {
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
  }
}
