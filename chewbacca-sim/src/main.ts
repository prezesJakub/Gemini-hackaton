import { Radar } from './radar';

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