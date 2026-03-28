import './style.css';
import { SimEngine } from './simEngine.ts';

document.addEventListener('DOMContentLoaded', () => {
  const engine = new SimEngine();
  
  // UI Elements
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
  
  // Buttons
  const btnRepairHull = document.getElementById('btnRepairHull') as HTMLButtonElement;
  const btnRefuel = document.getElementById('btnRefuel') as HTMLButtonElement;
  const btnToggleSim = document.getElementById('btnToggleSim') as HTMLButtonElement;
  const btnFixEngine = document.getElementById('btnFixEngine') as HTMLButtonElement;
  const btnRestoreOxygen = document.getElementById('btnRestoreOxygen') as HTMLButtonElement;

  // Initialize UI state
  updateHealthUI();
  updateFuelUI();
  updateOxygenUI();
  updateStatusUI();

  // Engine Event Subscription
  engine.subscribe((eventType) => {
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
        break;
    }
  });

  // Start Simulation Loop
  engine.start();

  // --- UI Modification Logic ---
  function updateHealthUI() {
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
     if (!engine.isActive()) {
       btnToggleSim.textContent = 'RESUME SIMULATION';
       statusIndicator.textContent = 'SIMULATION PAUSED';
     } else {
       btnToggleSim.textContent = 'PAUSE SIMULATION';
       checkNormalStatus();
     }
  }

  function checkNormalStatus() {
    if (engine.isActive() && engine.getHealth() > 30) {
      header.classList.remove('critical-status');
      statusIndicator.textContent = 'SYSTEMS NOMINAL';
    }
  }

  // --- Button Listeners ---
  btnRepairHull.addEventListener('click', () => {
    engine.repairHull();
  });
  
  btnRefuel.addEventListener('click', () => {
    engine.refuel();
  });

  btnRestoreOxygen.addEventListener('click', () => {
    engine.restoreOxygen();
  });

  btnToggleSim.addEventListener('click', () => {
    if (engine.isActive()) {
       engine.pause();
    } else {
       engine.start();
    }
  });

  // Enable buttons periodically randomly to simulate "repairs available"
  setInterval(() => {
    if (!engine.isActive() || engine.getHealth() <= 0) return;
    btnRepairHull.disabled = Math.random() > 0.5;
    btnRefuel.disabled = Math.random() > 0.5;
    btnRestoreOxygen.disabled = Math.random() > 0.4;
    btnFixEngine.disabled = Math.random() > 0.8;
  }, 2000);
});