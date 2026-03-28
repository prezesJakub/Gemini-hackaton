export type LogType = 'info' | 'warning' | 'success';

export interface LogEntry {
  timestamp: string;
  message: string;
  type: LogType;
}

export type EventCallback = (eventType: 'health' | 'fuel' | 'oxygen' | 'score' | 'log' | 'status') => void;

export class SimEngine {
  private health: number = 100;
  private fuel: number = 100;
  private oxygen: number = 100;
  private score: number = 0;
  private isRunning: boolean = false;
  private logs: LogEntry[] = [];

  // Frequencies
  private fuelConsumptionRate: number = 0.5; // per tick
  private oxygenConsumptionRate: number = 0.8; // per tick
  private eventChance: number = 0.05; // 5% chance per tick for random event

  private tickIntervalId: number | null = null;
  private callbacks: EventCallback[] = [];

  constructor() {
    this.addLog('Engine initialized. All systems nominal. Life support active.', 'info');
  }

  // --- GETTERS ---
  public subscribe(callback: EventCallback) {
    this.callbacks.push(callback);
  }

  private notify(eventType: 'health' | 'fuel' | 'oxygen' | 'score' | 'log' | 'status') {
    this.callbacks.forEach(cb => cb(eventType));
  }

  public getHealth(): number {
    return this.health;
  }

  public getFuel(): number {
    return this.fuel;
  }

  public getOxygen(): number {
    return this.oxygen;
  }

  public getScore(): number {
    return this.score;
  }

  public getLogs(): LogEntry[] {
    return this.logs;
  }

  public isActive(): boolean {
    return this.isRunning;
  }

  public isDead(): boolean {
    return this.health <= 0;
  }

  // --- LIFECYCLE ---
  public start() {
    if (this.isRunning && this.tickIntervalId !== null) return;
    if (this.health <= 0) return; // Cannot start dead ship
    this.isRunning = true;
    this.addLog('Simulation active.', 'info');
    this.notify('status');

    this.tickIntervalId = window.setInterval(() => this.tick(), 1000);
  }

  public pause() {
    this.isRunning = false;
    if (this.tickIntervalId !== null) {
      clearInterval(this.tickIntervalId);
      this.tickIntervalId = null;
    }
    this.addLog('Simulation paused.', 'warning');
    this.notify('status');
  }

  public stop() {
    this.pause();
  }

  // --- TICKS & STATE MNG ---
  private tick() {
    if (!this.isRunning) return;

    // Fuel consumption
    if (this.fuel > 0) {
      this.fuel = Math.max(0, this.fuel - this.fuelConsumptionRate);
      this.notify('fuel');
    }

    // Oxygen consumption
    if (this.oxygen > 0) {
      this.oxygen = Math.max(0, this.oxygen - this.oxygenConsumptionRate);
      this.notify('oxygen');
    }

    // Critical fuel check
    if (this.fuel <= 0) {
      this.addLog('CRITICAL: HYPERDRIVE FUEL DEPLETED. DRIFTING.', 'warning');
    } else if (this.fuel < 20 && Math.random() < 0.2) {
      this.addLog('WARNING: Low fuel reserves.', 'warning');
    }

    // Critical oxygen check
    if (this.oxygen <= 0) {
      this.addLog('CRITICAL: NO OXYGEN DETECTED. CREW SUFFOCATING.', 'warning');
      this.health = Math.max(0, this.health - 5); // Huge damage from lack of life support
      this.notify('health');
    } else if (this.oxygen < 30 && Math.random() < 0.2) {
      this.addLog('WARNING: Oxygen levels critically low.', 'warning');
    }

    // Dead check
    if (this.health <= 0) {
      this.health = 0;
      this.addLog('CRITICAL: HULL INTEGRITY 0%. SHIP DESTROYED/CREW DEAD.', 'warning');
      this.stop();
      this.notify('health');
      this.notify('status'); // Notify the UI that we are dead
      return;
    }

    // Scoring system (10 points every second we are alive and moving)
    if (this.fuel > 0 && this.oxygen > 0 && this.health > 0) {
      this.score += 10;
      this.notify('score');
    }

    // Random Events
    this.triggerRandomEvent();
  }

  private triggerRandomEvent() {
    if (Math.random() > this.eventChance) return; // No event

    const events = [
      {
        name: 'ASTEROID COLLISION',
        effect: () => {
          const dmg = Math.floor(Math.random() * 15) + 5;
          this.health = Math.max(0, this.health - dmg);
          this.addLog(`WARNING: Asteroid impact detected. Hull integrity reduced by ${dmg}%.`, 'warning');
          this.notify('health');
        }
      },
      {
        name: 'FUEL LEAK',
        effect: () => {
          const lost = Math.floor(Math.random() * 10) + 5;
          this.fuel = Math.max(0, this.fuel - lost);
          this.addLog(`WARNING: Fuel line breach! Lost ${lost}% fuel.`, 'warning');
          this.notify('fuel');
        }
      },
      {
        name: 'OXYGEN FILTER FAILURE',
        effect: () => {
          const lost = Math.floor(Math.random() * 15) + 10;
          this.oxygen = Math.max(0, this.oxygen - lost);
          this.addLog(`WARNING: O2 scrubber failure. Lost ${lost}% oxygen.`, 'warning');
          this.notify('oxygen');
        }
      },
      {
        name: 'SYSTEM GLITCH',
        effect: () => {
          this.addLog('NOTICE: Non-critical sensor glitch auto-resolved.', 'info');
        }
      }
    ];

    const randomEvent = events[Math.floor(Math.random() * events.length)];
    randomEvent.effect();
  }

  public addLog(message: string, type: LogType) {
    const now = new Date();
    const timestamp = `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}]`;
    this.logs.push({ timestamp, message, type });
    this.notify('log');
  }

  // --- ACTIONS ---
  public repairHull() {
    if (this.health >= 100 || !this.isRunning) return;
    this.health = Math.min(100, this.health + 25);
    this.addLog('ACTION: Emergency hull repair completed (+25%).', 'success');
    this.notify('health');
  }

  public refuel() {
    if (this.fuel >= 100 || !this.isRunning) return;
    this.fuel = Math.min(100, this.fuel + 30);
    this.addLog('ACTION: Refuelling sequence completed (+30%).', 'success');
    this.notify('fuel');
  }

  public restoreOxygen() {
    if (this.oxygen >= 100 || !this.isRunning) return;
    this.oxygen = Math.min(100, this.oxygen + 40);
    this.addLog('ACTION: Life support O2 reserves deployed (+40%).', 'success');
    this.notify('oxygen');
  }

  public takeDamage(amount: number) {
    if (this.health <= 0 || !this.isRunning) return;
    this.health = Math.max(0, this.health - amount);
    this.addLog(`WARNING: Hull damage detected! (${amount}%)`, 'warning');
    this.notify('health');

    // Dead check is also needed here immediately, in case we drop below 0 outside tick()
    if (this.health <= 0) {
      this.health = 0;
      this.addLog('CRITICAL: HULL INTEGRITY 0%. SHIP DESTROYED/CREW DEAD.', 'warning');
      this.stop();
      this.notify('health');
      this.notify('status'); // Notify the UI that we are dead
    }
  }
}
