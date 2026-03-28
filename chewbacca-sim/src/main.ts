import './style.css';
import { AudioCapture } from './audio/AudioCapture';
import { GeminiLiveClient, type ShipAction } from './ai/GeminiLiveClient';

import { SimEngine } from './simEngine';

document.addEventListener('DOMContentLoaded', () => {
  // --- VIEWS ---
  const mainMenuView = document.getElementById('mainMenuView') as HTMLElement;
  const highscoresView = document.getElementById('highscoresView') as HTMLElement;
  const gameOverView = document.getElementById('gameOverView') as HTMLElement;
  const gameDashboardView = document.getElementById('gameDashboardView') as HTMLElement;

  // --- MENU BUTTONS ---
  const btnStartGame = document.getElementById('btnStartGame') as HTMLButtonElement;
  const btnViewHighscores = document.getElementById('btnViewHighscores') as HTMLButtonElement;
  const btnBackToMenu = document.getElementById('btnBackToMenu') as HTMLButtonElement;
  const btnReturnToMenu = document.getElementById('btnReturnToMenu') as HTMLButtonElement;
  
  // --- GAME OVER ELEMENTS ---
  const gameOverScoreDisplay = document.getElementById('gameOverScoreDisplay') as HTMLElement;
  const playerNameInput = document.getElementById('playerNameInput') as HTMLInputElement;
  const btnSubmitScore = document.getElementById('btnSubmitScore') as HTMLButtonElement;
  const highscoresList = document.getElementById('highscoresList') as HTMLElement;

  // --- GAME UI ELEMENTS ---
  const header = document.getElementById('systemHeader') as HTMLElement;
  const statusIndicator = document.getElementById('systemStatus') as HTMLElement;
  const gameScoreDisplay = document.getElementById('gameScoreDisplay') as HTMLElement;
  
  const healthBarFill = document.getElementById('healthBarFill') as HTMLElement;
  const healthText = document.getElementById('healthText') as HTMLElement;
  const healthBarContainer = document.getElementById('healthBarContainer') as HTMLElement;
  
  const fuelBarFill = document.getElementById('fuelBarFill') as HTMLElement;
  const fuelText = document.getElementById('fuelText') as HTMLElement;
  const gasBarContainer = document.getElementById('fuelBarContainer') as HTMLElement;

  const oxygenBarFill = document.getElementById('oxygenBarFill') as HTMLElement;
  const oxygenText = document.getElementById('oxygenText') as HTMLElement;
  const oxygenBarContainer = document.getElementById('oxygenBarContainer') as HTMLElement;
  
  const eventLog = document.getElementById('eventLog') as HTMLElement;
  
  const btnRepairHull = document.getElementById('btnRepairHull') as HTMLButtonElement;
  const btnRefuel = document.getElementById('btnRefuel') as HTMLButtonElement;
  const btnToggleSim = document.getElementById('btnToggleSim') as HTMLButtonElement;
  const btnFixEngine = document.getElementById('btnFixEngine') as HTMLButtonElement;
  const btnRestoreOxygen = document.getElementById('btnRestoreOxygen') as HTMLButtonElement;

  // --- STATE ---
  let engine: SimEngine | null = null;
  let simulatedButtonInterval: number | null = null;
  
  // Simple local highscores array
  let highscores: {name: string, score: number}[] = [
    { name: 'Han Solo', score: 12500 },
    { name: 'Lando', score: 8400 },
    { name: 'Luke', score: 5300 },
    { name: 'R2D2', score: 2100 },
    { name: 'Cadet', score: 500 }
  ];

  // --- VIEW ROUTING ---
  function hideAllViews() {
    mainMenuView.classList.add('hidden');
    highscoresView.classList.add('hidden');
    gameOverView.classList.add('hidden');
    gameDashboardView.classList.add('hidden');
    gameDashboardView.classList.remove('dashboard-grid'); // remove grid structure when hidden
  }

  function showMenu() {
    hideAllViews();
    mainMenuView.classList.remove('hidden');
  }

  function showHighscores() {
    hideAllViews();
    renderHighscores();
    highscoresView.classList.remove('hidden');
  }

  function showGameOver(finalScore: number) {
    hideAllViews();
    gameOverScoreDisplay.textContent = `${finalScore}`;
    playerNameInput.value = ''; // clear previous
    playerNameInput.disabled = false;
    btnSubmitScore.disabled = false;
    btnSubmitScore.textContent = 'SUBMIT REPORT';
    gameOverView.classList.remove('hidden');
  }

  function startGame() {
    hideAllViews();
    gameDashboardView.classList.remove('hidden');
    gameDashboardView.classList.add('dashboard-grid'); // restore grid

    // Clean up old log
    eventLog.innerHTML = '';
    
    // Create new fresh engine
    engine = new SimEngine();

    // Subscribe UI
    engine.subscribe((eventType) => {
      if (!engine) return;
      switch (eventType) {
        case 'health':
          updateHealthUI();
          break;
        case 'fuel':
          updateFuelUI();
          break;
        case 'oxygen':
          updateOxygenUI();
          break;
        case 'score':
          updateScoreUI();
          break;
        case 'log':
          updateLogUI();
          break;
        case 'status':
          updateStatusUI();
          if (engine.isDead()) {
             handleDeath();
          }
          break;
      }
    });

    // Initialize UI
    updateHealthUI();
    updateFuelUI();
    updateOxygenUI();
    updateScoreUI();
    updateStatusUI();

    engine.start();

    // Setup random button availability simulator
    if (simulatedButtonInterval) clearInterval(simulatedButtonInterval);
    simulatedButtonInterval = window.setInterval(() => {
      if (!engine || !engine.isActive() || engine.isDead()) return;
      btnRepairHull.disabled = Math.random() > 0.5;
      btnRefuel.disabled = Math.random() > 0.5;
      btnRestoreOxygen.disabled = Math.random() > 0.4;
      btnFixEngine.disabled = Math.random() > 0.8;
    }, 2000);
  }

  // --- MENU LISTENERS ---
  btnStartGame.addEventListener('click', startGame);
  btnViewHighscores.addEventListener('click', showHighscores);
  btnBackToMenu.addEventListener('click', showMenu);
  btnReturnToMenu.addEventListener('click', showMenu);

  btnSubmitScore.addEventListener('click', () => {
    if (!engine) return;
    const name = playerNameInput.value.trim().toUpperCase() || 'UNKNOWN CD';
    const score = engine.getScore();
    
    // Add and sort
    highscores.push({ name, score });
    highscores.sort((a, b) => b.score - a.score);
    // Keep top 10
    highscores = highscores.slice(0, 10);
    
    btnSubmitScore.disabled = true;
    playerNameInput.disabled = true;
    btnSubmitScore.textContent = 'SAVED';
  });

  function renderHighscores() {
    highscoresList.innerHTML = '';
    highscores.forEach((entry, index) => {
       const div = document.createElement('div');
       div.className = 'score-entry';
       div.innerHTML = `<span class="rank">${index + 1}.</span> <span class="name">${entry.name}</span> <span class="score">${entry.score} pts</span>`;
       highscoresList.appendChild(div);
    });
  }

  // --- GAME UI SYNC ---
  function updateHealthUI() {
    if (!engine) return;
    const hp = engine.getHealth();
    healthBarFill.style.width = `${hp}%`;
    healthText.textContent = `${Math.floor(hp)}%`;

    if (hp <= 30) {
      healthBarContainer.classList.add('danger');
      header.classList.add('critical-status');
      statusIndicator.textContent = 'CRITICAL ALERT';
    } else {
      healthBarContainer.classList.remove('danger');
      checkNormalStatus();
    }
  }

  function updateFuelUI() {
    if (!engine) return;
    const fuel = engine.getFuel();
    fuelBarFill.style.width = `${fuel}%`;
    fuelText.textContent = `${Math.floor(fuel)}%`;
    if (fuel <= 20) {
      fuelBarFill.style.background = 'linear-gradient(90deg, #aa4400, #ffaa00)';
      gasBarContainer.style.boxShadow = '0 0 10px #ffaa00';
    } else {
      fuelBarFill.style.background = ''; 
      gasBarContainer.style.boxShadow = '';
    }
  }

  function updateScoreUI() {
    if (!engine) return;
    gameScoreDisplay.textContent = Math.floor(engine.getScore()).toString();
  }

  function updateOxygenUI() {
    if (!engine) return;
    const o2 = engine.getOxygen();
    oxygenBarFill.style.width = `${o2}%`;
    oxygenText.textContent = `${Math.floor(o2)}%`;
    
    if (o2 <= 30) {
      oxygenBarContainer.classList.add('danger');
    } else {
      oxygenBarContainer.classList.remove('danger');
    }
  }

  function updateLogUI() {
    if (!engine) return;
    const logs = engine.getLogs();
    if (logs.length === 0) return;

    const latest = logs[logs.length - 1];
    
    const entry = document.createElement('div');
    entry.className = `log-entry ${latest.type}`;
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'timestamp';
    timeSpan.textContent = latest.timestamp;

    entry.appendChild(timeSpan);
    entry.append(` ${latest.message}`);

    eventLog.appendChild(entry);
    
    // Auto scroll down
    eventLog.scrollTop = eventLog.scrollHeight;
  }

  function updateStatusUI() {
     if (!engine) return;
     if (!engine.isActive() && !engine.isDead()) {
       btnToggleSim.textContent = 'RESUME SIMULATION';
       statusIndicator.textContent = 'SIMULATION PAUSED';
     } else if (!engine.isDead()) {
       btnToggleSim.textContent = 'PAUSE SIMULATION';
       checkNormalStatus();
     }
  }

  function checkNormalStatus() {
    if (engine && engine.isActive() && engine.getHealth() > 30) {
      header.classList.remove('critical-status');
      statusIndicator.textContent = 'SYSTEMS NOMINAL';
    }
  }

  function handleDeath() {
    if (!engine) return;
    const finalScore = engine.getScore();
    
    // Wait briefly so the player sees they died, then switch view
    setTimeout(() => {
       showGameOver(finalScore);
    }, 2500);
  }

  // --- GAME BUTTON LISTENERS ---
  btnRepairHull.addEventListener('click', () => { engine?.repairHull(); });
  btnRefuel.addEventListener('click', () => { engine?.refuel(); });
  btnRestoreOxygen.addEventListener('click', () => { engine?.restoreOxygen(); });
  btnToggleSim.addEventListener('click', () => {
    if (!engine) return;
    if (engine.isActive()) { engine.pause(); } else { engine.start(); }
  });

  // Start with Menu
  showMenu();
});


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

