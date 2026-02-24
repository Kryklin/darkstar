import { Component, inject, ElementRef, ViewChild, HostListener, OnDestroy, AfterViewInit, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Theme } from '../../services/theme';
import packageJson from '../../../../package.json';
import { UpdateService } from '../../services/update';
import { TerminalComponent } from './terminal/terminal';

interface Enemy {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  active: boolean;
  rotation: number;
  rotationSpeed: number;
  vertices: { x: number; y: number }[];
}

type PowerUpType = 'MULTISHOT' | 'RAPID_FIRE' | 'SHIELD' | 'NUKE' | 'SPEED';

interface PowerUp {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  type: PowerUpType;
  active: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

@Component({
  selector: 'app-home',
  imports: [CommonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule, TerminalComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit, OnDestroy, AfterViewInit {
  theme = inject(Theme);
  updateService = inject(UpdateService);
  version = packageJson.version;

  @ViewChild('matrixCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  private canvasContext!: CanvasRenderingContext2D;

  isElectron = !!window.electronAPI;
  integrityPassed = signal(false);

  // --- Easter Eggs ---
  showTerminal = false;
  private sudoSequence = ['s', 'u', 'd', 'o'];
  private sudoIndex = 0;

  // --- Easter Egg Game State ---
  mode: 'NONE' | 'GAME' | 'MATRIX' = 'NONE';
  gameState: 'PLAYING' | 'WON' | 'GAMEOVER' | 'BACK_TO_WORK' = 'PLAYING';

  private gameLoopId: number | undefined;
  private matrixInterval: ReturnType<typeof setInterval> | undefined;
  private keys = new Set<string>();

  // Game Entities
  private player = {
    x: 0,
    y: 0,
    vx: 0, // Velocity X
    width: 40,
    height: 30,
    baseSpeed: 0.5, // Acceleration
    maxSpeed: 8,
    friction: 0.92,
    tilt: 0,
    thrust: 0,
  };

  private bullets: { x: number; y: number; vx: number; vy: number; width: number; height: number; active: boolean }[] = [];
  private enemies: Enemy[] = [];
  private powerUps: PowerUp[] = [];
  private particles: Particle[] = [];

  private score = 0;
  private enemySpawnTimer = 0;
  private nukeFlash = 0; // Alpha for nuke flash effect

  // Power-up State (TimeLeft in frames)
  activeEffects: Partial<Record<PowerUpType, number>> = {};

  // Easter Egg Trigger State
  private clickCount = 0;
  private clickTimer: ReturnType<typeof setTimeout> | undefined;
  private konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  private konamiIndex = 0;

  ngOnInit() {
    this.updateService.checkForUpdates();
    if (this.isElectron) {
      window.electronAPI.checkIntegrity().then((result) => {
        this.integrityPassed.set(result);
      });
    }
  }

  ngAfterViewInit() {
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  ngOnDestroy() {
    this.resetMode();
    window.removeEventListener('resize', () => this.resizeCanvas());
  }

  // --- Version Clicker (Game) ---
  handleVersionClick() {
    // Prevent accidental toggling if game is already active (Spacebar = Shoot)
    if (this.mode === 'GAME') return;

    this.clickCount++;
    clearTimeout(this.clickTimer);
    this.clickTimer = setTimeout(() => {
      this.clickCount = 0;
    }, 500);

    if (this.clickCount >= 7) {
      this.toggleGame();
      this.clickCount = 0;
    }
  }

  // --- Input Handling ---
  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.resetMode();
      return;
    }

    if (this.mode === 'GAME' && event.key === ' ') {
      event.preventDefault();
    }

    // Ignore sequence trackers if terminal is already open
    if (this.showTerminal) return;

    this.keys.add(event.key);

    // Terminal Sudo Tracker
    if (event.key.toLowerCase() === this.sudoSequence[this.sudoIndex]) {
      this.sudoIndex++;
      if (this.sudoIndex === this.sudoSequence.length) {
        this.openTerminal();
        this.sudoIndex = 0;
      }
    } else {
      this.sudoIndex = 0;
    }

    // Konami Code Tracker
    if (event.key === this.konamiCode[this.konamiIndex]) {
      this.konamiIndex++;
      if (this.konamiIndex === this.konamiCode.length) {
        this.activateKonami();
        this.konamiIndex = 0;
      }
    } else {
      this.konamiIndex = 0; // Reset if miss
    }
  }

  @HostListener('window:keyup', ['$event'])
  handleKeyUp(event: KeyboardEvent) {
    this.keys.delete(event.key);
  }

  // --- Mode Switching ---
  resetMode() {
    this.stopGameLoop();
    this.stopMatrixLoop();
    this.mode = 'NONE';

    // Clear canvas
    if (this.canvasRef && this.canvasContext) {
      const canvas = this.canvasRef.nativeElement;
      this.canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  activateKonami() {
    this.toggleMatrix();
  }

  toggleGame() {
    if (this.mode === 'GAME') {
      this.resetMode();
    } else {
      this.resetMode(); // Ensure clean slate
      this.mode = 'GAME';
      setTimeout(() => this.startGame(), 100);
    }
  }
  
  openTerminal() {
    this.showTerminal = true;
  }
  
  closeTerminal() {
    this.showTerminal = false;
  }

  toggleMatrix() {
    if (this.mode === 'MATRIX') {
      this.resetMode();
    } else {
      this.resetMode(); // Ensure clean slate
      this.mode = 'MATRIX';
      setTimeout(() => this.startMatrix(), 100);
    }
  }

  resizeCanvas() {
    if (this.mode !== 'NONE' && this.canvasRef) {
      this.canvasRef.nativeElement.width = window.innerWidth;
      this.canvasRef.nativeElement.height = window.innerHeight;

      if (this.mode === 'GAME') {
        // Re-center player if off-screen or uninitialized
        if (this.player.y === 0 || this.player.y > window.innerHeight) {
          this.player.x = window.innerWidth / 2 - this.player.width / 2;
          this.player.y = window.innerHeight - 100;
        }
      }
    }
  }

  // --- Matrix Implementation ---
  startMatrix() {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    this.canvasContext = canvas.getContext('2d')!;
    this.resizeCanvas();

    const katakana = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン';
    const latin = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nums = '0123456789';
    const alphabet = katakana + latin + nums;

    const fontSize = 16;
    const columns = canvas.width / fontSize;
    const rainDrops: number[] = Array(Math.floor(columns)).fill(1);

    const draw = () => {
      // Semi-transparent black to create trails
      this.canvasContext.fillStyle = 'rgba(0, 0, 0, 0.05)';
      this.canvasContext.fillRect(0, 0, canvas.width, canvas.height);

      this.canvasContext.fillStyle = '#0F0';
      this.canvasContext.font = fontSize + 'px monospace';

      for (let i = 0; i < rainDrops.length; i++) {
        const text = alphabet.charAt(Math.floor(Math.random() * alphabet.length));
        this.canvasContext.fillText(text, i * fontSize, rainDrops[i] * fontSize);

        if (rainDrops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          rainDrops[i] = 0;
        }
        rainDrops[i]++;
      }
    };

    if (this.matrixInterval) clearInterval(this.matrixInterval);
    this.matrixInterval = setInterval(draw, 30);
  }

  stopMatrixLoop() {
    if (this.matrixInterval) {
      clearInterval(this.matrixInterval);
      this.matrixInterval = undefined;
    }
  }

  // --- Game Implementation ---
  startGame() {
    // Remove focus from trigger element so Spacebar doesn't re-trigger clicks
    (document.activeElement as HTMLElement)?.blur();

    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    this.canvasContext = canvas.getContext('2d')!;

    this.resizeCanvas();
    this.resetGameEntities();
    this.gameState = 'PLAYING';
    this.loop();
  }

  stopGameLoop() {
    if (this.gameLoopId) {
      cancelAnimationFrame(this.gameLoopId);
      this.gameLoopId = undefined;
    }
  }

  // Alias for legacy calls or destroy
  stopGame() {
    this.resetMode();
  }

  resetGameEntities() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    this.player.x = canvas.width / 2 - this.player.width / 2;
    this.player.y = canvas.height - 100;
    this.player.vx = 0;
    this.player.tilt = 0;
    this.player.thrust = 0;

    this.bullets = [];
    this.enemies = [];
    this.powerUps = [];
    this.particles = [];
    this.activeEffects = {};
    this.score = 0;
    this.enemySpawnTimer = 0;
    this.nukeFlash = 0;
    this.gameState = 'PLAYING';
  }

  loop() {
    if (this.mode !== 'GAME') return;

    this.updateGame();
    this.drawGame();

    this.gameLoopId = requestAnimationFrame(() => this.loop());
  }

  updateGame() {
    if (this.gameState !== 'PLAYING') return;

    const canvas = this.canvasRef.nativeElement;

    // --- Player Physics Movement ---
    const speedMult = this.activeEffects['SPEED'] ? 1.5 : 1.0;
    const accel = this.player.baseSpeed * speedMult;
    const maxSpeed = this.player.maxSpeed * speedMult;

    // Acceleration
    if (this.keys.has('ArrowLeft')) {
      this.player.vx -= accel;
    }
    if (this.keys.has('ArrowRight')) {
      this.player.vx += accel;
    }

    // Friction / Damping
    this.player.vx *= this.player.friction;

    // Velocity Clamping
    if (this.player.vx > maxSpeed) this.player.vx = maxSpeed;
    if (this.player.vx < -maxSpeed) this.player.vx = -maxSpeed;

    // Apply Velocity
    this.player.x += this.player.vx;

    // Banking Logic: Tilt based on Velocity + Key interaction
    const targetTilt = (this.player.vx / maxSpeed) * 0.4; // ~22 deg max tilt
    this.player.tilt += (targetTilt - this.player.tilt) * 0.1;
    this.player.thrust = Math.random(); // Flicker

    // Boundaries
    if (this.player.x < 0) {
      this.player.x = 0;
      this.player.vx = 0; // Stop momentum on wall hit
    }
    if (this.player.x + this.player.width > canvas.width) {
      this.player.x = canvas.width - this.player.width;
      this.player.vx = 0;
    }

    // --- Particles ---
    this.particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.05;
    });
    this.particles = this.particles.filter((p) => p.life > 0);

    // --- Power Up Logic ---
    // Decrement timers
    const effectKeys = Object.keys(this.activeEffects) as PowerUpType[];
    effectKeys.forEach((key) => {
      if (this.activeEffects[key]! > 0) {
        this.activeEffects[key]!--;
        if (this.activeEffects[key]! <= 0) {
          delete this.activeEffects[key];
        }
      }
    });

    // Move falling powerups
    this.powerUps.forEach((p) => (p.y += p.speed));
    this.powerUps = this.powerUps.filter((p) => p.y < canvas.height && p.active);

    // Collect Powerups
    const pRect = {
      x: this.player.x,
      y: this.player.y,
      w: this.player.width,
      h: this.player.height,
    };

    this.powerUps.forEach((p) => {
      if (p.active && p.x < pRect.x + pRect.w && p.x + p.width > pRect.x && p.y < pRect.y + pRect.h && p.y + p.height > pRect.y) {
        p.active = false;
        this.activatePowerUp(p.type);
      }
    });

    // --- Bullets ---
    this.bullets.forEach((b) => {
      b.x += b.vx;
      b.y += b.vy;
    });
    this.bullets = this.bullets.filter((b) => b.y > 0 && b.x > 0 && b.x < canvas.width && b.active);

    // --- Enemies ---
    this.enemySpawnTimer++;
    if (this.enemySpawnTimer > 60) {
      this.spawnEnemy(canvas.width);
      this.enemySpawnTimer = 0;
    }

    this.enemies.forEach((e) => {
      e.y += e.speed;
      e.rotation += e.rotationSpeed;
    });

    // --- Collision Detection ---
    // Bullets vs Enemies
    for (const Bullet of this.bullets) {
      for (const Enemy of this.enemies) {
        // Tighten enemy hitbox (15% margin on each side) to approximate circle
        const ex = Enemy.x + Enemy.width * 0.15;
        const ey = Enemy.y + Enemy.height * 0.15;
        const ew = Enemy.width * 0.7;
        const eh = Enemy.height * 0.7;

        if (Bullet.active && Enemy.active && Bullet.x < ex + ew && Bullet.x + Bullet.width > ex && Bullet.y < ey + eh && Bullet.y + Bullet.height > ey) {
          Bullet.active = false;
          Enemy.active = false;
          this.score += 100;
          this.spawnExplosion(Enemy.x + Enemy.width / 2, Enemy.y + Enemy.height / 2); // EXPLOSION

          // Drop Powerup Chance (15% now since there are more types)
          if (Math.random() < 0.15) {
            this.spawnPowerUp(Enemy.x + Enemy.width / 2, Enemy.y + Enemy.height / 2);
          }
        }
      }
    }

    // Win Condition
    if (this.score >= 3000) {
      this.triggerWin();
    }

    // Player vs Enemies (Tight Hitbox)
    // Core hitbox reduced to 40% width/height for "Bullet Hell" style fairness
    const hitW = this.player.width * 0.4;
    const hitH = this.player.height * 0.4;
    const hitX = this.player.x + (this.player.width - hitW) / 2;
    const hitY = this.player.y + (this.player.height - hitH) / 2;

    this.enemies.forEach((e) => {
      // Tighten enemy hitbox for ship collision too
      const ex = e.x + e.width * 0.15;
      const ey = e.y + e.height * 0.15;
      const ew = e.width * 0.7;
      const eh = e.height * 0.7;

      if (e.active && hitX < ex + ew && hitX + hitW > ex && hitY < ey + eh && hitY + hitH > ey) {
        if (this.activeEffects['SHIELD']) {
          e.active = false; // RAMMING SPEED!
          this.score += 100;
          this.spawnExplosion(e.x + e.width / 2, e.y + e.height / 2, '#18ffff'); // Cyan explosion for shield ram
        } else {
          this.triggerGameOver();
        }
      }
    });

    // Enemy cleanup (bottom of screen)
    if (this.enemies.some((e) => e.y > canvas.height - 50 && e.active)) {
      this.enemies = this.enemies.filter((e) => e.y <= canvas.height - 50);
      this.score = Math.max(0, this.score - 50);
    }

    this.enemies = this.enemies.filter((e) => e.active);

    // Nuke Effect Fade
    if (this.nukeFlash > 0) this.nukeFlash -= 0.05;
  }

  spawnEnemy(canvasWidth: number) {
    // Create random asteroid shape
    const size = 30 + Math.random() * 15;
    const numPoints = 6 + Math.floor(Math.random() * 6);
    const vertices = [];
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const rad = (size / 2) * (0.6 + Math.random() * 0.4);
      vertices.push({
        x: Math.cos(angle) * rad,
        y: Math.sin(angle) * rad,
      });
    }

    this.enemies.push({
      x: Math.random() * (canvasWidth - 50),
      y: -50,
      width: size,
      height: size,
      speed: 2 + Math.random() * 3,
      active: true,
      rotation: 0,
      rotationSpeed: (Math.random() - 0.5) * 0.15,
      vertices: vertices,
    });
  }

  spawnPowerUp(x: number, y: number) {
    const rand = Math.random();
    let type: PowerUpType = 'MULTISHOT';

    if (rand < 0.3) type = 'MULTISHOT';
    else if (rand < 0.5) type = 'RAPID_FIRE';
    else if (rand < 0.7) type = 'SPEED';
    else if (rand < 0.9) type = 'SHIELD';
    else type = 'NUKE';

    this.powerUps.push({
      x,
      y,
      width: 24,
      height: 24,
      speed: 2.5,
      type: type,
      active: true,
    });
  }

  activatePowerUp(type: PowerUpType) {
    if (type === 'NUKE') {
      // Trigger Nuke
      this.nukeFlash = 1.0;
      this.enemies.forEach((e) => {
        if (e.y > 0 && e.active) {
          e.active = false;
          this.score += 100;
          this.spawnExplosion(e.x + e.width / 2, e.y + e.height / 2, '#ff1744'); // Red explosion for nuke
        }
      });
    } else {
      // Add 5 seconds (300 frames)
      this.activeEffects[type] = 300;
    }
  }

  spawnExplosion(x: number, y: number, color?: string) {
    const particleCount = 10 + Math.random() * 10;
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color: color || (Math.random() > 0.5 ? '#ff5722' : '#ffeb3b'), // Orange/Yellow default
        size: 2 + Math.random() * 3,
      });
    }
  }

  triggerWin() {
    this.gameState = 'WON';
    this.score = 3000;
    setTimeout(() => {
      this.gameState = 'BACK_TO_WORK';
      setTimeout(() => {
        this.resetMode();
      }, 3000);
    }, 5000);
  }

  triggerGameOver() {
    this.gameState = 'GAMEOVER';
    setTimeout(() => {
      this.resetMode();
    }, 3000);
  }

  // Shooting Input
  @HostListener('window:keydown.space')
  handleSpace() {
    if (this.mode === 'GAME' && this.gameState === 'PLAYING') {
      const bulletX = this.player.x + this.player.width / 2 - 2;
      const bulletY = this.player.y;

      const vy = -10;

      // RAPID FIRE = no visual change on single bullet speed, but allows spamming more?
      // Or we can just spawn MORE bullets per key press?
      // Actually since we rely on KeyDown auto-repeat or mash, we can't easily change "fire rate"
      // unless we change the cooldown logic.
      // For simplicity: RAPID_FIRE spawns 2 bullets in sequence or just faster bullets?
      // Let's make RAPID_FIRE spawn a second wave slightly offset

      const count = this.activeEffects['RAPID_FIRE'] ? 2 : 1;

      for (let i = 0; i < count; i++) {
        const yOff = i * 15; // Offset second bullet

        if (this.activeEffects['MULTISHOT']) {
          // Center
          this.bullets.push({ x: bulletX, y: bulletY + yOff, vx: 0, vy: vy, width: 4, height: 10, active: true });
          // Left
          this.bullets.push({ x: bulletX, y: bulletY + yOff, vx: -2, vy: vy * 0.9, width: 4, height: 10, active: true });
          // Right
          this.bullets.push({ x: bulletX, y: bulletY + yOff, vx: 2, vy: vy * 0.9, width: 4, height: 10, active: true });
        } else {
          this.bullets.push({ x: bulletX, y: bulletY + yOff, vx: 0, vy: vy, width: 4, height: 10, active: true });
        }
      }
    }
  }

  drawGame() {
    const ctx = this.canvasContext;
    const canvas = this.canvasRef.nativeElement;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Nuke Flash
    if (this.nukeFlash > 0.01) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.nukeFlash})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Score
    ctx.fillStyle = '#40c4ff';
    ctx.font = '20px "Roboto", sans-serif';
    ctx.fillText(`Score: ${this.score}`, 20, 30);

    // Active PowerUps UI
    let yPos = 60;
    const effectKeys = Object.keys(this.activeEffects) as PowerUpType[];
    effectKeys.forEach((key) => {
      const timeLeft = this.activeEffects[key]!;
      if (timeLeft > 0) {
        let color = '#fff';
        if (key === 'MULTISHOT') color = '#b2ff59'; // Green
        if (key === 'RAPID_FIRE') color = '#e040fb'; // Purple
        if (key === 'SHIELD') color = '#18ffff'; // Cyan
        if (key === 'SPEED') color = '#ffeb3b'; // Yellow

        ctx.fillStyle = color;
        ctx.fillText(`${key}: ${(timeLeft / 60).toFixed(1)}s`, 20, yPos);
        yPos += 25;
      }
    });

    // Messages
    if (this.gameState === 'WON') {
      ctx.fillStyle = '#69f0ae';
      ctx.font = 'bold 60px "Roboto", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('WINNER!', canvas.width / 2, canvas.height / 2);
      ctx.textAlign = 'start';
    } else if (this.gameState === 'BACK_TO_WORK') {
      ctx.fillStyle = '#ff4081';
      ctx.font = 'bold 40px "Roboto", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('NOW GET BACK TO WORK', canvas.width / 2, canvas.height / 2);
      ctx.textAlign = 'start';
    } else if (this.gameState === 'GAMEOVER') {
      ctx.fillStyle = '#ff1744';
      ctx.font = 'bold 60px "Roboto", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
      ctx.textAlign = 'start';
    }

    if (this.gameState === 'PLAYING' && yPos === 60) {
      ctx.fillStyle = '#40c4ff';
      ctx.fillText(`Controls: Arrows to Move, Space to Shoot`, 20, 60);
    }

    // Player Draw
    if (this.gameState !== 'GAMEOVER') {
      ctx.save();
      ctx.translate(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
      ctx.rotate(this.player.tilt);

      // Shield Effect
      if (this.activeEffects['SHIELD']) {
        ctx.beginPath();
        ctx.arc(0, 0, this.player.width * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(24, 255, 255, 0.3)';
        ctx.fill();
        ctx.strokeStyle = '#18ffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Ship
      ctx.fillStyle = '#40c4ff';
      ctx.beginPath();
      ctx.moveTo(0, -this.player.height / 2);
      ctx.lineTo(this.player.width / 2, this.player.height / 2);
      ctx.lineTo(0, this.player.height / 4);
      ctx.lineTo(-this.player.width / 2, this.player.height / 2);
      ctx.closePath();
      ctx.fill();

      // Thruster
      let thrustChance = 0.3;
      if (this.activeEffects['SPEED']) thrustChance = 0; // Always on with speed

      if (Math.random() > thrustChance) {
        ctx.fillStyle = Math.random() > 0.5 ? '#ffeb3b' : '#ff5722';
        ctx.beginPath();
        const flameLen = this.activeEffects['SPEED'] ? 20 : 10;
        ctx.moveTo(-5, this.player.height / 4 + 5);
        ctx.lineTo(5, this.player.height / 4 + 5);
        ctx.lineTo(0, this.player.height / 2 + flameLen + Math.random() * 10);
        ctx.fill();
      }
      ctx.restore();
    }

    // Particles
    this.particles.forEach((p) => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1.0; // Reset alpha

    // Powerups (Falling items)
    this.powerUps.forEach((p) => {
      if (!p.active) return;

      // Color based on type
      let color = '#fff';
      if (p.type === 'MULTISHOT') color = '#b2ff59';
      if (p.type === 'RAPID_FIRE') color = '#e040fb';
      if (p.type === 'SHIELD') color = '#18ffff';
      if (p.type === 'SPEED') color = '#ffeb3b';
      if (p.type === 'NUKE') color = '#ff1744';

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x + p.width / 2, p.y + p.height / 2, p.width / 2, 0, Math.PI * 2);
      ctx.fill();

      // Inner Glow
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(p.x + p.width / 2, p.y + p.height / 2, p.width / 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Bullets
    ctx.fillStyle = '#ffff00';
    this.bullets.forEach((b) => {
      ctx.fillRect(b.x, b.y, b.width, b.height);
    });

    // Enemies (Asteroids)
    ctx.fillStyle = '#ff1744';
    this.enemies.forEach((e) => {
      ctx.save();
      ctx.translate(e.x + e.width / 2, e.y + e.height / 2);
      ctx.rotate(e.rotation);

      ctx.beginPath();
      if (e.vertices.length > 0) {
        ctx.moveTo(e.vertices[0].x, e.vertices[0].y);
        for (let i = 1; i < e.vertices.length; i++) {
          ctx.lineTo(e.vertices[i].x, e.vertices[i].y);
        }
      }
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#ff8a80';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    });
  }
}
