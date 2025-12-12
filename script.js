/* =========================================================
   ქართული ტაიპინგ თამაში — Vanilla JS
   - ბურთი ხტება ზემოთ ყოველ სწორად აკრეფილ სიტყვაზე
   - ქულა: +50 / -10
   - სიტყვები იცვლება სიჩქარის სლაიდერის მიხედვით
   - ყოველ 500 სწორად სიტყვაზე იცვლება გარემო (Stage)
   - Canvas-ზე ფერადი ვიზუალი (ეზო/ღრუბლები/კოსმოსი)
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
    "ატამი","ბანანი","ყურძენი","თაფლი","თევზი","ბურთი","ხტომა","სირბილი","სიჩქარე","ლამაზი"
  ];

  // ---------- Game state ----------
  const STAGES = [
    { id: 1, name: "ეზო", label: "1 / ეზო" },
    { id: 2, name: "ღრუბლები", label: "2 / ღრუბლები" },
    { id: 3, name: "კოსმოსი", label: "3 / კოსმოსი" }
  ];

  let score = 0;
  let correctCount = 0;

  // stageIndex: 0..2
  let stageIndex = 0;

  // word timer
  let secondsPerWord = parseFloat(speedSlider.value); // 1..6
  let nextWordAt = performance.now() + secondsPerWord * 1000;

  // current word
  let currentWord = "";

  // ---------- World / physics ----------
  const stepHeight = 46;              // რამდენით ადის ბურთი თითო სწორად სიტყვაზე
  const platformW = 140;
  const platformH = 14;

  // "world" Y: რაც უფრო პატარაა, მით უფრო მაღლაა
  let ball = {
    x: 0,
    y: 0,
    radius: 20,
    vy: 0,
    targetY: 0,
    squash: 0
  };

  // კამერა მიყვება ბურთს
  let cameraY = 0;

  // პლატფორმები (ტოტები)
  let platforms = [];

  // დეკორი (ღრუბლები/ვარსკვლავები)
  let decor = {
    clouds: [],
    stars: [],
    garden: []
  };

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

    // center ball x based on canvas width
    ball.x = rect.width * 0.5;
  }

  // ---------- Initialize world ----------
  function makePlatforms() {
    platforms = [];
    // base platform near bottom
    const baseY = 0;
    for (let i = 0; i < 260; i++) {
      const y = baseY - i * stepHeight;

      // პლატფორმის X ოდნავ მარცხნივ-მარჯვნივ იცვლება, მაგრამ ბავშვურად მარტივად
      const wiggle = Math.sin(i * 0.6) * 120 + rand(-30, 30);
      const x = (canvas.getBoundingClientRect().width * 0.5) + wiggle;

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

    // ეზოს დეკორი (Stage 1) — პატარა ყვავილები/წერტილები
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
    // რომ ერთიდაიგივე ზედიზედ არ დაემთხვეს
    if (w === currentWord && WORDS.length > 1) w = choice(WORDS);
    currentWord = w;
    wordEl.textContent = currentWord;
    nextWordAt = performance.now() + secondsPerWord * 1000;
  }

  // ---------- Stage logic ----------
  function updateStageIfNeeded() {
    // ყოველ 500 სწორად სიტყვაზე — Stage იცვლება (1->2->3 და შემდეგ დარჩება 3-ზე)
    if (correctCount > 0 && correctCount % 500 === 0) {
      stageIndex = Math.min(stageIndex + 1, 2);
      stageEl.textContent = stageLabel();
      setStatus(`Stage შეიცვალა: ${STAGES[stageIndex].name}! 🚀`, "good");
    } else {
      stageEl.textContent = stageLabel();
    }
  }

  // ---------- Jump logic ----------
  function jumpUpOneStep() {
    // ახალ სამიზნე Y (უფრო მაღლა)
    ball.targetY -= stepHeight;

    // "ხტომის" შეგრძნება
    ball.vy = -420;           // საწყისი "ბიძგი"
    ball.squash = 1;          // პატარა "სქვაში"
  }

  // ---------- Input handling ----------
  function normalizeGeorgian(s) {
    return (s || "")
      .trim()
      .replace(/\s+/g, ""); // თუ შემთხვევით გამოტოვა/ჩასვა სივრცეები
  }

  function onSubmitWord() {
    const typed = normalizeGeorgian(inputEl.value);
    const target = normalizeGeorgian(currentWord);

    if (!typed) return;

    if (typed === target) {
      score += 50;
      correctCount += 1;

      jumpUpOneStep();
      setStatus("სწორია! +50 🟢", "good");

      updateStageIfNeeded();
      pickNewWord();
    } else {
      score -= 10;
      setStatus("არასწორია… −10 🔴 (გაგრძელე!)", "bad");
      // არ ვასრულებთ თამაშს — უბრალოდ ვაგრძელებთ
    }

    scoreEl.textContent = String(score);
    correctEl.textContent = String(correctCount);
    inputEl.value = "";
  }

  // ---------- Drawing helpers ----------
  function drawBackground(rectW, rectH, camY) {
    // Stage-based gradient background
    if (stageIndex === 0) {
      // ეზო — ცა + მწვანე ბალახი
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

      // პატარა ფერადი ყვავილები
      for (const f of decor.garden) {
        const yy = f.y; // ეკრანზე ქვედა მხარეს
        ctx.beginPath();
        ctx.arc(f.x, yy, f.r, 0, Math.PI * 2);
        // ფერები არ ვფიქსირებთ ერთ ფერში — random-ish მაგრამ სტაბილურია
        const hue = (Math.sin(f.t) * 60 + 320);
        ctx.fillStyle = `hsla(${hue}, 90%, 70%, 0.85)`;
        ctx.fill();
      }

      // მსუბუქი ღრუბლები ფონზე
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

      // დიდი ღრუბლები ნელა მოძრაობენ
      ctx.globalAlpha = 0.85;
      for (const c of decor.clouds) {
        const x = (c.x + (performance.now() / 1000) * c.s * c.dx) % (rectW + 200) - 100;
        const y = c.y - camY * 0.25;
        drawCloud(x, y, c.r);
      }
      ctx.globalAlpha = 1;

      // პატარა ცის ნათება
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

    // ვარსკვლავები (კამერასთან ერთად ოდნავ პარალაქსი)
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
    // ფერადი პლატფორმები
    const hue = (p.y * -0.4) % 360;
    ctx.fillStyle = `hsla(${hue}, 90%, 65%, 0.95)`;
    roundRect(p.x - p.w / 2, screenY - p.h / 2, p.w, p.h, 8);
    ctx.fill();

    // highlight
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

  function drawBall(screenX, screenY) {
    // პატარა "squash & stretch"
    const squash = clamp(ball.squash, 0, 1);
    const sx = 1 + squash * 0.25;
    const sy = 1 - squash * 0.18;

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.scale(sx, sy);

    // ბურთი (გრადიენტით)
    const grd = ctx.createRadialGradient(-6, -8, 6, 2, 4, 24);
    grd.addColorStop(0, "#ffffff");
    grd.addColorStop(0.22, "#ffe36a");
    grd.addColorStop(0.6, "#ff5fd7");
    grd.addColorStop(1, "#39d0ff");
    ctx.fillStyle = grd;

    ctx.beginPath();
    ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    // outline glow
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.restore();

    // ჩრდილი (მიწაზე/პლატფორმაზე)
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + 20, 18, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#000000";
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---------- Update / Render ----------
  let lastT = performance.now();

  function update(dt) {
    // timer for word rotation
    const now = performance.now();
    if (now >= nextWordAt) {
      pickNewWord(); // უბრალოდ იცვლება სიტყვა, ჯარიმის გარეშე
      setStatus("ახალი სიტყვა ✨", "");
    }

    // UI timer text
    const msLeft = Math.max(0, nextWordAt - now);
    timerTextEl.textContent = `შემდეგი სიტყვა: ${(msLeft / 1000).toFixed(1)}წმ`;

    // ball physics
    // მარტივი "სიმძიმე"
    const gravity = 1200;

    ball.vy += gravity * dt;

    // მივყვებით targetY-ს (გლუვი)
    // თუ targetY ზემოთ არის, ბურთს "დასამიზნებლად" ვაჩქარებთ
    const dy = ball.targetY - ball.y;
    // spring-like
    ball.vy += dy * 14 * dt;

    ball.y += ball.vy * dt;

    // არ გადავაჭარბოთ ზედმეტ ბაუნსს — ოდნავ დამშვიდება
    ball.vy *= Math.pow(0.92, dt * 60);

    // squash decay
    ball.squash *= Math.pow(0.80, dt * 60);

    // camera follow (keep ball around 55% height)
    const rectH = canvas.getBoundingClientRect().height;
    const desiredCam = ball.y - rectH * 0.70;
    cameraY += (desiredCam - cameraY) * (1 - Math.pow(0.85, dt * 60));
  }

  function render() {
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    // background depends on stage
    drawBackground(w, h, cameraY);

    // platforms (draw only visible)
    for (const p of platforms) {
      const screenY = (p.y - cameraY) + h * 0.85; // world->screen
      if (screenY < -60 || screenY > h + 60) continue;
      drawPlatform(p, screenY);
    }

    // ball
    const ballScreenY = (ball.y - cameraY);
    drawBall(ball.x, ballScreenY);
  }

  function loop() {
    const now = performance.now();
    const dt = clamp((now - lastT) / 1000, 0, 0.033); // max ~30fps step
    lastT = now;

    update(dt);
    render();

    requestAnimationFrame(loop);
  }

  // ---------- Game controls ----------
  function setSpeedFromSlider() {
    secondsPerWord = parseFloat(speedSlider.value);
    speedValueEl.textContent = `${secondsPerWord.toFixed(1)} წამი`;
    // რომ ცვლილება მაშინვე იგრძნოს
    nextWordAt = performance.now() + secondsPerWord * 1000;
  }

  function restartGame() {
    score = 0;
    correctCount = 0;
    stageIndex = 0;

    scoreEl.textContent = "0";
    correctEl.textContent = "0";
    stageEl.textContent = stageLabel();

    // ball start
    ball.y = 0;
    ball.targetY = 0;
    ball.vy = 0;
    ball.squash = 0;
    cameraY = 0;

    makePlatforms();
    makeDecor();
    pickNewWord();
    inputEl.value = "";
    inputEl.focus();
    setStatus("თამაში თავიდან დაიწყო ✅", "good");
  }

  // ---------- Events ----------
  window.addEventListener("resize", () => {
    resizeCanvas();
    makeDecor(); // resize-ზე დეკორიც ახლიდან
  });

  speedSlider.addEventListener("input", setSpeedFromSlider);

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      onSubmitWord();
    }
  });

  restartBtn.addEventListener("click", restartGame);

  // ---------- Boot ----------
  function boot() {
    resizeCanvas();
    makePlatforms();
    makeDecor();
    setSpeedFromSlider();
    pickNewWord();

    stageEl.textContent = stageLabel();
    scoreEl.textContent = String(score);
    correctEl.textContent = String(correctCount);

    inputEl.focus();
    setStatus("მზადაა! დაიწყე აკრეფა 🙂", "good");

    lastT = performance.now();
    requestAnimationFrame(loop);
  }

  boot();
})();


