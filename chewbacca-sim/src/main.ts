import './style.css';
import { AudioCapture } from './audio/AudioCapture';
import { GeminiLiveClient, type ShipAction } from './ai/GeminiLiveClient';

// Wpisz tutaj swój klucz API na czas hackatonu
const API_KEY = "AIzaSyCBUx-o0IKRX16lbh34zIzYWrb09ABNep0";

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="hud">
    <h1>VOID MARAUDER</h1>
    <h2 class="subtitle">AI Voice Commander System</h2>
    
    <div class="panel">
      <div class="status-indicator">
        Status AI: <span id="ai-status" class="status-disconnected">Rozłączono</span>
      </div>
      
      <button id="start-btn" class="cyber-button">INICJALIZACJA SYSTEMÓW STATKU (START)</button>
    </div>

    <div class="logs">
      <h3>Dziennik Komend (Ostatnie intencje)</h3>
      <div id="action-log">Oczekiwanie na komendy głosowe...</div>
    </div>
  </div>
`;

const startBtn = document.querySelector<HTMLButtonElement>('#start-btn')!;
const statusSpan = document.querySelector<HTMLSpanElement>('#ai-status')!;
const actionLog = document.querySelector<HTMLDivElement>('#action-log')!;

const audioCapture = new AudioCapture();
const aiClient = new GeminiLiveClient(API_KEY);

aiClient.onStatusChange = (status) => {
  statusSpan.textContent = status;
  statusSpan.className = status === 'Połączono' ? 'status-connected' : 'status-disconnected';
  if (status === 'Połączono') {
    startBtn.textContent = 'SYSTEMY AKTYWNE (NASŁUCHUJĘ)';
    startBtn.disabled = true;
  }
};

aiClient.onActionParsed = (action: ShipAction) => {
  const time = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry highlight';
  
  const speech = action.recognized_speech ? `"${action.recognized_speech}"` : "niezrozumiały hałas";
  // Oczyszczamy obiekt z tekstu żeby pokazać tylko twarde akcje jsona
  const rawAction = { action: action.action, type: action.type };
  if (!rawAction.type) delete rawAction.type;

  let actionText = JSON.stringify(rawAction);
  if (rawAction.action === "unknown") {
    actionText = '<span style="color: #ff5555;">Brak prawidłowej akcji (zignorowano)</span>';
  }

  logEntry.innerHTML = `
    <span style="color: #aaa;">[${time}] Usłyszano:</span> <span style="font-style: italic;">${speech}</span><br/>
    <span style="color: #00ffcc;">➜ System wykonuje:</span> ${actionText}
  `;

  actionLog.prepend(logEntry);

  if (actionLog.childElementCount > 10) {
    actionLog.lastElementChild?.remove();
  }

  // W tym miejscu w przyszłości zostaną odpalone metody z fizyki statku (Antigravity engine)
  // Przykładowo: 
  // if (action.action === 'fire_weapons') ship.fire(action.type);
};

startBtn.addEventListener('click', async () => {
  startBtn.textContent = 'ŁĄCZENIE Z KOMPUTEREM POKŁADOWYM...';

  // 1. Uruchamiamy mikrofon
  await audioCapture.start();

  // 2. Kiedy mikrofon zacznie próbkować, wysyłamy chunki do Gemini
  audioCapture.onAudioData = (base64Data) => {
    aiClient.sendAudioChunk(base64Data);
  };

  // 3. Rozpoczynamy sesję WebSocketową Live API
  aiClient.connect();
});
