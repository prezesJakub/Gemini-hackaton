export interface Vector2 {
  x: number;
  y: number;
}

export interface Ship {
  id: string;
  position: Vector2;
  velocity: Vector2;
  isEnemy: boolean;
}

export interface Projectile {
  id: string;
  position: Vector2;
  velocity: Vector2;
  sourceId: string;
}

export class Radar {
  // Rozmiary całej mapy
  mapWidth: number = 3000;
  mapHeight: number = 3000;

  // Pozycja gracza zaczyna się pośrodku mapy
  playerPosition: Vector2 = { x: 1500, y: 1500 };
  playerSpeed: number = 300; // Pikseli na sekundę

  // Podmioty na radarze
  ships: Ship[] = [];
  projectiles: Projectile[] = [];

  // Stan wciśniętych klawiszy (WSAD)
  private keys: { [key: string]: boolean } = {};

  private canvas: HTMLCanvasElement;

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

  // Funkcje do wczytywania i uaktualniania zewnętrznych danych
  public updateEntities(ships: Ship[], projectiles: Projectile[]) {
    this.ships = ships;
    this.projectiles = projectiles;
  }

  public update(deltaTime: number) {
    // 1. Ruch statku gracza po osiach XY (WSAD)
    let dx = 0;
    let dy = 0;

    if (this.keys['w']) dy -= 1;
    if (this.keys['s']) dy += 1;
    if (this.keys['a']) dx -= 1;
    if (this.keys['d']) dx += 1;

    // Normalizacja poruszania po skosie (żeby statek nie był szybszy)
    if (dx !== 0 && dy !== 0) {
      const length = Math.sqrt(dx * dx + dy * dy);
      dx /= length;
      dy /= length;
    }

    // Aktualizacja pozycji na mapie z uwzględnieniem czasu klatki (deltaTime w sekundach)
    this.playerPosition.x += dx * this.playerSpeed * deltaTime;
    this.playerPosition.y += dy * this.playerSpeed * deltaTime;

    // 2. Kolizje ze ścianami (pozostajemy na mapie)
    this.playerPosition.x = Math.max(0, Math.min(this.mapWidth, this.playerPosition.x));
    this.playerPosition.y = Math.max(0, Math.min(this.mapHeight, this.playerPosition.y));

    // Symulacja innych podmiotów w ramach dema
    this.projectiles.forEach(p => {
      p.position.x += p.velocity.x * deltaTime;
      p.position.y += p.velocity.y * deltaTime;
    });
    this.ships.forEach(s => {
      s.position.x += s.velocity.x * deltaTime;
      s.position.y += s.velocity.y * deltaTime;
    });
  }

  public render(ctx: CanvasRenderingContext2D) {
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Czyszczenie tła radaru na ciemno (przestrzeń kosmiczna)
    ctx.fillStyle = '#0a0f18';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    
    // Gracz jest w środku widoku na radarze, przesuwamy całą "mapę" i obiekty pod nim 
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Przekształcamy świat tak, aby punkt (playerPosition.x, playerPosition.y)
    // spadł idealnie na środek (centerX, centerY) canvasu.
    ctx.translate(centerX - this.playerPosition.x, centerY - this.playerPosition.y);

    // Rysowanie obramowania/granic mapy
    ctx.strokeStyle = '#223851';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, this.mapWidth, this.mapHeight);

    // Rysowanie siatki z koordynatami (efekt radaru taktycznego)
    ctx.strokeStyle = 'rgba(34, 56, 81, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= this.mapWidth; x += 250) {
      ctx.moveTo(x, 0); ctx.lineTo(x, this.mapHeight);
    }
    for (let y = 0; y <= this.mapHeight; y += 250) {
      ctx.moveTo(0, y); ctx.lineTo(this.mapWidth, y);
    }
    ctx.stroke();

    // Rysowanie pocisków (z wektorem toru lotu)
    this.projectiles.forEach(p => {
      ctx.beginPath();
      ctx.moveTo(p.position.x, p.position.y);
      // Smuga w stronę przeciwną od kierunku lotu pocisku daje poczucie prędkości
      ctx.lineTo(p.position.x - p.velocity.x * 0.1, p.position.y - p.velocity.y * 0.1);
      ctx.strokeStyle = '#ffb300';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Info tekstowe o pocisku
      ctx.fillStyle = 'rgba(255, 179, 0, 0.6)';
      ctx.font = '10px monospace';
      ctx.fillText('MSL', p.position.x + 5, p.position.y - 5);
    });

    // Rysowanie wrogich statków
    this.ships.forEach(s => {
      ctx.beginPath();
      // Kropki wrogów na czerwono
      ctx.arc(s.position.x, s.position.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = s.isEnemy ? '#ff3333' : '#33ccff';
      ctx.fill();
      
      // Tekstowe oznaczenia jednostek
      ctx.fillStyle = s.isEnemy ? 'rgba(255, 51, 51, 0.8)' : 'rgba(51, 204, 255, 0.8)';
      ctx.font = '12px monospace';
      ctx.fillText(s.id, s.position.x + 10, s.position.y);
      
      // Rysowanie wektora prędkości dla wroga (przewidywanie ścieżki)
      ctx.beginPath();
      ctx.moveTo(s.position.x, s.position.y);
      ctx.lineTo(s.position.x + s.velocity.x, s.position.y + s.velocity.y);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]); // Przerywana ścieżka predykcji lotu
      ctx.stroke();
      ctx.setLineDash([]); // Reset powrotny do ciągłej linii
    });

    ctx.restore();

    // Rysowwanie Statku Gracza (zawsze zamrożony na środku ekranu)
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - 12);
    ctx.lineTo(centerX - 10, centerY + 10);
    ctx.lineTo(centerX, centerY + 5);
    ctx.lineTo(centerX + 10, centerY + 10);
    ctx.closePath();
    ctx.fillStyle = '#00ffcc'; // Wyrazisty turkus/cyjan w centrum radaru
    ctx.fill();
    // Naszyjnik "O" wokół statku oznaczający hitbox radaru gracza
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.3)';
    ctx.stroke();

    // UI Overlay (Informacje taktyczne na ekranie gracza)
    ctx.fillStyle = 'rgba(0, 255, 204, 0.9)';
    ctx.font = '14px monospace';
    ctx.fillText(`POS: [${Math.round(this.playerPosition.x)}, ${Math.round(this.playerPosition.y)}]`, 20, 30);
    ctx.fillText('MOVE: W S A D', 20, 50);
  }
}
