/* =========================================================
   ქართული ტაიპინგ თამაში — Vanilla JS
   Fix:
   - ბურთი აღარ არის emoji (ზოგ ბრაუზერზე არ იხატებოდა)
   - ახლა ბურთი იხატება Canvas-ზე ნამდვილ "ფეხბურთის" სტილში (თეთრი + შავი პანელები)
   - ბურთი ხტება და დგება პლატფორმაზე
   - ქულა დროის მიხედვით იკლებს (10წმ-მდე 50, მერე პროპორციულად, მინ 10)
   - Stage იცვლება სწორად აკრეფილი სიტყვების რაოდენობით (ყოველ 500-ზე) + პროგრესი
========================================================= */

(() => {
  // ---------- DOM ----------
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const stageEl = document.getElementById("stage");
  const correctEl = document.getElementById("correctCount");
  const wordEl = document.getElementById("currentWord");
  const inputEl = document.getElementById("wordInput");
  const speedSlider = document.getElementById("speedSlider");
  const speedValueEl = document.getElementById("speedValue");
  const timerTextEl = document.getElementById("timerText");
  const restartBtn = document.getElementById("restartBtn");
  const statusMsgEl = document.getElementById("statusMsg");

  // ---------- Words ----------
  const WORDS = [
    "მზე","ცა","ბურთი","სკოლა","თამაში","ბაღი","წყალი","ხე","სახლი","ბავშვი",
    "კატა","ძაღლი","ყვავილი","ფოთოლი","თოვლი","წვიმა","ქარი","ზღვა","მდინარე","მთა",
    "წიგნი","ფანქარი","მეგობარი","სიყვარული","სიხარული","ღიმილი","სურათი","ფერადი","მუსიკა","ცეკვა",
    "კიდე","კიბე","კარი","ფანჯარა","თეფში","კოვზი","ჩანგალი","რძე","პური","ვაშლი",
    "ატამი","ბანანი","ყურძენი","თაფლი","თევზი","ხტომა","სირბილი","სიჩქარე","ლამაზი"
  ];

  // ---------- Game state ----------
  const STAGES = [
    { id: 1, name: "ეზო", label: "1 / ეზო" },
    { id: 2, name: "ღრუბლები", label: "2 / ღრუბლები" },
    { id: 3, name: "კოსმოსი", label: "3 / კოსმოსი" }
  ];
  const WORDS_PER_STAGE = 500;

  let score = 0;
  let correctCount = 0;
  let stageIndex = 0;

  let secondsPerWord = parseFloat(speedSlider.value);
  let nextWordAt = performance.now() + secondsPerWord * 1000;

  let currentWord = "";
  let wordStartTime = performance.now();

  // ---------- World / physics ----------
  const stepHeight = 80;
  const platformW = 140;
  const platformH = 14;

  let stepIndex = 0;

  const ball = {
    x: 0,
    y: 0,
    radius: 20,
    vy: 0,
    targetY: 0,
    targetX: 0,
    squash: 0
  };

  let cameraY = 0;
  let platforms = [];

  let decor = { clouds: [], stars: [], garden: [] };

  // ---------- Utils ----------
  function rand(min, max) { return Math.random() * (max - min) + min; }
  function choice(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function setStatus(text, type) {
    statusMsgEl.textContent = text;
    statusMsgEl.classList.remove("good", "bad");
    if (type) statusMsgEl.classList.add(type);
  }

  function stageLabel() { return STAGES[stageIndex].label; }

  // ---------- Resize ----------
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---------- Platforms / decor ----------
  function makePlatforms() {
    platforms = [];
    const baseY = 0;
    const centerX = canvas.getBoundingClientRect().width * 0.5;

    for (let i = 0; i < 340; i++) {
      const y = baseY - i * stepHeight;
      const wiggle = Math.sin(i * 0.6) * 140 + rand(-35, 35);
      const x = centerX + wiggle;
      platforms.push({ x, y, w: platformW, h: platformH });
    }
  }

  function makeDecor() {
    decor.clouds = [];
    decor.stars = [];
    decor.garden = [];

    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;

    for (let i = 0; i < 18; i++) {
      decor.clouds.push({
        x: rand(0, w),
        y: rand(-h * 2, h),
        r: rand(22, 55),
        s: rand(0.15, 0.35),
        dx: rand(5, 18)
      });
    }

    for (let i = 0; i < 160; i++) {
      decor.stars.push({
        x: rand(0, w),
        y: rand(-h * 3, h),
        r: rand(0.8, 2.2),
        tw: rand(0.5, 1.6)
      });
    }

    for (let i = 0; i < 110; i++) {
      decor.garden.push({
        x: rand(0, w),
        y: rand(h * 0.35, h * 1.2),
        r: rand(2, 5),
        t: rand(0, Math.PI * 2)
      });
    }
  }

  // ---------- Word logic ----------
  function pickNewWord() {
    let w = choice(WORDS);
    if (w === currentWord && WORDS.length > 1) w = choice(WORDS);

    currentWord = w;
    wordEl.textContent = currentWord;

    nextWordAt = performance.now() + secondsPerWord * 1000;
    wordStartTime = performance.now();
  }

  // ---------- Stage logic ----------
  function updateStageIfNeeded() {
    const targetStage = Math.min(Math.floor(correctCount / WORDS_PER_STAGE), 2);
    if (targetStage !== stageIndex) {
      stageIndex = targetStage;
      setStatus(`Stage შეიცვალა: ${STAGES[stageIndex].name}! 🚀`, "good");
    }
    const progress = correctCount % WORDS_PER_STAGE;
    stageEl.textContent = `${stageLabel()} (${progress}/${WORDS_PER_STAGE})`;
  }

  // ---------- Jump / landing ----------
  function landOnPlatform(index) {
    const p = platforms[index] || platforms[platforms.length - 1];
    ball.targetX = p.x;
    ball.targetY = p.y - (platformH / 2 + ball.radius);
  }

  function jumpUpOneStep() {
    stepIndex += 1;
    landOnPlatform(stepIndex);
    ball.vy = -650;
    ball.squash = 1;
  }

  // ---------- Input ----------
  function normalizeGeorgian(s) {
    return (s || "").trim().replace(/\s+/g, "");
  }

  function onSubmitWord() {
    const typed = normalizeGeorgian(inputEl.value);
    const target = normalizeGeorgian(currentWord);
    if (!typed) return;

    if (typed === target) {
      const elapsedSec = (performance.now() - wordStartTime) / 1000;

      let gained = 50;
      if (elapsedSec > 10) gained = Math.round(50 * (10 / elapsedSec));
      gained = Math.max(10, gained);

      score += gained;
      correctCount += 1;

      jumpUpOneStep();
      setStatus(`სწორია! +${gained} 🟢`, "good");

      updateStageIfNeeded();
      pickNewWord();
    } else {
      score -= 10;
      setStatus("არასწორია… −10 🔴 (გაგრძელე!)", "bad");
    }

    scoreEl.textContent = String(score);
    correctEl.textContent = String(correctCount);
    inputEl.value = "";
  }

  // ---------- Drawing ----------
  function drawBackground(rectW, rectH, camY) {
    if (stageIndex === 0) {
      const sky = ctx.createLinearGradient(0, 0, 0, rectH);
      sky.addColorStop(0, "#7be3ff");
      sky.addColorStop(0.55, "#b7f2ff");
      sky.addColorStop(0.56, "#54d97d");
      sky.addColorStop(1, "#1c8a46");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, rectW, rectH);

      ctx.beginPath();
      ctx.arc(rectW * 0.85, rectH * 0.17, 42, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,220,90,0.95)";
      ctx.fill();

      for (const f of decor.garden) {
        const yy = f.y;
        ctx.beginPath();
        ctx.arc(f.x, yy, f.r, 0, Math.PI * 2);
        const hue = (Math.sin(f.t) * 60 + 320);
        ctx.fillStyle = `hsla(${hue}, 90%, 70%, 0.85)`;
        ctx.fill();
      }

      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 7; i++) {
        const cx = (i * 170 + (camY * 0.02)) % (rectW + 200) - 100;
        const cy = 70 + i * 22;
        drawCloud(cx, cy, 42);
      }
      ctx.globalAlpha = 1;
      return;
    }

    if (stageIndex === 1) {
      const g = ctx.createLinearGradient(0, 0, 0, rectH);
      g.addColorStop(0, "#58a6ff");
      g.addColorStop(0.55, "#a7ddff");
      g.addColorStop(1, "#eaf7ff");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, rectW, rectH);

      ctx.globalAlpha = 0.85;
      for (const c of decor.clouds) {
        const x = (c.x + (performance.now() / 1000) * c.s * c.dx) % (rectW + 200) - 100;
        const y = c.y - camY * 0.25;
        drawCloud(x, y, c.r);
      }
      ctx.globalAlpha = 1;

      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.arc(rectW * 0.2, rectH * 0.25, 170, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    const s = ctx.createLinearGradient(0, 0, 0, rectH);
    s.addColorStop(0, "#05051b");
    s.addColorStop(0.45, "#0b1440");
    s.addColorStop(1, "#14031d");
    ctx.fillStyle = s;
    ctx.fillRect(0, 0, rectW, rectH);

    for (const st of decor.stars) {
      const y = st.y - camY * 0.35;
      if (y < -50 || y > rectH + 50) continue;
      const tw = 0.6 + 0.4 * Math.sin((performance.now() / 1000) * st.tw + st.x * 0.01);
      ctx.globalAlpha = tw;
      ctx.beginPath();
      ctx.arc(st.x, y, st.r, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.arc(rectW * 0.8, rectH * 0.25, 54, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,120,220,0.85)";
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(rectW * 0.78, rectH * 0.23, 18, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawCloud(x, y, r) {
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
    ctx.arc(x + r * 0.55, y - r * 0.25, r * 0.7, 0, Math.PI * 2);
    ctx.arc(x + r * 1.25, y, r * 0.55, 0, Math.PI * 2);
    ctx.arc(x + r * 0.65, y + r * 0.22, r * 0.8, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  }

  function drawPlatform(p, screenY) {
    const hue = (p.y * -0.4) % 360;
    ctx.fillStyle = `hsla(${hue}, 90%, 65%, 0.95)`;
    roundRect(p.x - p.w / 2, screenY - p.h / 2, p.w, p.h, 8);
    ctx.fill();

    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#ffffff";
    roundRect(p.x - p.w / 2, screenY - p.h / 2, p.w, 4, 8);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  // ✅ Canvas-ზე დახატული ფეხბურთის ბურთი (emoji-ს გარეშე)
  function drawSoccerBall(x, y, r, squash) {
    const sx = 1 + squash * 0.18;
    const sy = 1 - squash * 0.12;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);

    // ჩრდილი
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.ellipse(0, r + 14, r * 0.95, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.globalAlpha = 1;

    // ბურთის ძირი
    const base = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.2, 0, 0, r * 1.2);
    base.addColorStop(0, "#ffffff");
    base.addColorStop(1, "#dfe6f2");
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // კონტური
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.stroke();

    // შუა შავი პანელი (ჰექსაგონი იმიტაციით)
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI * 2 * i) / 6 - Math.PI / 6;
      const px = Math.cos(ang) * (r * 0.25);
      const py = Math.sin(ang) * (r * 0.25);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // გარშემო 5 პანელი
    for (let i = 0; i < 5; i++) {
      const ang = (Math.PI * 2 * i) / 5;
      const px = Math.cos(ang) * (r * 0.55);
      const py = Math.sin(ang) * (r * 0.55);
      ctx.beginPath();
      ctx.arc(px, py, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }

    // ნათება
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-r * 0.28, -r * 0.32, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function drawBall(screenX, screenY) {
    const squash = clamp(ball.squash, 0, 1);
    drawSoccerBall(screenX, screenY, ball.radius, squash);
  }

  // ---------- Update / Render ----------
  let lastT = performance.now();

  function update(dt) {
    const now = performance.now();

    if (now >= nextWordAt) {
      pickNewWord();
      setStatus("ახალი სიტყვა ✨", "");
    }

    const msLeft = Math.max(0, nextWordAt - now);
    timerTextEl.textContent = `შემდეგი სიტყვა: ${(msLeft / 1000).toFixed(1)}წმ`;

    const gravity = 1300;
    ball.vy += gravity * dt;

    const dy = ball.targetY - ball.y;
    ball.vy += dy * 10 * dt;

    ball.y += ball.vy * dt;
    ball.vy *= Math.pow(0.88, dt * 60);

    ball.squash *= Math.pow(0.80, dt * 60);

    ball.x += (ball.targetX - ball.x) * (1 - Math.pow(0.85, dt * 60));

    const rectH = canvas.getBoundingClientRect().height;
    const desiredCam = ball.y - rectH * 0.70;
    cameraY += (desiredCam - cameraY) * (1 - Math.pow(0.85, dt * 60));
  }

  function render() {
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    drawBackground(w, h, cameraY);

    const yOffset = h * 0.85;

    for (const p of platforms) {
      const screenY = (p.y - cameraY) + yOffset;
      if (screenY < -80 || screenY > h + 80) continue;
      drawPlatform(p, screenY);
    }

    const ballScreenY = (ball.y - cameraY) + yOffset;
    drawBall(ball.x, ballScreenY);
  }

  function loop() {
    const now = performance.now();
    const dt = clamp((now - lastT) / 1000, 0, 0.033);
    lastT = now;

    update(dt);
    render();

    requestAnimationFrame(loop);
  }

  // ---------- Controls ----------
  function setSpeedFromSlider() {
    secondsPerWord = parseFloat(speedSlider.value);
    speedValueEl.textContent = `${secondsPerWord.toFixed(1)} წამი`;
    nextWordAt = performance.now() + secondsPerWord * 1000;
    wordStartTime = performance.now();
  }

  function restartGame() {
    score = 0;
    correctCount = 0;
    stageIndex = 0;
    stepIndex = 0;

    scoreEl.textContent = "0";
    correctEl.textContent = "0";

    makePlatforms();
    makeDecor();

    // start on first platform
    landOnPlatform(0);
    ball.x = ball.targetX;
    ball.y = ball.targetY;
    ball.vy = 0;
    ball.squash = 0;
    cameraY = 0;

    pickNewWord();
    updateStageIfNeeded();

    inputEl.value = "";
    inputEl.focus();
    setStatus("თამაში თავიდან დაიწყო ✅", "good");
  }

  // ---------- Events ----------
  window.addEventListener("resize", () => {
    resizeCanvas();
    makePlatforms();
    makeDecor();
    // keep ball aligned
    landOnPlatform(stepIndex);
  });

  speedSlider.addEventListener("input", setSpeedFromSlider);

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") onSubmitWord();
  });

  restartBtn.addEventListener("click", restartGame);

  // ---------- Boot ----------
  function boot() {
    resizeCanvas();
    makePlatforms();
    makeDecor();
    setSpeedFromSlider();
    restartGame();

    lastT = performance.now();
    requestAnimationFrame(loop);
  }

  boot();
})();
