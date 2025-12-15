(() => {
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

  const keyboardKeysEl = document.getElementById("keyboardKeys");

  const WORDS = [
    "მზე","ცა","ბურთი","სკოლა","თამაში","ბაღი","წყალი","ხე","სახლი","ბავშვი",
    "კატა","ძაღლი","ყვავილი","ფოთოლი","თოვლი","წვიმა","ქარი","ზღვა","მდინარე","მთა",
    "წიგნი","ფანქარი","მეგობარი","სიყვარული","სიხარული","ღიმილი","სურათი","ფერადი","მუსიკა","ცეკვა",
    "კიდე","კიბე","კარი","ფანჯარა","თეფში","კოვზი","ჩანგალი","რძე","პური","ვაშლი",
    "ატამი","ბანანი","ყურძენი","თაფლი","თევზი","ხტომა","სირბილი","სიჩქარე","ლამაზი"
  ];

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

  const stepHeight = 80;
  const platformW = 150;
  const platformH = 14;

  let stepIndex = 0;
  let cameraY = 0;
  let platforms = [];

  const ball = {
    x: 0,
    y: 0,
    radius: 20,
    vy: 0,
    targetY: 0,
    targetX: 0,
    squash: 0
  };

  // --- keyboard ---
  const KBD_LAYOUT = [
    ["ქ","წ","ე","რ","ტ","ყ","უ","ი","ო","პ"],
    ["ა","ს","დ","ფ","გ","ჰ","ჯ","კ","ლ"],
    ["ზ","ხ","ც","ვ","ბ","ნ","მ","შ","ჩ"],
    ["space","backspace","enter"]
  ];
  const keyMap = new Map();
  let pressedKeyEl = null;

  // --- utils ---
  const rand = (a,b)=>Math.random()*(b-a)+a;
  const choice = (arr)=>arr[(Math.random()*arr.length)|0];
  const clamp = (v,a,b)=>Math.max(a, Math.min(b,v));

  const normalize = (s)=>(s||"").trim().replace(/\s+/g,"");

  function setStatus(text, type){
    statusMsgEl.textContent = text;
    statusMsgEl.classList.remove("good","bad");
    if(type) statusMsgEl.classList.add(type);
  }
  function stageLabel(){ return STAGES[stageIndex].label; }

  // --- canvas ---
  function resizeCanvas(){
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width*dpr);
    canvas.height = Math.floor(rect.height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    if(!Number.isFinite(ball.x) || ball.x===0){
      ball.x = rect.width*0.5;
      ball.targetX = ball.x;
    }
  }

  // --- platforms ---
  function makePlatforms(){
    platforms = [];
    const baseY = 0;
    const centerX = canvas.getBoundingClientRect().width*0.5;
    for(let i=0;i<360;i++){
      const y = baseY - i*stepHeight;
      const wiggle = Math.sin(i*0.6)*150 + rand(-35,35);
      const x = centerX + wiggle;
      platforms.push({x,y,w:platformW,h:platformH});
    }
  }

  function landOnPlatform(i){
    const p = platforms[i] || platforms[platforms.length-1];
    ball.targetX = p.x;
    ball.targetY = p.y - (platformH/2 + ball.radius);
  }

  function jumpUpOneStep(){
    stepIndex += 1;
    landOnPlatform(stepIndex);
    ball.vy = -650;
    ball.squash = 1;
  }

  // --- keyboard UI ---
  function buildKeyboard(){
    keyboardKeysEl.innerHTML = "";
    keyMap.clear();

    for(const row of KBD_LAYOUT){
      const rowEl = document.createElement("div");
      rowEl.className = "kbd-row";

      for(const key of row){
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "kbd-key";
        btn.dataset.key = key;

        if(key==="space"){ btn.classList.add("space"); btn.textContent="Space"; }
        else if(key==="backspace"){ btn.classList.add("wide"); btn.textContent="⌫"; }
        else if(key==="enter"){ btn.classList.add("wide"); btn.textContent="Enter"; }
        else { btn.textContent = key; keyMap.set(key, btn); }

        btn.addEventListener("click", ()=>{
          inputEl.focus();
          if(key==="space") inputEl.value += " ";
          else if(key==="backspace") inputEl.value = inputEl.value.slice(0,-1);
          else if(key==="enter"){ onSubmitWord(); return; }
          else inputEl.value += key;

          flashPressed(btn);
          updateKeyboardHint();
        });

        rowEl.appendChild(btn);
      }

      keyboardKeysEl.appendChild(rowEl);
    }
  }

  function flashPressed(el){
    if(pressedKeyEl) pressedKeyEl.classList.remove("pressed");
    pressedKeyEl = el;
    el.classList.add("pressed");
    setTimeout(()=>el.classList.remove("pressed"), 140);
  }

  function clearActive(){
    for(const el of keyMap.values()) el.classList.remove("active");
  }

  function updateKeyboardHint(){
    clearActive();
    const typed = normalize(inputEl.value);
    const target = normalize(currentWord);
    let nextChar = "";
    for(let i=0;i<target.length;i++){
      if(typed[i] !== target[i]) { nextChar = target[i]; break; }
    }
    if(nextChar && keyMap.has(nextChar)){
      keyMap.get(nextChar).classList.add("active");
    }
  }

  // --- word logic ---
  function pickNewWord(){
    let w = choice(WORDS);
    if(w===currentWord && WORDS.length>1) w = choice(WORDS);

    currentWord = w;
    wordEl.textContent = currentWord;

    nextWordAt = performance.now() + secondsPerWord*1000;
    wordStartTime = performance.now();

    updateKeyboardHint();
  }

  function updateStageIfNeeded(){
    const targetStage = Math.min(Math.floor(correctCount/WORDS_PER_STAGE), 2);
    if(targetStage !== stageIndex){
      stageIndex = targetStage;
      setStatus(`Stage შეიცვალა: ${STAGES[stageIndex].name}! 🚀`, "good");
    }
    const progress = correctCount % WORDS_PER_STAGE;
    stageEl.textContent = `${stageLabel()} (${progress}/${WORDS_PER_STAGE})`;
  }

  // --- scoring + submit ---
  function onSubmitWord(){
    const typed = normalize(inputEl.value);
    const target = normalize(currentWord);
    if(!typed) return;

    if(typed === target){
      const elapsedSec = (performance.now()-wordStartTime)/1000;
      let gained = 50;
      if(elapsedSec > 10) gained = Math.round(50*(10/elapsedSec));
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
    updateKeyboardHint();
  }

  // --- drawing helpers ---
  function roundRect(x,y,w,h,r){
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr,y);
    ctx.arcTo(x+w,y,x+w,y+h,rr);
    ctx.arcTo(x+w,y+h,x,y+h,rr);
    ctx.arcTo(x,y+h,x,y,rr);
    ctx.arcTo(x,y,x+w,y,rr);
    ctx.closePath();
  }

  function drawPlatform(p, screenY){
    const hue = (p.y * -0.4) % 360;
    ctx.fillStyle = `hsla(${hue}, 90%, 65%, 0.95)`;
    roundRect(p.x - p.w/2, screenY - p.h/2, p.w, p.h, 8);
    ctx.fill();

    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#fff";
    roundRect(p.x - p.w/2, screenY - p.h/2, p.w, 4, 8);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawSoccerBall(x,y,r,squash){
    const sx = 1 + squash*0.18;
    const sy = 1 - squash*0.12;

    ctx.save();
    ctx.translate(x,y);
    ctx.scale(sx,sy);

    const base = ctx.createRadialGradient(-r*0.25,-r*0.25,r*0.2, 0,0,r*1.2);
    base.addColorStop(0,"#fff");
    base.addColorStop(1,"#dfe6f2");
    ctx.fillStyle = base;
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.stroke();

    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.beginPath();
    for(let i=0;i<6;i++){
      const ang = (Math.PI*2*i)/6 - Math.PI/6;
      const px = Math.cos(ang)*(r*0.25);
      const py = Math.sin(ang)*(r*0.25);
      if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
    }
    ctx.closePath(); ctx.fill();

    for(let i=0;i<5;i++){
      const ang = (Math.PI*2*i)/5;
      const px = Math.cos(ang)*(r*0.58);
      const py = Math.sin(ang)*(r*0.58);
      ctx.beginPath(); ctx.arc(px,py,r*0.18,0,Math.PI*2); ctx.fill();
    }

    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(-r*0.28,-r*0.32,r*0.28,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function drawBackground(w,h){
    if(stageIndex===0){
      const g = ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,"#7be3ff");
      g.addColorStop(0.55,"#b7f2ff");
      g.addColorStop(0.56,"#54d97d");
      g.addColorStop(1,"#1c8a46");
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      ctx.beginPath(); ctx.arc(w*0.85,h*0.17,42,0,Math.PI*2);
      ctx.fillStyle="rgba(255,220,90,0.95)"; ctx.fill();
      return;
    }
    if(stageIndex===1){
      const g = ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,"#58a6ff");
      g.addColorStop(0.55,"#a7ddff");
      g.addColorStop(1,"#eaf7ff");
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      return;
    }
    const g = ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0,"#05051b");
    g.addColorStop(0.45,"#0b1440");
    g.addColorStop(1,"#14031d");
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  }

  // --- loop ---
  let lastT = performance.now();

  function update(dt){
    const now = performance.now();

    if(now >= nextWordAt){
      pickNewWord();
      setStatus("ახალი სიტყვა ✨","");
    }

    const msLeft = Math.max(0, nextWordAt-now);
    timerTextEl.textContent = `შემდეგი სიტყვა: ${(msLeft/1000).toFixed(1)}წმ`;

    const gravity = 1300;
    ball.vy += gravity*dt;

    const dy = ball.targetY - ball.y;
    ball.vy += dy*10*dt;

    ball.y += ball.vy*dt;
    ball.vy *= Math.pow(0.88, dt*60);

    ball.squash *= Math.pow(0.80, dt*60);
    ball.x += (ball.targetX-ball.x)*(1 - Math.pow(0.85, dt*60));

    // ✅ FIX: camera follows WITH yOffset
    const rectH = canvas.getBoundingClientRect().height;
    const yOffset = rectH*0.85;
    const desiredCam = (ball.y + yOffset) - rectH*0.70;
    cameraY += (desiredCam-cameraY)*(1 - Math.pow(0.85, dt*60));
  }

  function render(){
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    ctx.clearRect(0,0,w,h);

    drawBackground(w,h);

    const yOffset = h*0.85;

    for(const p of platforms){
      const sy = (p.y - cameraY) + yOffset;
      if(sy < -80 || sy > h+80) continue;
      drawPlatform(p, sy);
    }

    const ballSY = (ball.y - cameraY) + yOffset;
    drawSoccerBall(ball.x, ballSY, ball.radius, clamp(ball.squash,0,1));
  }

  function loop(){
    const now = performance.now();
    const dt = clamp((now-lastT)/1000, 0, 0.033);
    lastT = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  // --- controls ---
  function setSpeedFromSlider(){
    secondsPerWord = parseFloat(speedSlider.value);
    speedValueEl.textContent = `${secondsPerWord.toFixed(0)} წამი`;
    nextWordAt = performance.now() + secondsPerWord*1000;
    wordStartTime = performance.now();
  }

  function restartGame(){
    score=0; correctCount=0; stageIndex=0; stepIndex=0;
    scoreEl.textContent="0";
    correctEl.textContent="0";

    makePlatforms();
    landOnPlatform(0);
    ball.x = ball.targetX;
    ball.y = ball.targetY;
    ball.vy = 0;
    ball.squash = 0;
    cameraY = 0;

    pickNewWord();
    updateStageIfNeeded();

    inputEl.value="";
    inputEl.focus();
    setStatus("მზადაა! დაიწყე აკრეფა 🙂","good");
  }

  // --- events ---
  window.addEventListener("resize", ()=>{
    resizeCanvas();
    makePlatforms();
    landOnPlatform(stepIndex);
  });

  speedSlider.addEventListener("input", setSpeedFromSlider);

  inputEl.addEventListener("keydown", (e)=>{
    if(e.key==="Enter") onSubmitWord();
  });
  inputEl.addEventListener("input", updateKeyboardHint);

  restartBtn.addEventListener("click", restartGame);

  // --- boot ---
  function boot(){
    resizeCanvas();
    makePlatforms();
    setSpeedFromSlider();
    buildKeyboard();
    restartGame();
    requestAnimationFrame(loop);
  }
  boot();
})();
