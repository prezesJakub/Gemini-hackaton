export interface Vector2 {
  x: number;
  y: number;
}

export interface Ship {
  id: string;
  position: Vector2;
  velocity: Vector2;
  isEnemy: boolean;
  shootCooldown?: number; 
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
  
  baseSpeed: number = 100;
  boostSpeed: number = 250;
  slowSpeed: number = 40; 
  sideSpeed: number = 250; 
  
  crosshairOffset: Vector2 = { x: 0, y: -250 };
  crosshairSpeed: number = 400;

  playerHp: number = 100;
  maxHp: number = 100;
  isGameOver: boolean = false;
  
  // Tarcza
  public shieldActive: boolean = false;
  private shieldTimer: number = 0;

  // Boost / Overdrive
  private boostActive: number = 0;

  distanceTraveled: number = 0;
  kills: number = 0;
  
  public isActive: boolean = false;

  ships: Ship[] = [];
  projectiles: Projectile[] = [];
  explosions: Explosion[] = [];

  private keys: { [key: string]: boolean } = {};
  private canvas: HTMLCanvasElement;
  public onDamage?: (amount: number) => void;

  private spawnTimer: number = 0;
  private spawnAllyTimer: number = 5.0; 
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

  public activateShield() {
    this.shieldActive = true;
    this.shieldTimer = 5.0;
  }

  public activateBoost() {
    const jumpDistance = 1500;
    this.playerPosition.y -= jumpDistance;
    this.distanceTraveled += jumpDistance;
    this.boostActive = 0.5;
    this.explosions.push({
      position: { x: this.playerPosition.x, y: this.playerPosition.y + 100 },
      life: 0.8, maxLife: 0.8, radius: 80
    });
  }

  public manualShoot() {
    this.projectileCounter++;
    const projSpeed = 800;
    const mag = Math.hypot(this.crosshairOffset.x, this.crosshairOffset.y);
    let velX = 0; let velY = -projSpeed;
    if (mag !== 0) {
      velX = (this.crosshairOffset.x / mag) * projSpeed;
      velY = (this.crosshairOffset.y / mag) * projSpeed;
    }
    this.projectiles.push({
      id: `P-${this.projectileCounter}`,
      position: { x: this.playerPosition.x, y: this.playerPosition.y },
      velocity: { x: velX, y: velY }, sourceId: 'player'
    });
  }

  public fireMissiles() {
    const projSpeed = 900;
    const mag = Math.hypot(this.crosshairOffset.x, this.crosshairOffset.y);
    let baseVelX = 0; let baseVelY = -projSpeed;
    if (mag !== 0) {
      baseVelX = (this.crosshairOffset.x / mag) * projSpeed;
      baseVelY = (this.crosshairOffset.y / mag) * projSpeed;
    }
    const offsets = [-40, -15, 15, 40];
    const spreadAngle = 0.15;
    offsets.forEach((shift, i) => {
      this.projectileCounter++;
      const angleOffset = (i - 1.5) * spreadAngle; 
      const currentAngle = Math.atan2(baseVelY, baseVelX);
      const targetAngle = currentAngle + angleOffset;
      this.projectiles.push({
        id: `M-${this.projectileCounter}-${i}`,
        position: { x: this.playerPosition.x + shift, y: this.playerPosition.y },
        velocity: { x: Math.cos(targetAngle) * projSpeed, y: Math.sin(targetAngle) * projSpeed },
        sourceId: 'player'
      });
    });
  }

  public update(deltaTime: number) {
    if (this.isGameOver) return;
    if (this.shieldTimer > 0) {
      this.shieldTimer -= deltaTime;
      if (this.shieldTimer <= 0) { this.shieldTimer = 0; this.shieldActive = false; }
    }
    if (this.boostActive > 0) this.boostActive -= deltaTime;

    let currentForwardSpeed = this.baseSpeed;
    if (this.keys['w']) currentForwardSpeed = this.boostSpeed;
    if (this.keys['s']) currentForwardSpeed = this.slowSpeed;

    this.playerPosition.y -= currentForwardSpeed * deltaTime;
    if (this.keys['a']) this.playerPosition.x -= this.sideSpeed * deltaTime;
    if (this.keys['d']) this.playerPosition.x += this.sideSpeed * deltaTime;

    if (this.keys['arrowup']) this.crosshairOffset.y -= this.crosshairSpeed * deltaTime;
    if (this.keys['arrowdown']) this.crosshairOffset.y += this.crosshairSpeed * deltaTime;
    if (this.keys['arrowleft']) this.crosshairOffset.x -= this.crosshairSpeed * deltaTime;
    if (this.keys['arrowright']) this.crosshairOffset.x += this.crosshairSpeed * deltaTime;

    this.crosshairOffset.x = Math.max(-(this.canvas.width/2-20), Math.min(this.canvas.width/2-20, this.crosshairOffset.x));
    this.crosshairOffset.y = Math.max(-(this.canvas.height/2-20), Math.min(this.canvas.height/2-20, this.crosshairOffset.y));
    this.distanceTraveled = Math.max(0, this.startY - this.playerPosition.y);

    this.spawnTimer -= deltaTime;
    if (this.spawnTimer <= 0) {
      this.enemyCounter++;
      const spawnX = this.playerPosition.x + (Math.random()*1200-600);
      const spawnY = this.playerPosition.y - 1000; 
      const angle = Math.random()*Math.PI*2; const speed = 50+Math.random()*100;
      this.ships.push({
        id: `TIE-${this.enemyCounter}`, position: { x: spawnX, y: spawnY },
        velocity: { x: Math.cos(angle)*speed, y: Math.sin(angle)*speed },
        isEnemy: true, shootCooldown: Math.random()*2+1 
      });
      this.spawnTimer = (1.0+Math.random()*1.5) * Math.max(0.2, 1.0-(this.distanceTraveled/40000));
    }

    this.spawnAllyTimer -= deltaTime;
    if (this.spawnAllyTimer <= 0) {
      this.allyCounter++;
      const spawnX = this.playerPosition.x + (Math.random()*800-400);
      const spawnY = this.playerPosition.y+500;
      const allyAngle = -Math.PI/2+(Math.random()*0.8-0.4); 
      const allySpeed = 350+Math.random()*150;
      this.ships.push({
        id: `ALLY-${this.allyCounter}`, position: { x: spawnX, y: spawnY },
        velocity: { x: Math.cos(allyAngle)*allySpeed, y: Math.sin(allyAngle)*allySpeed },
        isEnemy: false, shootCooldown: 1.0 
      });
      this.spawnAllyTimer = 6.0+Math.random()*4.0;
    }

    this.projectiles.forEach(p => { p.position.x += p.velocity.x*deltaTime; p.position.y += p.velocity.y*deltaTime; });
    
    this.ships.forEach(s => {
      s.position.x += s.velocity.x*deltaTime; s.position.y += s.velocity.y*deltaTime;
      if (s.isEnemy) {
        const speed = Math.hypot(s.velocity.x, s.velocity.y);
        const desiredAngle = Math.atan2(this.playerPosition.y - s.position.y, this.playerPosition.x - s.position.x);
        const currentAngle = Math.atan2(s.velocity.y, s.velocity.x);
        let diff = desiredAngle - currentAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        const turnRate = 0.5 * deltaTime;
        let newAngle = currentAngle + Math.sign(diff) * Math.min(turnRate, Math.abs(diff));
        s.velocity.x = Math.cos(newAngle) * speed; s.velocity.y = Math.sin(newAngle) * Math.max(speed, 50);

        if (s.position.y < this.playerPosition.y + 200 && s.position.y > this.playerPosition.y - 1200) {
          if (s.shootCooldown !== undefined) {
             s.shootCooldown -= deltaTime;
             if (s.shootCooldown <= 0) {
               this.projectileCounter++;
               this.projectiles.push({ id:`P-E-${this.projectileCounter}`, position:{x:s.position.x, y:s.position.y+10}, velocity:{x:0, y:300}, sourceId:s.id });
               s.shootCooldown = 2.0+Math.random()*3.0;
             }
          }
        }
      }
    });

    for (let i = this.ships.length-1; i>=0; i--) {
      const s = this.ships[i];
      if (s.isEnemy && Math.hypot(s.position.x-this.playerPosition.x, s.position.y-this.playerPosition.y) < 30) {
        if (!this.shieldActive && this.onDamage) this.onDamage(30);
        this.explosions.push({ position: { x: s.position.x, y: s.position.y }, life: 0.6, maxLife: 0.6, radius: 40 });
        this.ships.splice(i, 1);
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (p.sourceId !== 'player' && p.sourceId !== 'ally') {
        if (Math.hypot(p.position.x - this.playerPosition.x, p.position.y - this.playerPosition.y) < 23) {
          if (!this.shieldActive && this.onDamage) this.onDamage(20);
          this.projectiles.splice(i, 1);
        }
      } else {
        for (let j = this.ships.length-1; j>=0; j--) {
           const s = this.ships[j];
           if (s.isEnemy && Math.hypot(p.position.x-s.position.x, p.position.y-s.position.y) < 23) {
             this.explosions.push({ position: { x: s.position.x, y: s.position.y }, life: 0.4, maxLife: 0.4, radius: 30 });
             this.ships.splice(j, 1); this.projectiles.splice(i, 1);
             this.distanceTraveled+=200; this.kills++; break;
           }
        }
      }
    }
    this.explosions = this.explosions.filter(e => (e.life -= deltaTime) > 0);
  }

  public render(ctx: CanvasRenderingContext2D) {
    const width = this.canvas.width; const height = this.canvas.height;
    ctx.fillStyle = '#0a0f18'; ctx.fillRect(0, 0, width, height);
    
    ctx.save();
    const centerX = width/2; const centerY = height/2;
    ctx.translate(centerX - this.playerPosition.x, centerY - this.playerPosition.y);

    ctx.strokeStyle = 'rgba(34, 56, 81, 0.4)'; ctx.lineWidth = 1; ctx.beginPath();
    const gridSize = 250;
    const startX = Math.floor((this.playerPosition.x - centerX) / gridSize) * gridSize;
    const endX = Math.ceil((this.playerPosition.x + centerX) / gridSize) * gridSize;
    const startY = Math.floor((this.playerPosition.y - centerY) / gridSize) * gridSize;
    const endY = Math.ceil((this.playerPosition.y + centerY) / gridSize) * gridSize;
    for (let x = startX; x <= endX; x += gridSize) { ctx.moveTo(x, startY); ctx.lineTo(x, endY); }
    for (let y = startY; y <= endY; y += gridSize) { ctx.moveTo(startX, y); ctx.lineTo(endX, y); }
    ctx.stroke();

    this.projectiles.forEach(p => {
      ctx.beginPath(); ctx.moveTo(p.position.x, p.position.y);
      ctx.lineTo(p.position.x - p.velocity.x*0.05, p.position.y - p.velocity.y*0.05);
      ctx.strokeStyle = p.sourceId === 'player' ? '#ffb300' : (p.sourceId === 'ally' ? '#33ccff' : '#ff3366');
      ctx.lineWidth = 3; ctx.stroke();
    });

    this.explosions.forEach(e => {
      ctx.beginPath(); ctx.arc(e.position.x, e.position.y, e.radius*(1-e.life/e.maxLife), 0, Math.PI*2);
      ctx.fillStyle = `rgba(255, 100, 0, ${e.life/e.maxLife})`; ctx.fill();
    });

    this.ships.forEach(s => {
      ctx.beginPath(); ctx.arc(s.position.x, s.position.y, 10, 0, Math.PI*2);
      ctx.fillStyle = s.isEnemy ? '#ff3333' : '#33ccff'; ctx.fill();
    });

    if (this.shieldActive) {
      ctx.beginPath(); ctx.arc(this.playerPosition.x, this.playerPosition.y, 35, 0, Math.PI*2);
      ctx.strokeStyle = 'cyan'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();

    ctx.beginPath(); ctx.moveTo(centerX, centerY - 15); ctx.lineTo(centerX - 12, centerY + 12);
    ctx.lineTo(centerX, centerY + 6); ctx.lineTo(centerX + 12, centerY + 12);
    ctx.closePath(); ctx.fillStyle = this.shieldActive ? '#00ffff' : (this.boostActive > 0 ? '#ffffff' : '#00ffcc'); ctx.fill();

    if (this.boostActive > 0) {
      ctx.strokeStyle = `rgba(255,255,255,${this.boostActive*2})`;
      for (let i=0; i<15; i++) {
        const x=Math.random()*width, y=Math.random()*height;
        ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y+150); ctx.stroke();
      }
    }

    if (!this.isGameOver) {
      const cwX = centerX + this.crosshairOffset.x;
      const cwY = centerY + this.crosshairOffset.y;
      ctx.beginPath(); ctx.arc(cwX, cwY, 12, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 0, 85, 0.8)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cwX - 6, cwY); ctx.lineTo(cwX + 6, cwY);
      ctx.moveTo(cwX, cwY - 6); ctx.lineTo(cwX, cwY + 6); ctx.stroke();
    }

    ctx.fillStyle = 'rgba(0, 255, 204, 0.9)'; ctx.font = '16px monospace';
    ctx.fillText(`SCORE: ${Math.round(this.distanceTraveled / 10)}`, 20, 30);
    ctx.fillText(`KILLS: ${this.kills}`, 220, 30);

    if (!this.isActive && !this.isGameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
      for(let i=0; i<height; i+=4) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(width, i); ctx.stroke(); }
      ctx.fillStyle = '#00f0ff'; ctx.font = 'bold 40px monospace'; ctx.textAlign = 'center';
      ctx.shadowBlur = 15; ctx.shadowColor = '#00f0ff';
      ctx.fillText('SIMULATION PAUSED', width/2, height/2);
      ctx.shadowBlur = 0; ctx.font = '18px monospace'; ctx.fillStyle = 'white';
      ctx.fillText('COMM-LINK INITIALIZING... USE VOICE COMMANDS OR PRESS PLAY', width/2, height/2 + 50);
      ctx.textAlign = 'left';
    }
  }
}
