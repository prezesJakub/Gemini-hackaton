import './style.css';
import { SimEngine } from './simEngine';
import { Radar } from './radar';

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
  let hasHandledDeath = false;
  
  let radar: Radar | null = null;
  let radarLoopId: number | null = null;
  
  const gameOverCauseDisplay = document.getElementById('gameOverCauseDisplay') as HTMLElement;
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
    
    // ResizeObserver automatycznie wykryje zmianę display: none -> grid
    new ResizeObserver(() => {
      if (radarCanvas && radarContainer) {
        const rect = radarContainer.getBoundingClientRect();
        radarCanvas.width = rect.width;
        radarCanvas.height = rect.height;
      }
    }).observe(radarContainer);
  }
  
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

  function showGameOver(finalScore: number, cause: string) {
    hideAllViews();
    gameOverScoreDisplay.textContent = `${finalScore}`;
    gameOverCauseDisplay.textContent = cause;
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
    hasHandledDeath = false;
    
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
        case 'log':
          updateLogUI();
          break;
        case 'status':
          updateStatusUI();
          if (engine.isDead()) {
             let cause = 'AWARIA SYSTEMÓW';
             if (engine.getHealth() <= 0) cause = 'KRYTYCZNE USZKODZENIA KADŁUBA';
             if (engine.getOxygen() <= 0) cause = 'UDUSZENIE ZAŁOGI (BRAK O2)';
             if (engine.getFuel() <= 0) cause = 'BRAK PALIWA';
             handleDeath(cause);
          }
          break;
      }
    });

    // Initialize UI
    updateHealthUI();
    updateFuelUI();
    updateOxygenUI();
    updateStatusUI();

    engine.start();

    // Reset Radar inside game loop
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
           
           if (engine.isActive() && !engine.isDead()) {
             radar.update(deltaTime);
           }
           if (radarCtx) radar.render(radarCtx);
        }
        radarLoopId = requestAnimationFrame(gameLoop);
      };
      radarLoopId = requestAnimationFrame(gameLoop);
    }

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
    const score = radar ? Math.round(radar.distanceTraveled / 10) : engine.getScore();
    
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

    eventLog.prepend(entry);
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

  function handleDeath(cause: string) {
    if (!engine || hasHandledDeath) return;
    hasHandledDeath = true;
    
    const finalScore = radar ? Math.round(radar.distanceTraveled / 10) : 0;
    
    // Wait briefly so the player sees they died, then switch view
    setTimeout(() => {
       showGameOver(finalScore, cause);
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

