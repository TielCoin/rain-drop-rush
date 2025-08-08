
/* Rain Drop Rush - single-file game logic */
/* Uses canvas; assets in assets/monstera.png */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = canvas.width, H = canvas.height;

const monsteraImg = new Image();
monsteraImg.src = 'assets/monstera.png';

// Game state
let score = 0;
let running = false;
let drops = [];
let bugs = [];
let splashes = [];
let lastSpawn = 0;
let lastBug = 0;
let speedMultiplier = 1;
let timeStarted = 0;
let thirst = 100; // 0-100
let health = 100;
let isMuted = false;

// Pot controlled by player
const pot = { x: W/2-50, y: H-120, w: 100, h: 24, speed: 6 };

// Settings
const spawnInterval = 700; // ms
const bugInterval = 5000;
const gravity = 0.35;

const scoreEl = document.getElementById('scoreVal');
const thirstFill = document.getElementById('thirstFill');
const startBtn = document.getElementById('startBtn');
const muteBtn = document.getElementById('muteBtn');

// Sounds (simple synth using WebAudio)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function beep(freq, type='sine', duration=0.08, vol=0.08){
  if(isMuted) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.value = vol;
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + duration);
}

// Input
const keys = {};
window.addEventListener('keydown', e=>{ keys[e.key]=true; });
window.addEventListener('keyup', e=>{ keys[e.key]=false; });

// Mobile touch control
canvas.addEventListener('touchstart', function(e){
  e.preventDefault();
  const t = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const x = t.clientX - rect.left;
  if(x < rect.width/2) moveLeft(); else moveRight();
}, {passive:false});

// Click to swat bugs
canvas.addEventListener('click', function(e){
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  // detect bug clicks
  for(let i=bugs.length-1;i>=0;i--){
    const b = bugs[i];
    if(Math.hypot(b.x-x,b.y-y) < 28){ // clicked bug
      bugs.splice(i,1);
      score += 10; beep(800,'square',0.06,0.09);
      splashes.push({x:x,y:y,r:6,life:18,color:'rgba(255,200,0,0.9)'});
      return;
    }
  }
});

function moveLeft(){ pot.x -= pot.speed*2; if(pot.x<0) pot.x=0; }
function moveRight(){ pot.x += pot.speed*2; if(pot.x+pot.w>W) pot.x = W-pot.w; }

function spawnDrop(){
  const x = Math.random()*(W-18)+9;
  const vx = (Math.random()-0.5)*0.6*speedMultiplier; // wind effect
  drops.push({x:x,y:-10,vy:1+Math.random()*0.5, vx: vx, r:8 + Math.random()*4});
}

function spawnBug(){
  const fromLeft = Math.random()<0.5;
  const y = H - 220 + Math.random()*80;
  const x = fromLeft ? -20 : W+20;
  const sx = fromLeft ? 1.5+Math.random() : -1.5-Math.random();
  bugs.push({x:x,y:y,vx:sx, life:8000});
}

function update(dt){
  if(!running) return;
  // Player movement via keys
  if(keys['ArrowLeft']||keys['a']) pot.x -= pot.speed;
  if(keys['ArrowRight']||keys['d']) pot.x += pot.speed;
  if(pot.x<0) pot.x = 0; if(pot.x+pot.w>W) pot.x=W-pot.w;

  // Spawning drops progressively faster
  const now = Date.now();
  if(now - lastSpawn > spawnInterval / Math.max(1, speedMultiplier)){
    spawnDrop(); lastSpawn = now;
  }
  if(now - lastBug > bugInterval){
    spawnBug(); lastBug = now;
  }

  // Update drops
  for(let i=drops.length-1;i>=0;i--){
    const d = drops[i];
    d.vy += gravity * 0.1 * speedMultiplier;
    d.x += d.vx * speedMultiplier;
    d.y += d.vy * speedMultiplier;
    // Collision with pot (catch)
    if(d.y + d.r > pot.y && d.y - d.r < pot.y + pot.h && d.x > pot.x && d.x < pot.x+pot.w){
      // caught
      drops.splice(i,1);
      score += 5;
      thirst = Math.min(100, thirst + 6);
      speedMultiplier += 0.006; // slight difficulty increase
      splashes.push({x:d.x,y:pot.y, r: d.r*1.6, life:18, color:'rgba(90,210,255,0.9)'});
      beep(880,'sine',0.05,0.06);
      continue;
    }
    // Missed (fell past bottom)
    if(d.y > H+30){
      drops.splice(i,1);
      thirst -= 8;
      health -= 2;
      beep(220,'sawtooth',0.08,0.06);
      splashes.push({x:d.x,y:H-80, r: d.r*1.6, life:16, color:'rgba(180,100,80,0.6)'});
      continue;
    }
  }

  // Update bugs
  for(let i=bugs.length-1;i>=0;i--){
    const b = bugs[i];
    b.x += b.vx * (1 + speedMultiplier*0.1);
    // if reaches leaf area, nibble
    const leafX = W/2, leafY = H-220;
    if(Math.hypot(b.x-leafX,b.y-leafY) < 60){
      // nibble effect
      bugs.splice(i,1);
      health -= 12;
      thirst -= 6;
      splashes.push({x:b.x,y:b.y,r:10,life:22,color:'rgba(200,60,60,0.9)'});
      beep(260,'triangle',0.12,0.08);
      continue;
    }
    // remove if off screen
    if(b.x < -60 || b.x > W+60) bugs.splice(i,1);
  }

  // Update splashes
  for(let i=splashes.length-1;i>=0;i--){
    const s = splashes[i];
    s.life -= 1;
    s.r *= 0.98;
    if(s.life<=0) splashes.splice(i,1);
  }

  // Thirst passive drain & game over check
  thirst -= 0.007 * speedMultiplier * dt;
  if(thirst < 0) thirst = 0;
  if(health < 0) health = 0;

  // If thirst hits zero, immediate wilt + end
  if(thirst <= 0 || health <= 0){
    running = false;
    // show end overlay via start button text
    startBtn.textContent = 'Game Over — Restart';
    beep(120,'sine',0.6,0.12);
  }

  // update UI
  scoreEl.textContent = Math.floor(score);
  thirstFill.style.width = (thirst)+'%';
  // color shift for thirst
  const green = Math.floor(115 + (thirst/100)*120);
  const blue = Math.floor(150 + (thirst/100)*100);
  thirstFill.style.background = `linear-gradient(90deg,rgb(75,211,255), rgb(${Math.min(255,green)},${Math.min(255,blue)},180))`;
}

function draw(){
  // clear
  ctx.clearRect(0,0,W,H);

  // background layers (gentle parallax based on score/time)
  const t = (Date.now()-timeStarted)/1000;
  const skyShift = Math.min(1, Math.sin(t*0.05)*0.2 + score*0.00005);
  const g1 = ctx.createLinearGradient(0,0,0,H);
  g1.addColorStop(0, '#9fe6ff');
  g1.addColorStop(1, '#d3f7d8');
  ctx.fillStyle = g1;
  ctx.fillRect(0,0,W,H);

  // raindrops (behind plant)
  for(const d of drops){
    ctx.beginPath();
    const grd = ctx.createRadialGradient(d.x, d.y, 1, d.x, d.y, d.r);
    grd.addColorStop(0,'rgba(255,255,255,0.9)');
    grd.addColorStop(0.2,'rgba(140,220,255,0.95)');
    grd.addColorStop(1,'rgba(40,160,220,0.7)');
    ctx.fillStyle = grd;
    ctx.ellipse(d.x, d.y, d.r*0.6, d.r, 0, 0, Math.PI*2);
    ctx.fill();
    // small tail for motion
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(d.x - d.r*0.15, d.y - d.r*1.5, d.r*0.3, d.r*0.8);
  }

  // draw pot
  ctx.fillStyle = '#6a3b20';
  ctx.fillRect(pot.x, pot.y, pot.w, pot.h);
  // soil inside pot
  ctx.fillStyle = '#3f2715';
  ctx.fillRect(pot.x+6, pot.y-12, pot.w-12, 12);

  // draw plant (monstera) above pot; apply growth & wilting
  const growth = Math.min(1, 0.5 + (score/300)); // ranges 0.5 -> ~1
  const leafX = W/2, leafY = H-220;
  const leafW = 320 * growth, leafH = 220 * growth;

  // if wilting, apply brown overlay / desaturation
  ctx.save();
  // draw image centered on leafX
  ctx.translate(leafX - leafW/2, leafY - leafH/2);
  // apply slight sway
  const sway = Math.sin((Date.now()/700))*4 * (0.5 + growth*0.5);
  ctx.rotate(sway * Math.PI/180);
  ctx.drawImage(monsteraImg, 0, 0, leafW, leafH);
  // wilting overlay
  if(thirst < 30 || health < 30){
    const alpha = Math.min(0.7, (30 - Math.min(thirst, health)) / 40);
    ctx.fillStyle = 'rgba(120,60,20,'+alpha+')';
    ctx.fillRect(0,0,leafW,leafH);
    // desaturate (quick approach: translucent gray)
    ctx.fillStyle = 'rgba(80,80,80,'+ (alpha*0.25) +')';
    ctx.fillRect(0,0,leafW,leafH);
  }
  ctx.restore();

  // draw bugs (in front of plant)
  for(const b of bugs){
    ctx.beginPath();
    ctx.fillStyle = '#222';
    ctx.ellipse(b.x, b.y, 10,8,0,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(b.x-5, b.y-12, 10,3); // wing hint
  }

  // draw splashes/particles
  for(const s of splashes){
    ctx.beginPath();
    ctx.fillStyle = s.color;
    ctx.globalAlpha = Math.max(0, s.life/22);
    ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // HUD overlay: health hearts
  for(let i=0;i<5;i++){
    const hx = 14 + i*22, hy = 12;
    ctx.beginPath();
    ctx.fillStyle = i < Math.ceil(health/20) ? '#ff6666' : 'rgba(255,255,255,0.25)';
    // simple heart (circle pair)
    ctx.arc(hx+4, hy+6, 5, 0, Math.PI*2);
    ctx.arc(hx+10, hy+6, 5, 0, Math.PI*2);
    ctx.moveTo(hx+1, hy+10);
    ctx.lineTo(hx+14, hy+10);
    ctx.fill();
  }

  // optional debug: draw pot bounds
  // ctx.strokeStyle = 'rgba(255,0,0,0.2)'; ctx.strokeRect(pot.x,pot.y,pot.w,pot.h);
}

let lastTime = Date.now();
function loop(){
  const now = Date.now();
  const dt = (now - lastTime)/16.666; // approx frames
  update(dt);
  draw();
  lastTime = now;
  requestAnimationFrame(loop);
}

startBtn.addEventListener('click', ()=>{
  if(!running){
    // reset
    drops = []; bugs = []; splashes = [];
    lastSpawn = Date.now(); lastBug = Date.now();
    speedMultiplier = 1; score = 0; thirst = 100; health = 100;
    pot.x = W/2 - pot.w/2;
    running = true; timeStarted = Date.now();
    startBtn.textContent = 'Running...';
    beep(880,'sine',0.06,0.06);
  }
});

muteBtn.addEventListener('click', ()=>{ isMuted = !isMuted; muteBtn.textContent = isMuted ? '🔈' : '🔊'; });

// window resize handling to keep canvas crisp
function resizeCanvas(){
  const rect = canvas.getBoundingClientRect();
  // keep internal resolution fixed; scale via CSS (we set max-width in CSS)
}
window.addEventListener('resize', resizeCanvas);

// initial draw loop
monsteraImg.onload = ()=>{ loop(); };

// simple auto-increase difficulty by time
setInterval(()=>{ if(running) speedMultiplier += 0.002; }, 2000);

