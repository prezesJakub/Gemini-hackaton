export interface Vector2 {
  x: number;
  y: number;
}

export interface Ship {
  id: string;
  position: Vector2;
  velocity: Vector2;
  isEnemy: boolean;
  shootCooldown?: number; // Czas do nastepnego wrogiego strzalu
}

export interface Projectile {
  id: string;
  position: Vector2;
  velocity: Vector2;
  sourceId: string;
}

export class Radar {
  playerPosition: Vector2 = { x: 1500, y: 1500 };
  private startY: number = 1500;
  
  // Prędkości lotu
  baseSpeed: number = 100;
  boostSpeed: number = 250;
  sideSpeed: number = 250; 
  
  // Celownik
  crosshairOffset: Vector2 = { x: 0, y: -250 };
  crosshairSpeed: number = 400;

  // Mechaniki Życia / Walki
  autoShootCooldown: number = 0;
  playerHp: number = 100;
  maxHp: number = 100;
  isGameOver: boolean = false;

  // Osiągnięcia
  distanceTraveled: number = 0;

  // Pula encji
  ships: Ship[] = [];
  projectiles: Projectile[] = [];

  // Sterowanie
  private keys: { [key: string]: boolean } = {};
  private canvas: HTMLCanvasElement;

  private spawnTimer: number = 0;
  private enemyCounter: number = 0;
  private projectileCounter: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupInputs();
  }

  private setupInputs() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });
  }

  public update(deltaTime: number) {
    if (this.isGameOver) return; // Zamraża ekran po padnięciu

    // 1. Ruch statku gracza (W i A/D)
    let currentForwardSpeed = this.keys['w'] ? this.boostSpeed : this.baseSpeed;
    this.playerPosition.y -= currentForwardSpeed * deltaTime;

    if (this.keys['a']) this.playerPosition.x -= this.sideSpeed * deltaTime;
    if (this.keys['d']) this.playerPosition.x += this.sideSpeed * deltaTime;

    // 1.5 Ruch celownika (Strzałki)
    if (this.keys['arrowup']) this.crosshairOffset.y -= this.crosshairSpeed * deltaTime;
    if (this.keys['arrowdown']) this.crosshairOffset.y += this.crosshairSpeed * deltaTime;
    if (this.keys['arrowleft']) this.crosshairOffset.x -= this.crosshairSpeed * deltaTime;
    if (this.keys['arrowright']) this.crosshairOffset.x += this.crosshairSpeed * deltaTime;

    // Blokada odległości promienia celownika
    const maxCrosshairDist = 600;
    const chDist = Math.hypot(this.crosshairOffset.x, this.crosshairOffset.y);
    if (chDist > maxCrosshairDist) {
      this.crosshairOffset.x = (this.crosshairOffset.x / chDist) * maxCrosshairDist;
      this.crosshairOffset.y = (this.crosshairOffset.y / chDist) * maxCrosshairDist;
    }

    this.distanceTraveled = Math.max(0, this.startY - this.playerPosition.y);

    // 2. Automatyczne Strzelanie gracza (co 2 sekundy)
    if (this.autoShootCooldown > 0) {
      this.autoShootCooldown -= deltaTime;
    }
    if (this.autoShootCooldown <= 0) {
      this.projectileCounter++;
      
      const projSpeed = 800; // Super szybkie pestki
      const mag = Math.hypot(this.crosshairOffset.x, this.crosshairOffset.y);
      let velX = 0;
      let velY = -projSpeed;
      if (mag !== 0) {
        velX = (this.crosshairOffset.x / mag) * projSpeed;
        velY = (this.crosshairOffset.y / mag) * projSpeed;
      }

      this.projectiles.push({
        id: `P-${this.projectileCounter}`,
        position: { x: this.playerPosition.x, y: this.playerPosition.y },
        velocity: { x: velX, y: velY },
        sourceId: 'player'
      });
      this.autoShootCooldown = 2.0; // Strzał znów za 2.0 sekundy
    }

    // 3. Spawnowanie wrogów (Wolniejsze spadanie z orbity)
    this.spawnTimer -= deltaTime;
    if (this.spawnTimer <= 0) {
      this.enemyCounter++;
      const spawnX = this.playerPosition.x + (Math.random() * 1200 - 600);
      const spawnY = this.playerPosition.y - 1000; 
      
      this.ships.push({
        id: `TIE-${this.enemyCounter}`,
        position: { x: spawnX, y: spawnY },
        velocity: { x: (Math.random() * 80 - 40), y: 50 }, // Prędkość zredukowana względem v1!
        isEnemy: true,
        shootCooldown: Math.random() * 2 + 1 // Strzeli po 1 do 3 sekund od znalezienia się
      });

      this.spawnTimer = 1.0 + Math.random() * 1.5;
    }

    // 4. Ruch obiektów i Autostrzał wrogów
    this.projectiles.forEach(p => {
      p.position.x += p.velocity.x * deltaTime;
      p.position.y += p.velocity.y * deltaTime;
    });

    this.ships.forEach(s => {
      s.position.x += s.velocity.x * deltaTime;
      s.position.y += s.velocity.y * deltaTime;

      if (s.isEnemy && s.position.y < this.playerPosition.y + 200 && s.position.y > this.playerPosition.y - 1200) {
        if (s.shootCooldown !== undefined) {
          s.shootCooldown -= deltaTime;
          if (s.shootCooldown <= 0) {
            this.projectileCounter++;
            this.projectiles.push({
              id: `P-E-${this.projectileCounter}`,
              position: { x: s.position.x, y: s.position.y },
              velocity: { x: 0, y: 300 }, // Strzał w stronę ujemną radaru (down)
              sourceId: s.id
            });
            s.shootCooldown = 2.0 + Math.random() * 3.0; // Nastepny wrogi ogien za jakis czas
          }
        }
      }
    });

    // 5. Rozwiązywanie Kolizji
    const pRadius = 15;
    const eRadius = 15;
    const projRadius = 8;

    // Kolizje Pancerne (Wrogowie uderzający fizycznie kadłubem w statek Gracza)
    for (let i = this.ships.length - 1; i >= 0; i--) {
      const s = this.ships[i];
      if (s.isEnemy) {
        if (Math.hypot(s.position.x - this.playerPosition.x, s.position.y - this.playerPosition.y) < pRadius + eRadius) {
          this.playerHp -= 30; // Ogromny dmg za stłuczke
          this.ships.splice(i, 1);
          continue;
        }
      }
    }

    // Kolizje Pocisków
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      let pDestroyed = false;

      if (p.sourceId === 'player') {
         // Pocisk gracza trafiający we wroga
         for (let j = this.ships.length - 1; j >= 0; j--) {
           const s = this.ships[j];
           if (s.isEnemy && Math.hypot(p.position.x - s.position.x, p.position.y - s.position.y) < projRadius + eRadius) {
             this.ships.splice(j, 1);
             this.projectiles.splice(i, 1);
             pDestroyed = true;
             this.distanceTraveled += 200; // Bonus do Scoru za morderstwo!
             break;
           }
         }
      } else {
         // Pocisk wroga trafiający w drona gracza
        if (Math.hypot(p.position.x - this.playerPosition.x, p.position.y - this.playerPosition.y) < projRadius + pRadius) {
           this.playerHp -= 20; // Dmg ze strzału
           this.projectiles.splice(i, 1);
           pDestroyed = true;
        }
      }
      
      if (pDestroyed) continue;
    }

    // System GAME OVER po upadku Zdrowia
    if (this.playerHp <= 0) {
      this.isGameOver = true;
      this.playerHp = 0;
    }

    // 6. Odśmiecanie bufora (Gargbage Collector)
    this.projectiles = this.projectiles.filter(p => p.position.y < this.playerPosition.y + 1500 && p.position.y > this.playerPosition.y - 3000);
    this.ships = this.ships.filter(s => s.position.y < this.playerPosition.y + 1500 && s.position.y > this.playerPosition.y - 3000);
  }

  public render(ctx: CanvasRenderingContext2D) {
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.fillStyle = '#0a0f18';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    const centerX = width / 2;
    const centerY = height / 2;
    ctx.translate(centerX - this.playerPosition.x, centerY - this.playerPosition.y);

    // Siatka radaru
    ctx.strokeStyle = 'rgba(34, 56, 81, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    const viewLeft = this.playerPosition.x - centerX;
    const viewRight = this.playerPosition.x + centerX;
    const viewTop = this.playerPosition.y - centerY;
    const viewBottom = this.playerPosition.y + centerY;

    const gridSize = 250;
    const startX = Math.floor(viewLeft / gridSize) * gridSize;
    const endX = Math.ceil(viewRight / gridSize) * gridSize;
    const startY = Math.floor(viewTop / gridSize) * gridSize;
    const endY = Math.ceil(viewBottom / gridSize) * gridSize;

    for (let x = startX; x <= endX; x += gridSize) {
      ctx.moveTo(x, startY); ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.moveTo(startX, y); ctx.lineTo(endX, y);
    }
    ctx.stroke();

    // Rysowanie Projektów Linii Ognia (Pociski)
    this.projectiles.forEach(p => {
      ctx.beginPath();
      ctx.moveTo(p.position.x, p.position.y);
      ctx.lineTo(p.position.x - p.velocity.x * 0.05, p.position.y - p.velocity.y * 0.05);
      
      // Jeżeli strzał wroga to czerwony. Gracza to żółty.
      ctx.strokeStyle = p.sourceId === 'player' ? '#ffb300' : '#ff3366';
      ctx.lineWidth = 3;
      ctx.stroke();
    });

    // Wrogowie
    this.ships.forEach(s => {
      if (s.isEnemy) {
        ctx.beginPath();
        ctx.arc(s.position.x, s.position.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#ff3333';
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 51, 51, 0.8)';
        ctx.font = '12px monospace';
        ctx.fillText(s.id, s.position.x + 14, s.position.y + 4);
      }
    });

    ctx.restore(); // Poza transformacją radaru - rysowanie UI gracza zawieszonego na ekranie!

    // Gracz
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - 15);
    ctx.lineTo(centerX - 12, centerY + 12);
    ctx.lineTo(centerX, centerY + 6);
    ctx.lineTo(centerX + 12, centerY + 12);
    ctx.closePath();
    ctx.fillStyle = '#00ffcc';
    ctx.fill();
    if (this.keys['w'] && !this.isGameOver) {
      ctx.beginPath();
      ctx.moveTo(centerX - 6, centerY + 8);
      ctx.lineTo(centerX, centerY + 25);
      ctx.lineTo(centerX + 6, centerY + 8);
      ctx.fillStyle = '#ff9900';
      ctx.fill();
    }

    // Celownik
    if (!this.isGameOver) {
      const cwX = centerX + this.crosshairOffset.x;
      const cwY = centerY + this.crosshairOffset.y;
      
      ctx.beginPath();
      ctx.arc(cwX, cwY, 12, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 0, 85, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(cwX - 6, cwY); ctx.lineTo(cwX + 6, cwY);
      ctx.moveTo(cwX, cwY - 6); ctx.lineTo(cwX, cwY + 6);
      ctx.stroke();
    }

    // UI Health & Info
    ctx.fillStyle = 'rgba(0, 255, 204, 0.9)';
    ctx.font = '16px monospace';
    ctx.fillText(`SCORE: ${Math.round(this.distanceTraveled / 10)}`, 20, 30);
    
    // Pasek Życia
    ctx.fillText(`HP:`, 20, 60);
    ctx.fillStyle = 'rgba(255, 50, 50, 0.5)';
    ctx.fillRect(50, 48, 200, 16);
    ctx.fillStyle = this.playerHp > 30 ? '#00ffcc' : '#ff3333';
    ctx.fillRect(50, 48, (this.playerHp / this.maxHp) * 200, 16);

    ctx.fillStyle = 'rgba(0, 255, 204, 0.8)';
    ctx.font = '12px monospace';
    ctx.fillText('Move: W/S/A/D | Aim: ARROW KEYS', 20, 90);
    ctx.fillText('AutoShoot active.', 20, 110);

    // Ekran KOŃCOWY
    if (this.isGameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#ff3333';
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', centerX, centerY - 20);
      
      ctx.fillStyle = '#fff';
      ctx.font = '24px monospace';
      ctx.fillText(`FINAL SCORE: ${Math.round(this.distanceTraveled / 10)}`, centerX, centerY + 30);
      ctx.font = '16px monospace';
      ctx.fillText('Zacznij od nowa by pobić rekord. Naciśnij CTRL+R', centerX, centerY + 60);

      ctx.textAlign = 'left'; // Reset
    }
  }
}
