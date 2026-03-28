import './style.css';
import { SimEngine } from './simEngine';
import { Radar } from './radar';
import { AudioCapture } from './audio/AudioCapture';
import { GeminiLiveClient, type ShipAction } from './ai/GeminiLiveClient';

// Wpisz tutaj swój klucz API na czas hackatonu
const API_KEY = "AIzaSyCBUx-o0IKRX16lbh34zIzYWrb09ABNep0";

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
  const gameOverCauseDisplay = document.getElementById('gameOverCauseDisplay') as HTMLElement;

  // --- GAME UI ELEMENTS ---
  const header = document.getElementById('systemHeader') as HTMLElement;
  const statusIndicator = document.getElementById('systemStatus') as HTMLElement;
  const healthBarFill = document.getElementById('healthBarFill') as HTMLElement;
  const healthText = document.getElementById('healthText') as HTMLElement;
  const healthBarContainer = document.getElementById('healthBarContainer') as HTMLElement;
  const fuelBarFill = document.getElementById('fuelBarFill') as HTMLElement;
  const fuelText = document.getElementById('fuelText') as HTMLElement;
  const oxygenBarFill = document.getElementById('oxygenBarFill') as HTMLElement;
  const oxygenText = document.getElementById('oxygenText') as HTMLElement;
  const oxygenBarContainer = document.getElementById('oxygenBarContainer') as HTMLElement;
  const eventLog = document.getElementById('eventLog') as HTMLElement;

  // --- AI ASSISTANT ELEMENTS (Now in the bottom right context) ---
  const startAiBtn = document.getElementById('start-ai-btn') as HTMLButtonElement;
  const aiStatusSpan = document.getElementById('ai-status') as HTMLSpanElement;
  const aiActionLog = document.getElementById('ai-action-log') as HTMLDivElement;
  const langSelect = document.getElementById('lang-select') as HTMLSelectElement;
  const btnToggleSim = document.getElementById('btnToggleSim') as HTMLButtonElement;

  // --- STATE ---
  let engine: SimEngine | null = null;
  let hasHandledDeath = false;
  let radar: Radar | null = null;
  let radarLoopId: number | null = null;
  const radarContainer = document.getElementById('radarContainer');
  let radarCanvas: HTMLCanvasElement | null = null;
  let radarCtx: CanvasRenderingContext2D | null = null;
  
  if (radarContainer) {
    radarCanvas = document.createElement('canvas');
    radarCanvas.style.position = 'absolute';
    radarCanvas.style.top = '0';
    radarCanvas.style.left = '0';
    radarCanvas.style.width = '100%';
    radarCanvas.style.height = '100%';
    radarContainer.appendChild(radarCanvas);
    radarCtx = radarCanvas.getContext('2d');
    
    new ResizeObserver(() => {
      if (radarCanvas && radarContainer) {
        const rect = radarContainer.getBoundingClientRect();
        radarCanvas.width = rect.width;
        radarCanvas.height = rect.height;
      }
    }).observe(radarContainer);
  }
  
  let highscores: {name: string, score: number}[] = [
    { name: 'Han Solo', score: 12500 },
    { name: 'Lando', score: 8400 },
    { name: 'Luke', score: 5300 },
    { name: 'R2D2', score: 2100 },
    { name: 'Cadet', score: 500 }
  ];

  // --- AI INITIALIZATION ---
  const audioCapture = new AudioCapture();
  const aiClient = new GeminiLiveClient(API_KEY);

  langSelect.addEventListener('change', (e) => {
    const newLang = (e.target as HTMLSelectElement).value;
    aiClient.setLanguage(newLang);
    aiClient.disconnect();
    audioCapture.stop();
    startAiBtn.textContent = 'RE-INITIALIZE';
    startAiBtn.disabled = false;
    aiStatusSpan.textContent = "OFFLINE";
    aiStatusSpan.className = 'status-disconnected';
  });

  aiClient.onStatusChange = (status) => {
    aiStatusSpan.textContent = (status === 'Połączono' || status === 'Sesja gotowa') ? 'ONLINE' : status.toUpperCase();
    aiStatusSpan.className = (status === 'Połączono' || status === 'Sesja gotowa') ? 'status-connected' : 'status-disconnected';
    if (status === 'Połączono' || status === 'Sesja gotowa') {
      startAiBtn.textContent = 'COMM-LINK ACTIVE';
      startAiBtn.disabled = true;
    } else {
      startAiBtn.textContent = 'INITIALIZE COMM-LINK';
      startAiBtn.disabled = false;
    }
  };

  aiClient.onActionParsed = (action: ShipAction) => {
    const time = new Date().toLocaleTimeString();
    const speech = action.recognized_speech ? `"${action.recognized_speech}"` : "";
    
    const logEntry = document.createElement('div');
    logEntry.style.borderBottom = "1px solid rgba(0, 255, 255, 0.1)";
    logEntry.style.padding = "2px 0";
    logEntry.innerHTML = `<span style="opacity:0.5">${time}</span> ${speech} -> <b>${action.action}</b>`;
    aiActionLog.prepend(logEntry);
    if (aiActionLog.childElementCount > 4) aiActionLog.lastElementChild?.remove();

    if (engine && !engine.isDead()) {
      switch (action.action) {
        case 'fire_weapons':
          if (action.type === 'missiles') {
            radar?.fireMissiles();
            engine.addLog(`AI: MISSILE SALVO LAUNCHED!`, 'warning');
          } else {
            radar?.manualShoot();
            engine.addLog(`AI: Weapons systems engaged!`, 'info');
          }
          break;
        case 'activate_shields':
          radar?.activateShield();
          engine.addLog("AI: Shield generator pulsing!", "info");
          break;
        case 'transfer_energy':
          engine.refuel();
          engine.addLog("AI: Hyperdrive fuel replenished!", "success");
          break;
        case 'overdrive_mode':
          engine.addLog("AI: Overdrive protocol active!", "warning");
          break;
        case 'repair_ship':
          engine.repairHull();
          engine.addLog("AI: Critical hull patching initiated.", "success");
          break;
      }
    }
  };

  startAiBtn.addEventListener('click', async () => {
    startAiBtn.textContent = 'LINKING...';
    await audioCapture.start();
    audioCapture.onAudioData = (base64Data) => {
      aiClient.sendAudioChunk(base64Data);
    };
    aiClient.connect();
  });

  // --- VIEW ROUTING ---
  function hideAllViews() {
    mainMenuView.classList.add('hidden');
    highscoresView.classList.add('hidden');
    gameOverView.classList.add('hidden');
    gameDashboardView.classList.add('hidden');
    gameDashboardView.classList.remove('dashboard-grid');
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

  function showGameOver(finalScore: number, cause: string) {
    hideAllViews();
    gameOverScoreDisplay.textContent = `${finalScore}`;
    gameOverCauseDisplay.textContent = cause;
    playerNameInput.value = '';
    playerNameInput.disabled = false;
    btnSubmitScore.disabled = false;
    btnSubmitScore.textContent = 'SUBMIT REPORT';
    gameOverView.classList.remove('hidden');
  }

  function startGame() {
    hideAllViews();
    gameDashboardView.classList.remove('hidden');
    gameDashboardView.classList.add('dashboard-grid');

    eventLog.innerHTML = '';
    hasHandledDeath = false;
    
    engine = new SimEngine();
    engine.subscribe((eventType) => {
      if (!engine) return;
      switch (eventType) {
        case 'health': updateHealthUI(); break;
        case 'fuel': updateFuelUI(); break;
        case 'oxygen': updateOxygenUI(); break;
        case 'log': updateLogUI(); break;
        case 'status':
          updateStatusUI();
          if (engine.isDead()) {
             let cause = 'SYSTEM FAILURE';
             if (engine.getHealth() <= 0) cause = 'HULL INTEGRITY COMPROMISED';
             if (engine.getOxygen() <= 0) cause = 'ASPHYXIATION (O2 DEPLETED)';
             if (engine.getFuel() <= 0) cause = 'POWER FAILURE (OUT OF FUEL)';
             handleDeath(cause);
          }
          break;
      }
    });

    updateHealthUI();
    updateFuelUI();
    updateOxygenUI();
    updateStatusUI();
    engine.start();

    if (radarLoopId !== null) cancelAnimationFrame(radarLoopId);
    if (radarCanvas && radarCtx) {
      radar = new Radar(radarCanvas);
      radar.onDamage = (amount) => {
        if (engine) engine.takeDamage(amount);
      };
      
      let lastTime = performance.now();
      const gameLoop = (currentTime: number) => {
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;
        if (radar && engine) {
           radar.playerHp = engine.getHealth();
           radar.isGameOver = engine.isDead();
           if (engine.isActive() && !engine.isDead()) radar.update(deltaTime);
           if (radarCtx) radar.render(radarCtx);
        }
        radarLoopId = requestAnimationFrame(gameLoop);
      };
      radarLoopId = requestAnimationFrame(gameLoop);
    }
  }

  // --- MENU LISTENERS ---
  btnStartGame.addEventListener('click', startGame);
  btnViewHighscores.addEventListener('click', showHighscores);
  btnBackToMenu.addEventListener('click', showMenu);
  btnReturnToMenu.addEventListener('click', showMenu);

  btnSubmitScore.addEventListener('click', () => {
    if (!engine) return;
    const name = playerNameInput.value.trim().toUpperCase() || 'CADET';
    const score = radar ? Math.round(radar.distanceTraveled / 10) : engine.getScore();
    highscores.push({ name, score });
    highscores.sort((a, b) => b.score - a.score);
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
  }

  function updateOxygenUI() {
    if (!engine) return;
    const o2 = engine.getOxygen();
    oxygenBarFill.style.width = `${o2}%`;
    oxygenText.textContent = `${Math.floor(o2)}%`;
    if (o2 <= 30) oxygenBarContainer.classList.add('danger');
    else oxygenBarContainer.classList.remove('danger');
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
    eventLog.prepend(entry);
  }

  function updateStatusUI() {
     if (!engine) return;
     if (!engine.isActive() && !engine.isDead()) {
       btnToggleSim.textContent = 'RESUME';
       statusIndicator.textContent = 'SIMULATION PAUSED';
     } else if (!engine.isDead()) {
       btnToggleSim.textContent = 'PAUSE';
       checkNormalStatus();
     }
  }

  function checkNormalStatus() {
    if (engine && engine.isActive() && engine.getHealth() > 30) {
      header.classList.remove('critical-status');
      statusIndicator.textContent = 'SYSTEMS NOMINAL';
    }
  }

  function handleDeath(cause: string) {
    if (!engine || hasHandledDeath) return;
    hasHandledDeath = true;
    const finalScore = radar ? Math.round(radar.distanceTraveled / 10) : 0;
    setTimeout(() => { showGameOver(finalScore, cause); }, 2500);
  }

  btnToggleSim.addEventListener('click', () => {
    if (!engine) return;
    if (engine.isActive()) engine.pause(); else engine.start();
  });

  showMenu();
});
