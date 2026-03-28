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

export interface Explosion {
  position: Vector2;
  life: number;
  maxLife: number;
  radius: number;
}

export class Radar {
  playerPosition: Vector2 = { x: 1500, y: 1500 };
  private startY: number = 1500;
  
  // Prędkości lotu
  baseSpeed: number = 100;
  boostSpeed: number = 250;
  slowSpeed: number = 40; // Prędkość ze wciśniętym S
  sideSpeed: number = 250; 
  
  // Celownik
  crosshairOffset: Vector2 = { x: 0, y: -250 };
  crosshairSpeed: number = 400;

  // Mechaniki Życia / Walki
  autoShootCooldown: number = 0;
  playerHp: number = 100;
  maxHp: number = 100;
  isGameOver: boolean = false;
  onDamage?: (amount: number) => void;

  // Osiągnięcia
  distanceTraveled: number = 0;
  kills: number = 0;

  // Pula encji
  ships: Ship[] = [];
  projectiles: Projectile[] = [];
  explosions: Explosion[] = [];

  // Sterowanie
  private keys: { [key: string]: boolean } = {};
  private canvas: HTMLCanvasElement;

  private spawnTimer: number = 0;
  private spawnAllyTimer: number = 5.0; // Piewszy za 5s
  private enemyCounter: number = 0;
  private allyCounter: number = 0;
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

    // 1. Ruch statku gracza (W i S, A/D)
    let currentForwardSpeed = this.baseSpeed;
    if (this.keys['w']) currentForwardSpeed = this.boostSpeed;
    if (this.keys['s']) currentForwardSpeed = this.slowSpeed;

    this.playerPosition.y -= currentForwardSpeed * deltaTime;

    if (this.keys['a']) this.playerPosition.x -= this.sideSpeed * deltaTime;
    if (this.keys['d']) this.playerPosition.x += this.sideSpeed * deltaTime;

    // 1.5 Ruch celownika (Strzałki)
    if (this.keys['arrowup']) this.crosshairOffset.y -= this.crosshairSpeed * deltaTime;
    if (this.keys['arrowdown']) this.crosshairOffset.y += this.crosshairSpeed * deltaTime;
    if (this.keys['arrowleft']) this.crosshairOffset.x -= this.crosshairSpeed * deltaTime;
    if (this.keys['arrowright']) this.crosshairOffset.x += this.crosshairSpeed * deltaTime;

    // Blokada odległości promienia celownika na krawędziach ekranu
    const padding = 20; // margines, aby celownik nie przykleił się całkiem do rogu
    const maxOffsetX = (this.canvas.width / 2) - padding;
    const maxOffsetY = (this.canvas.height / 2) - padding;

    this.crosshairOffset.x = Math.max(-maxOffsetX, Math.min(maxOffsetX, this.crosshairOffset.x));
    this.crosshairOffset.y = Math.max(-maxOffsetY, Math.min(maxOffsetY, this.crosshairOffset.y));

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

    // 3. Spawnowanie wrogów (Wolniejsze spadanie z orbity + Dynamic Trudność)
    this.spawnTimer -= deltaTime;
    if (this.spawnTimer <= 0) {
      this.enemyCounter++;
      const spawnX = this.playerPosition.x + (Math.random() * 1200 - 600);
      const spawnY = this.playerPosition.y - 1000; 
      
      // Losowa strona (kąt w radianach 0 do 360 stopni)
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 100; // Prędkość 50-150

      this.ships.push({
        id: `TIE-${this.enemyCounter}`,
        position: { x: spawnX, y: spawnY },
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        isEnemy: true,
        shootCooldown: Math.random() * 2 + 1 
      });

      // System trudności
      const difficultyMultiplier = Math.max(0.2, 1.0 - (this.distanceTraveled / 40000));
      this.spawnTimer = (1.0 + Math.random() * 1.5) * difficultyMultiplier;
    }

    // 3.5 Spawnowanie Sojuszników
    this.spawnAllyTimer -= deltaTime;
    if (this.spawnAllyTimer <= 0) {
      this.allyCounter++;
      const spawnX = this.playerPosition.x + (Math.random() * 800 - 400);
      const spawnY = this.playerPosition.y + 500; // Z tyłu gracza (zaraz za krawędzią radaru)
      
      // Sojusznicy lecą zdecydowanie do przodu (z małym kątem odchylenia), żeby wyprzedzić gracza
      const allyAngle = -Math.PI / 2 + (Math.random() * 0.8 - 0.4); 
      const allySpeed = 350 + Math.random() * 150; // Super szybcy! od 350 do 500

      this.ships.push({
        id: `ALLY-${this.allyCounter}`,
        position: { x: spawnX, y: spawnY },
        velocity: { x: Math.cos(allyAngle) * allySpeed, y: Math.sin(allyAngle) * allySpeed },
        isEnemy: false,
        shootCooldown: 1.0 
      });

      this.spawnAllyTimer = 6.0 + Math.random() * 4.0; // Kolejny za 6 do 10 sekund
    }

    // 4. Ruch obiektów i Autostrzał wrogów
    this.projectiles.forEach(p => {
      p.position.x += p.velocity.x * deltaTime;
      p.position.y += p.velocity.y * deltaTime;
    });

    this.ships.forEach(s => {
      s.position.x += s.velocity.x * deltaTime;
      s.position.y += s.velocity.y * deltaTime;

      if (s.isEnemy) {
        // --- 1. Ciągła zmiana rotacji w stronę gracza (Steering) ---
        const speed = Math.hypot(s.velocity.x, s.velocity.y);
        const desiredAngle = Math.atan2(this.playerPosition.y - s.position.y, this.playerPosition.x - s.position.x);
        const currentAngle = Math.atan2(s.velocity.y, s.velocity.x);
        
        let diff = desiredAngle - currentAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        // Predkość zacieśniania kąta w radianach na sekundę
        const turnRate = 0.5 * deltaTime;
        let newAngle = currentAngle;
        if (Math.abs(diff) <= turnRate) {
          newAngle = desiredAngle;
        } else {
          newAngle += Math.sign(diff) * turnRate;
        }
        
        // Zastosowanie zakręconego wektora
        s.velocity.x = Math.cos(newAngle) * speed;
        s.velocity.y = Math.sin(newAngle) * Math.max(speed, 50); // Wymuszenie minimalnego pędu dla Y chroniące przed utknięciem

        // --- 2. Strzelanie (Wróg) ---
        if (s.position.y < this.playerPosition.y + 200 && s.position.y > this.playerPosition.y - 1200) {
          if (s.shootCooldown !== undefined) {
            s.shootCooldown -= deltaTime;
            if (s.shootCooldown <= 0) {
              // Szukanie najbliższego celu (Gracz lub Sojusznicy)
              let closestTargetPos = this.playerPosition;
              let closestDist = Math.hypot(this.playerPosition.x - s.position.x, this.playerPosition.y - s.position.y);
              for (let k = 0; k < this.ships.length; k++) {
                const ally = this.ships[k];
                if (!ally.isEnemy) {
                  const d = Math.hypot(ally.position.x - s.position.x, ally.position.y - s.position.y);
                  if (d < closestDist) { closestDist = d; closestTargetPos = ally.position; }
                }
              }

              // Obłożenie niedokładnym szumem
              const inaccuracy = (Math.random() - 0.5) * (30 * Math.PI / 180); // Szum od -15 do +15 stopni
              const aimAngle = Math.atan2(closestTargetPos.y - s.position.y, closestTargetPos.x - s.position.x) + inaccuracy;
              const pSpeed = 300;
              
              this.projectileCounter++;
              this.projectiles.push({
                id: `P-E-${this.projectileCounter}`,
                position: { x: s.position.x, y: s.position.y + 10 },
                velocity: { x: Math.cos(aimAngle) * pSpeed, y: Math.sin(aimAngle) * pSpeed },
                sourceId: s.id
              });
              s.shootCooldown = 2.0 + Math.random() * 3.0; 
            }
          }
        }
      } 
      else {
        // --- 3. Strzelanie i Sterowanie (Sojusznik) ---
        
        // Szukanie najbliższego Wroga w zasięgu 1500px na potrzeby lotu
        let closestEnemyPos: { x: number, y: number } | null = null;
        let closestDist = 1500;
        for (let k = 0; k < this.ships.length; k++) {
          const enemy = this.ships[k];
          if (enemy.isEnemy) {
            const d = Math.hypot(enemy.position.x - s.position.x, enemy.position.y - s.position.y);
            if (d < closestDist) { closestDist = d; closestEnemyPos = enemy.position; }
          }
        }
        
        // Logika rotacji wektora lotu sojusznika
        const speed = Math.hypot(s.velocity.x, s.velocity.y);
        let desiredAngle = -Math.PI / 2; // Domyślnie leci w przód by nas wyprzedzić  
        if (closestEnemyPos) {
          // Jeśli widzi wroga, fizycznie do niego dociągnij lotem
          desiredAngle = Math.atan2(closestEnemyPos.y - s.position.y, closestEnemyPos.x - s.position.x);
        }
        
        const currentAngle = Math.atan2(s.velocity.y, s.velocity.x);
        let diff = desiredAngle - currentAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;

        const turnRate = 0.8 * deltaTime; // Sojusznicy skręcają zwinniej od ciążkich TIE
        let newAngle = currentAngle;
        if (Math.abs(diff) <= turnRate) {
          newAngle = desiredAngle;
        } else {
          newAngle += Math.sign(diff) * turnRate;
        }
        
        s.velocity.x = Math.cos(newAngle) * speed;
        s.velocity.y = Math.sin(newAngle) * speed; 
        
        // Logika Strzelania
        if (s.position.y > this.playerPosition.y - 1500 && s.position.y < this.playerPosition.y + 1000) {
          if (s.shootCooldown !== undefined) {
            s.shootCooldown -= deltaTime;
            if (s.shootCooldown <= 0) {
              if (closestEnemyPos) {
                const inaccuracy = (Math.random() - 0.5) * (15 * Math.PI / 180); // Węższy margines błędu przyjaciół
                const aimAngle = Math.atan2(closestEnemyPos.y - s.position.y, closestEnemyPos.x - s.position.x) + inaccuracy;
                const pSpeed = 600;

                this.projectileCounter++;
                this.projectiles.push({
                  id: `P-A-${this.projectileCounter}`,
                  position: { x: s.position.x, y: s.position.y - 10 },
                  velocity: { x: Math.cos(aimAngle) * pSpeed, y: Math.sin(aimAngle) * pSpeed },
                  sourceId: 'ally'
                });
                s.shootCooldown = 1.5; 
              } else {
                 s.shootCooldown = 0.5; // Gdy zgubił kogoś do celowania, sprawdź ponownie za chwilę
              }
            }
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
          if (this.onDamage) this.onDamage(30); // Zgłoszenie dmg z zewnątrz
          
          this.explosions.push({
            position: { x: s.position.x, y: s.position.y },
            life: 0.6,
            maxLife: 0.6,
            radius: 40
          });

          this.ships.splice(i, 1);
          continue;
        }
      }
    }

    // Kolizje Pocisków
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      let pDestroyed = false;

      if (p.sourceId === 'player' || p.sourceId === 'ally') {
         // Pocisk gracza lub sojusznika trafiający we wroga
         for (let j = this.ships.length - 1; j >= 0; j--) {
           const s = this.ships[j];
           if (s.isEnemy && Math.hypot(p.position.x - s.position.x, p.position.y - s.position.y) < projRadius + eRadius) {
             
             this.explosions.push({
               position: { x: s.position.x, y: s.position.y },
               life: 0.4,
               maxLife: 0.4,
               radius: 30
             });

             this.ships.splice(j, 1);
             this.projectiles.splice(i, 1);
             pDestroyed = true;
             this.distanceTraveled += 200; // Bonus do Scoru za morderstwo!
             this.kills++; // +1 Kill
             break;
           }
         }
      } else if (p.sourceId !== 'ally') { // Tylko pociski wrogów trafiają na dystans statku gracza
         // Pocisk wroga trafiający w drona gracza
        if (Math.hypot(p.position.x - this.playerPosition.x, p.position.y - this.playerPosition.y) < projRadius + pRadius) {
           if (this.onDamage) this.onDamage(20); // Zgłoszenie dmg z zewnątrz
           this.projectiles.splice(i, 1);
           pDestroyed = true;
        }
      }
      
      if (pDestroyed) continue;
    }

    // System GAME OVER obsługiwany jest teraz zewnętrznie.
    // HP updatowane regularnie z silnika do Radar.playerHp

    // 5.5 Odświeżanie animacji wybuchów
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].life -= deltaTime;
      if (this.explosions[i].life <= 0) {
         this.explosions.splice(i, 1);
      }
    }

    // 6. Odśmiecanie bufora (Gargbage Collector) z poprawką na wyrzucanie po osi X
    const cullRadius = 2500;
    this.projectiles = this.projectiles.filter(p => 
      p.position.y < this.playerPosition.y + cullRadius && p.position.y > this.playerPosition.y - cullRadius &&
      p.position.x < this.playerPosition.x + cullRadius && p.position.x > this.playerPosition.x - cullRadius
    );
    this.ships = this.ships.filter(s => 
      s.position.y < this.playerPosition.y + cullRadius && s.position.y > this.playerPosition.y - cullRadius &&
      s.position.x < this.playerPosition.x + cullRadius && s.position.x > this.playerPosition.x - cullRadius
    );
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
      
      // Gracz na zółto, sojusznik na cyjan/niebieski, wrogi na różowy
      if (p.sourceId === 'player') ctx.strokeStyle = '#ffb300';
      else if (p.sourceId === 'ally') ctx.strokeStyle = '#33ccff';
      else ctx.strokeStyle = '#ff3366';
      
      ctx.lineWidth = 3;
      ctx.stroke();
    });

    // Zjawiska (Wybuchy)
    this.explosions.forEach(exp => {
      const progress = 1 - (exp.life / exp.maxLife); // od 0 do 1 (skala)
      const currentRadius = exp.radius * Math.max(0.1, progress);
      const alpha = Math.max(0, exp.life / exp.maxLife); // od 1 do 0 zanikanie
      
      ctx.beginPath();
      ctx.arc(exp.position.x, exp.position.y, currentRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 100, 0, ${alpha})`;
      ctx.fill();
      
      // Jądro wybuchu (żółte)
      ctx.beginPath();
      ctx.arc(exp.position.x, exp.position.y, currentRadius * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 200, 50, ${alpha})`;
      ctx.fill();
    });

    // Statki (Wrogowie i Sojusznicy)
    this.ships.forEach(s => {
      ctx.beginPath();
      ctx.arc(s.position.x, s.position.y, 10, 0, Math.PI * 2);
      
      if (s.isEnemy) {
        ctx.fillStyle = '#ff3333';
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 51, 51, 0.8)';
        ctx.font = '12px monospace';
        ctx.fillText(s.id, s.position.x + 14, s.position.y + 4);
      } else {
        ctx.fillStyle = '#33ccff'; // Niebieskie pancerze sojuszników
        ctx.fill();
        ctx.fillStyle = 'rgba(51, 204, 255, 0.8)';
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
    } else if (this.keys['s'] && !this.isGameOver) {
      ctx.beginPath();
      ctx.moveTo(centerX - 8, centerY - 6);
      ctx.lineTo(centerX, centerY - 15);
      ctx.lineTo(centerX + 8, centerY - 6);
      ctx.fillStyle = '#ff3333';
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
    
    ctx.fillStyle = 'rgba(255, 150, 0, 0.9)';
    ctx.fillText(`KILLS: ${this.kills}`, 220, 30);
    
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


}
}
