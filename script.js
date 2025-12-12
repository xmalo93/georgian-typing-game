/* =========================================================
   ქართული ტაიპინგ თამაში — Vanilla JS
   გაუმჯობესებები:
   - მთავარი გმირი: ⚽ (ლოგოს მსგავსი ბურთი)
   - ბურთი ხტება და "დგება" პლატფორმაზე (ჯოხზე)
   - ქულა დროის მიხედვით იკლებს: 10წმ-მდე 50, მერე პროპორციულად, მინ 10
   - Stage იცვლება სწორად აკრეფილი სიტყვების რაოდენობით (ყოველ 500-ზე)
   - Stage-ზე ჩანს პროგრესი: (მაგ: 60/500)
   - Canvas კოორდინატები გასწორებულია (ბურთი და ზოლები ერთ სისტემაშია)
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

  // ---------- Words (ქართული, მარტივი) ----------
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

  const WORDS_PER_STAGE = 500; // Stage იცვლება ყოველ 500 სწორ სიტყვაზე

  let score = 0;
  let correctCount = 0;
  let stageIndex = 0; // 0..2

  // word timer
  let secondsPerWord = parseFloat(speedSlider.value); // UI-ში გირჩევ: min=6, max=15
  let nextWordAt = performance.now() + secondsPerWord * 1000;

  // current word + time tracking
  let currentWord = "";
  let wordStartTime = performance.now();

  // ---------- World / physics ----------
  const stepHeight = 80;     // ზოლებს შორის დაშორება
  const platformW = 140;
  const platformH = 14;

  let stepIndex = 0;         // რომელ პლატფორმაზეა ბურთი (0-დან)

  let ball = {
    x: 0,
    y: 0,
    radius: 20,
    vy: 0,
    targetY: 0,
    targetX: 0,
    squash: 0
  };

  // კამერა მიყვება ბურთს
  let cameraY = 0;

  // პლატფორმები (ზოლები)
  let platforms = [];

  // დეკორი
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

  function stageLabel() {
    return STAGES[stageIndex].label;
  }

  // ---------- Resize ----------
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---------- Initialize world ----------
  function makePlatforms() {
    platforms = [];
    const baseY = 0;
    const centerX = canvas.getBoundingClientRect().width * 0.5;

    for (let i = 0; i < 340; i++) {
      const y = baseY - i * stepHeight;

      // რბილი ზიგზაგი
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

    // ღრუბლები (Stage 2)
    for (let i = 0; i < 18; i++) {
      decor.clouds.push({
        x: rand(0, w),
        y: rand(-h * 2, h),
        r: rand(22, 55),
        s: rand(0.15, 0.35),
        dx: rand(5, 18)
      });
    }

    // ვარსკვლავები (Stage 3)
    for (let i = 0; i < 160; i++) {
      decor.stars.push({
        x: rand(0, w),
        y: rand(-h * 3, h),
        r: rand(0.8, 2.2),
        tw: rand(0.5, 1.6)
      });
    }

    // ეზოს დეკორი (Stage 1)
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

  // ---------- Jump logic (LAND ON PLATFORM) ----------
  function jumpUpOneStep() {
    stepIndex += 1;

    const p = platforms[stepIndex] || platforms[platforms.length - 1];

    // ბურთი პლატფორმაზე "ზედ" დგება
    ball.targetY = p.y - (platformH / 2 + ball.radius);

    // X ზუსტად პლატფორმის ცენტრში
    ball.targetX = p.x;

    // ნახტომის იმპულსი
    ball.vy = -650;
    ball.squash = 1;
  }

  // ---------- Input handling ----------
  function normalizeGeorgian(s) {
    return (s || "").trim().replace(/\s+/g, "");
  }

  function onSubmitWord() {
    const typed = normalizeGeorgian(inputEl.value);
    const target = normalizeGeorgian(currentWord);
    if (!typed) return;

    if (typed === target) {
      // დრო-დამოკიდებული ქულა
      const elapsedSec = (performance.now() - wordStartTime) / 1000;

      let gained = 50; // 10 წამამდე
      if (elapsedSec > 10) gained = Math.round(50 * (10 / elapsedSec));
      gained = Math.max(10, gained); // მინ 10

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

  // ---------- Drawing helpers ----------
  function drawBackground(rectW, rectH, camY) {
    if (stageIndex === 0) {
      // ეზო
      const sky = ctx.createLinearGradient(0, 0, 0, rectH);
      sky.addColorStop(0, "#7be3ff");
      sky.addColorStop(0.55, "#b7f2ff");
      sky.addColorStop(0.56, "#54d97d");
      sky.addColorStop(1, "#1c8a46");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, rectW, rectH);

      // მზე
      ctx.beginPath();
      ctx.arc(rectW * 0.85, rectH * 0.17, 42, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,220,90,0.95)";
      ctx.fill();

      // ყვავილები
      for (const f of decor.garden) {
        const yy = f.y;
        ctx.beginPath();
        ctx.arc(f.x, yy, f.r, 0, Math.PI * 2);
        const hue = (Math.sin(f.t) * 60 + 320);
        ctx.fillStyle = `hsla(${hue}, 90%, 70%, 0.85)`;
        ctx.fill();
      }

      // მსუბუქი ღრუბლები
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
      // ღრუბლები / ცა
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

    // კოსმოსი
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

    // პლანეტა
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

  // მთავარი გმირი: ⚽ (ლოგოს მსგავსი)
  function drawBall(screenX, screenY) {
    const squash = clamp(ball.squash, 0, 1);
    const sx = 1 + squash * 0.15;
    const sy = 1 - squash * 0.10;

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.scale(sx, sy);

    // მცირე ჩრდილი
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.ellipse(0, ball.radius + 10, ball.radius * 0.9, ball.radius * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.font = `${ball.radius * 2.4}px "Noto Sans Georgian", system-ui, Apple Color Emoji, Segoe UI Emoji`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 10;
    ctx.fillText("⚽", 0, 0);

    ctx.restore();
  }

  // ---------- Update / Render ----------
  let lastT = performance.now();

  function update(dt) {
    const now = performance.now();

    // timer for word rotation
    if (now >= nextWordAt) {
      pickNewWord();
      setStatus("ახალი სიტყვა ✨", "");
    }

    // UI timer text
    const msLeft = Math.max(0, nextWordAt - now);
    timerTextEl.textContent = `შემდეგი სიტყვა: ${(msLeft / 1000).toFixed(1)}წმ`;

    // physics
    const gravity = 1300;
    ball.vy += gravity * dt;

    const dy = ball.targetY - ball.y;
    ball.vy += dy * 10 * dt;

    ball.y += ball.vy * dt;
    ball.vy *= Math.pow(0.88, dt * 60);

    ball.squash *= Math.pow(0.80, dt * 60);

    // X-ზე გლუვი მიყოლა
    ball.x += (ball.targetX - ball.x) * (1 - Math.pow(0.85, dt * 60));

    // camera follow (ბურთი იყოს ქვედა მხარეს)
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

    // ✅ ერთიანი კოორდინატები: ორივეს ერთნაირი offset
    const yOffset = h * 0.85;

    // platforms
    for (const p of platforms) {
      const screenY = (p.y - cameraY) + yOffset;
      if (screenY < -80 || screenY > h + 80) continue;
      drawPlatform(p, screenY);
    }

    // ball
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

  // ---------- Game controls ----------
  function setSpeedFromSlider() {
    secondsPerWord = parseFloat(speedSlider.value);
    speedValueEl.textContent = `${secondsPerWord.toFixed(1)} წამი`;
    nextWordAt = performance.now() + secondsPerWord * 1000;

    // ახალი სიტყვისთვის დრო თავიდან
    wordStartTime = performance.now();
  }

  function restartGame() {
    score = 0;
    correctCount = 0;
    stageIndex = 0;
    stepIndex = 0;

    scoreEl.textContent = "0";
    correctEl.textContent = "0";
    stageEl.textContent = stageLabel();

    makePlatforms();
    makeDecor();

    // ბურთი პირველ პლატფორმაზე ზემოთ "დაჯდეს"
    const p0 = platforms[0];
    ball.x = p0.x;
    ball.targetX = p0.x;

    ball.y = p0.y - (platformH / 2 + ball.radius);
    ball.targetY = ball.y;

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
    // resize-ზე ბურთი ამჟამინდელ stepIndex პლატფორმაზე გადავაბათ
    const p = platforms[stepIndex] || platforms[0];
    ball.targetX = p.x;
    ball.targetY = p.y - (platformH / 2 + ball.radius);
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

    // საწყისი მდგომარეობა
    restartGame();

    lastT = performance.now();
    requestAnimationFrame(loop);
  }

  boot();
})();
