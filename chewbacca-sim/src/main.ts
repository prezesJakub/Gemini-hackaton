import { Radar, type Ship, type Projectile } from './radar';

const appDiv = document.getElementById('app');
if (appDiv) {
  // Reset stylów i przygotowanie pełnoekranowego płótna (canvas)
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.body.style.backgroundColor = '#000';

  const canvas = document.createElement('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  appDiv.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  
  // Konstrukcja radaru
  const radar = new Radar(canvas);

  // Dodanie przykładowych podmiotów testowych (Wrogowie i pociski)
  const mockShips: Ship[] = [
    { id: 'TIE-01', position: { x: 1700, y: 1400 }, velocity: { x: -50, y: 20 }, isEnemy: true },
    { id: 'TIE-02', position: { x: 1300, y: 1600 }, velocity: { x: 40, y: -30 }, isEnemy: true },
    { id: 'ALLY-X', position: { x: 1600, y: 1700 }, velocity: { x: -10, y: -10 }, isEnemy: false },
  ];

  const mockProjectiles: Projectile[] = [
    { id: 'P-1', position: { x: 1550, y: 1450 }, velocity: { x: 400, y: -200 }, sourceId: 'player' },
    { id: 'P-2', position: { x: 1450, y: 1550 }, velocity: { x: -300, y: 300 }, sourceId: 'TIE-02' }
  ];

  radar.updateEntities(mockShips, mockProjectiles);

  // Zmiana rozmiaru okna
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });

  // Pętla gry (Game Loop)
  let lastTime = performance.now();
  function gameLoop(currentTime: number) {
    const deltaTime = (currentTime - lastTime) / 1000; // Czas w sekundach
    lastTime = currentTime;

    radar.update(deltaTime);
    if (ctx) {
      radar.render(ctx);
    }

    requestAnimationFrame(gameLoop);
  }

  // Uruchomienie pętli
  requestAnimationFrame(gameLoop);
}