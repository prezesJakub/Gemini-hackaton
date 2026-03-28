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
  private audioContext: AudioContext | null = null;
  private nextPlayTime: number = 0;

  private playAudioChunk(base64: string) {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const binaryString = atob(base64);
    const len = binaryString.length;

    const buffer = new ArrayBuffer(len);
    const view = new DataView(buffer);
    for (let i = 0; i < len; i++) {
      view.setUint8(i, binaryString.charCodeAt(i));
    }

    // Gemini Live API returns 16-bit PCM at 24000Hz via inlineData.
    const float32Array = new Float32Array(len / 2);
    for (let i = 0; i < len / 2; i++) {
      float32Array[i] = view.getInt16(i * 2, true) / 32768.0;
    }

    const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    const currentTime = this.audioContext.currentTime;
    if (this.nextPlayTime < currentTime) {
      this.nextPlayTime = currentTime;
    }

    source.start(this.nextPlayTime);
    this.nextPlayTime += audioBuffer.duration;
  }

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
    const systemPrompt = `Jesteś Pierwszym Oficerem i sztuczną inteligencją statku bojowego "Void Marauder". 
Gracz jest pilotem wydającym komendy na polu bitwy w języku polskim lub angielskim.
Masz podwójne zadanie przy każdej wypowiedzi gracza:
1. Zrozum rozkaz i natychmiast wywołaj odpowiednią komendę w kodzie używając narzędzia (funkcji) 'execute_ship_command'. 
2. Gdy funkcja się wykona, od razu ZAWSZE odpowiedz krótko GŁOSOWO w charakterze (np. "Tak jest, strzelam!", "Tarcze aktywne, kapitanie!").
3. Kiedy usłyszysz nielogiczne dziwne teksty np. "Daj mi kiełbasę", nie używaj narzędzi. Po prostu odpowiedz humorystycznie GŁOSOWO w stylu sci-fi (np. "O czym ty gadasz? Jesteśmy na statku bitwowym!").

Mapowanie komend dla wywołania funkcji:
1. Primary Weapons (strzelaj, fire, ognia, rozwal ich) -> action: "fire_weapons", type: "primary"
2. Missiles (rakiety, launch rockets, jazda z wrogami) -> action: "fire_weapons", type: "missiles"
3. Shields (tarcze, osłony, shields up, defend) -> action: "activate_shields"
4. Energy (ładuj, przelej energię, recharge) -> action: "transfer_energy", type: "thrusters"
5. Boost / Overdrive (dawaj boosta, boost, uciekamy) -> action: "overdrive_mode"
6. Repair (napraw, napraw statek, repair, fix it, łataj statek) -> action: "repair_ship"`;

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

        const functionResponses = [];

        if (calls && calls.length > 0) {
          for (const call of calls) {
            if (call.name === "execute_ship_command") {
              const args = call.args;
              if (args.action && this.onActionParsed) {
                this.onActionParsed(args as ShipAction);
              }
            }

            // Przygotowujemy toolResponse do odesłania
            functionResponses.push({
              id: call.id,
              name: call.name,
              response: {
                result: "OK",
                status: "wykonano"
              }
            });
          }

          // Odsyłamy odpowiedź do AI, żeby mogło wypowiedzieć potwierdzenie głosowe!
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const toolRespMsg = {
              toolResponse: {
                functionResponses: functionResponses
              }
            };
            this.ws.send(JSON.stringify(toolRespMsg));
            console.log("Odesłano toolResponse do AI, czekam na głos...");
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
          } else if (part.inlineData && part.inlineData.data) {
            // Play the real-time voice returned by Gemini
            this.playAudioChunk(part.inlineData.data);
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
