/**
 * NEON WORM // Cyber Survival Arcade Engine
 * Full Snake / Worm Survival Game Engine with Web Audio Synthesizer,
 * Neon Canvas Effects, Target Radar, Live Survival Stopwatch, and Leaderboard.
 */

(() => {
  'use strict';

  // ==========================================
  // 1. DOM 요소 취득
  // ==========================================
  const mainCanvas = document.querySelector('#mainCanvas');
  const ctx = mainCanvas.getContext('2d');
  const radarCanvas = document.querySelector('#radarCanvas');
  const radarCtx = radarCanvas.getContext('2d');

  // HUD 텍스트 요소
  const timeDisplay = document.querySelector('#timeDisplay');
  const bestTimeDisplay = document.querySelector('#bestTimeDisplay');
  const scoreDisplay = document.querySelector('#scoreDisplay');
  const levelDisplay = document.querySelector('#levelDisplay');
  const statusMessage = document.querySelector('#statusMessage');

  // 텔레메트리
  const teleLength = document.querySelector('#teleLength');
  const teleSpeed = document.querySelector('#teleSpeed');
  const teleDist = document.querySelector('#teleDist');
  const teleApples = document.querySelector('#teleApples');
  const teleObstacles = document.querySelector('#teleObstacles');
  const teleHunter = document.querySelector('#teleHunter');

  // 랭킹 리더보드
  const rankingList = document.querySelector('#rankingList');
  const rankNotice = document.querySelector('#rankNotice');

  // 모달 오버레이
  const startScreen = document.querySelector('#startScreen');
  const startGameBtn = document.querySelector('#startGameBtn');
  const playerNameInput = document.querySelector('#playerName');
  const nameError = document.querySelector('#nameError');

  const resultScreen = document.querySelector('#resultScreen');
  const resultKicker = document.querySelector('#resultKicker');
  const resultTitle = document.querySelector('#resultTitle');
  const resultTime = document.querySelector('#resultTime');
  const resultDetails = document.querySelector('#resultDetails');
  const resultPlayerName = document.querySelector('#resultPlayerName');
  const resultNameError = document.querySelector('#resultNameError');
  const saveScoreBtn = document.querySelector('#saveScoreBtn');
  const skipScoreBtn = document.querySelector('#skipScoreBtn');

  // 제어 버튼
  const pauseBtn = document.querySelector('#pauseBtn');
  const restartBtn = document.querySelector('#restartBtn');

  // 오디오 버튼
  const bgmToggleBtn = document.querySelector('#bgmToggleBtn');
  const sfxToggleBtn = document.querySelector('#sfxToggleBtn');
  const muteAllBtn = document.querySelector('#muteAllBtn');

  // 모바일 D-PAD 버튼
  const btnMvUp = document.querySelector('#btnMvUp');
  const btnMvDown = document.querySelector('#btnMvDown');
  const btnMvLeft = document.querySelector('#btnMvLeft');
  const btnMvRight = document.querySelector('#btnMvRight');
  const btnBoost = document.querySelector('#btnBoost');

  // ==========================================
  // 2. 게임 설정 & Supabase 글로벌 랭킹 설정
  // ==========================================
  const COLS = 22;
  const ROWS = 22;
  const CELL_SIZE = mainCanvas.width / COLS; // 440 / 22 = 20px
  const STORAGE_KEY = 'neon-worm-survival-v1';
  const PLAYER_NAME_KEY = 'neon-worm-last-pilot';

  // 💡 [클라이언트 직접 연동] Supabase 대시보드 (Project Settings > API)의 URL과 anon key를 넣으면
  // Vercel 배포 없이 파일(file:///)을 더블클릭해서 실행해도 실시간 글로벌 랭킹이 100% 작동합니다!
  const SUPABASE_URL = ''; // e.g., 'https://your-project.supabase.co'
  const SUPABASE_ANON_KEY = ''; // e.g., 'eyJhbGciOiJIUzI1Ni...'
  const SUPABASE_TABLE = 'neon_worm_leaderboard';

  let directSupabase = null;
  try {
    if (
      typeof window.supabase !== 'undefined' &&
      SUPABASE_URL &&
      SUPABASE_URL.startsWith('http') &&
      !SUPABASE_URL.includes('your-project')
    ) {
      directSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('⚡ Direct Supabase connection active.');
    }
  } catch (e) {
    console.warn('Direct Supabase connection fallback:', e);
  }

  // ==========================================
  // 3. Web Audio API 신스 엔진 (BGM & SFX)
  // ==========================================
  let audioCtx = null;
  let bgmEnabled = true;
  let sfxEnabled = true;
  let isMutedAll = false;
  let bgmTimer = null;
  let bgmStep = 0;

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // 효과음 합성
  function playSound(type) {
    if (!sfxEnabled || isMutedAll) return;
    initAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    try {
      if (type === 'eat') {
        // 사과 획득: 밝은 칩튠 아르페지오 (2단계 벨소리)
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880.00, now + 0.05); // A5
        osc.frequency.setValueAtTime(1174.66, now + 0.1); // D6
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'bonus') {
        // 보너스 아이템: 크리스탈 차임
        [1046.5, 1318.5, 1567.9, 2093.0].forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.07, now + idx * 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.3);
          osc.connect(gain).connect(audioCtx.destination);
          osc.start(now + idx * 0.04);
          osc.stop(now + idx * 0.04 + 0.3);
        });
      } else if (type === 'levelup') {
        // 레벨업 / 속도 증가
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.28);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'gameover') {
        // 게임오버 폭발음
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.55);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.6);
      } else if (type === 'turn') {
        // 방향 전환 틱음
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === 'click') {
        // UI 버튼 클릭
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'alert') {
        // 장애물/위험 경고 알림음 (전자 펄스 비프)
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(587, now + 0.08);
        osc.frequency.setValueAtTime(880, now + 0.16);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'hunter_spawn') {
        // 적 헌터 뱀 침투 위협음 (사이버 워프 & 사이렌 톤)
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc1.type = 'sawtooth';
        osc2.type = 'square';
        osc1.frequency.setValueAtTime(160, now);
        osc1.frequency.exponentialRampToValueAtTime(45, now + 0.45);
        osc2.frequency.setValueAtTime(440, now);
        osc2.frequency.linearRampToValueAtTime(220, now + 0.45);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtx.destination);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.5);
        osc2.stop(now + 0.5);
      }
    } catch (e) {
      console.warn('Audio playback error', e);
    }
  }

  // 사이버펑크 8비트 아르페지오 신스 BGM 엔진
  const bgmMelody = [
    { freq: 220, type: 'sawtooth', dur: 0.12, vol: 0.02 }, // A3
    { freq: 261.63, type: 'sine', dur: 0.12, vol: 0.015 }, // C4
    { freq: 329.63, type: 'sawtooth', dur: 0.12, vol: 0.02 }, // E4
    { freq: 440, type: 'triangle', dur: 0.12, vol: 0.025 }, // A4
    { freq: 392, type: 'sine', dur: 0.12, vol: 0.015 }, // G4
    { freq: 329.63, type: 'sawtooth', dur: 0.12, vol: 0.02 }, // E4
    { freq: 293.66, type: 'triangle', dur: 0.12, vol: 0.02 }, // D4
    { freq: 329.63, type: 'sine', dur: 0.12, vol: 0.015 }, // E4
    { freq: 196, type: 'sawtooth', dur: 0.12, vol: 0.02 }, // G3
    { freq: 246.94, type: 'sine', dur: 0.12, vol: 0.015 }, // B3
    { freq: 293.66, type: 'sawtooth', dur: 0.12, vol: 0.02 }, // D4
    { freq: 392, type: 'triangle', dur: 0.12, vol: 0.025 }, // G4
    { freq: 349.23, type: 'sine', dur: 0.12, vol: 0.015 }, // F4
    { freq: 293.66, type: 'sawtooth', dur: 0.12, vol: 0.02 }, // D4
    { freq: 261.63, type: 'triangle', dur: 0.12, vol: 0.02 }, // C4
    { freq: 293.66, type: 'sine', dur: 0.12, vol: 0.015 } // D4
  ];

  function startBGM() {
    stopBGM();
    if (!bgmEnabled || isMutedAll) return;
    initAudio();
    bgmStep = 0;
    bgmTimer = setInterval(() => {
      if (!bgmEnabled || isMutedAll || !audioCtx) return;
      const note = bgmMelody[bgmStep % bgmMelody.length];
      bgmStep++;
      const now = audioCtx.currentTime;
      try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = note.type;
        osc.frequency.value = note.freq;
        gain.gain.setValueAtTime(note.vol, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + note.dur);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + note.dur);
      } catch (e) {}
    }, 150);
  }

  function stopBGM() {
    if (bgmTimer) {
      clearInterval(bgmTimer);
      bgmTimer = null;
    }
  }

  function updateAudioButtons() {
    bgmToggleBtn.textContent = `🎵 BGM ${bgmEnabled && !isMutedAll ? 'ON' : 'OFF'}`;
    bgmToggleBtn.classList.toggle('active', bgmEnabled && !isMutedAll);
    bgmToggleBtn.classList.toggle('muted', !bgmEnabled || isMutedAll);

    sfxToggleBtn.textContent = `🔊 SFX ${sfxEnabled && !isMutedAll ? 'ON' : 'OFF'}`;
    sfxToggleBtn.classList.toggle('active', sfxEnabled && !isMutedAll);
    sfxToggleBtn.classList.toggle('muted', !sfxEnabled || isMutedAll);

    muteAllBtn.textContent = isMutedAll ? '🔇 MUTED' : '🔇 MUTE ALL';
    muteAllBtn.classList.toggle('muted', isMutedAll);
  }

  // ==========================================
  // 4. 게임 상태 변수
  // ==========================================
  let snake = [];
  let direction = { x: 1, y: 0 };
  let nextDirection = { x: 1, y: 0 };
  let food = { x: 10, y: 10 };
  let bonusItem = null; // { x, y, duration, type }
  let bonusTimer = null;

  let isRunning = false;
  let isPaused = false;
  let isGameOver = false;
  let isBoosting = false;

  let score = 0;
  let applesEaten = 0;
  let hazardLevel = 1;
  let survivalStartTime = 0;
  let totalSurvivalMs = 0;
  let lastStepTime = 0;
  let personalBestMs = null;
  let currentPilotName = 'NEON_RUNNER';

  // 사이버 장애물 및 적 헌터 뱀
  let obstacles = []; // { x, y, state: 'warning' | 'solid', spawnTime }
  let lastObstacleSpawnTime = 0;

  let hunters = []; // { body: [{x,y}], dir: {x,y}, lastStepTime }
  let lastHunterSpawnTime = 0;

  // 시각 효과용
  let particles = [];
  let floatingTexts = [];
  let screenShake = 0;
  let radarAngle = 0;
  let animFrameId = null;

  // ==========================================
  // 5. 시간 포맷 유틸리티
  // ==========================================
  function formatTime(ms) {
    if (!ms || ms < 0) return '00:00.00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hundredths = Math.floor((ms % 1000) / 10);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
  }

  function getStepInterval() {
    // 기본 간격: 130ms. 레벨 및 사과 수에 따라 점점 빨라짐 (최저 45ms)
    const baseInterval = Math.max(48, 135 - (hazardLevel - 1) * 9 - Math.min(30, applesEaten * 0.8));
    return isBoosting ? Math.max(32, baseInterval * 0.55) : baseInterval;
  }

  // ==========================================
  // 6. 랭킹 시스템 (Supabase 클라우드 & 로컬 폴백)
  // ==========================================
  const DUMMY_NAMES = ['CYBER_VIPER', 'NEON_GHOST', 'SYNTH_PULSE', 'CHROME_SLICK', 'GRID_RUNNER', 'PIXEL_STORM', 'NEO_GLITCH', 'DATA_BYTE'];
  const DEFAULT_LEADERBOARD = [];

  function getLocalScores() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];
      // 가짜 더미 데이터 제거 (실제 유저 기록만 보존)
      const realOnly = parsed.filter(item => !DUMMY_NAMES.includes(item.name));
      return realOnly;
    } catch (e) {
      return [];
    }
  }

  function saveLocalScore(entry) {
    const scores = getLocalScores();
    const existingIndex = scores.findIndex(s => s.name.toUpperCase() === entry.name.toUpperCase());
    if (existingIndex !== -1) {
      if (entry.timeMs > scores[existingIndex].timeMs) {
        scores[existingIndex] = entry;
      }
    } else {
      scores.push(entry);
    }
    scores.sort((a, b) => b.timeMs - a.timeMs);
    const top10 = scores.slice(0, 10);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(top10));
    } catch (e) {}
    return top10;
  }

  async function fetchLeaderboardScores() {
    // 1. Direct Supabase Client가 설정되어 있다면 가장 먼저 시도 (file:/// 에서도 완벽 동작)
    if (directSupabase) {
      try {
        const { data, error } = await directSupabase
          .from(SUPABASE_TABLE)
          .select('name, time_ms, apples, score, hazard_level, played_at')
          .order('time_ms', { ascending: false })
          .order('apples', { ascending: false })
          .order('played_at', { ascending: true })
          .limit(10);

        if (!error && data && data.length > 0) {
          const formatted = data.map(item => ({
            name: item.name,
            timeMs: item.time_ms,
            apples: item.apples ?? 0,
            score: item.score ?? 0,
            hazardLevel: item.hazard_level ?? 1,
            date: item.played_at ? item.played_at.split('T')[0] : ''
          }));
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(formatted)); } catch (e) {}
          return formatted;
        }
      } catch (err) {
        console.warn('Direct Supabase fetch error:', err);
      }
    }

    // 2. 서버리스 API 엔드포인트 (/api/leaderboard) 호출 시도 (.env 환경변수 기반)
    try {
      const response = await fetch('/api/leaderboard', { cache: 'no-store' });
      if (response.ok) {
        const result = await response.json();
        if (result && Array.isArray(result.scores) && result.scores.length > 0) {
          const formatted = result.scores.map(item => ({
            name: item.name,
            timeMs: item.time_ms,
            apples: item.apples ?? 0,
            score: item.score ?? 0,
            hazardLevel: item.hazard_level ?? 1,
            date: item.played_at ? item.played_at.split('T')[0] : ''
          }));
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(formatted)); } catch (e) {}
          return formatted;
        }
      }
    } catch (apiErr) {
      // 로컬 파일 실행(file://) 등 API 미지원 환경 시 로컬 스토리지로 진행
    }

    return getLocalScores();
  }

  async function saveScore(entry) {
    let resultMsg = '';

    // 1. Direct Supabase Client 연동 (.upsert 및 onConflict 적용)
    if (directSupabase) {
      try {
        rankNotice.textContent = '📡 Supabase 서버에 생존 기록 동기화 중…';

        // 기존 닉네임 기록 확인
        const { data: existingUser } = await directSupabase
          .from(SUPABASE_TABLE)
          .select('time_ms')
          .ilike('name', entry.name)
          .maybeSingle();

        let status = 'inserted';
        let prevTime = existingUser ? existingUser.time_ms : 0;

        // 신규 유저이거나 이전 기록보다 높은 생존 시간일 때만 upsert 실행
        if (!existingUser || entry.timeMs > existingUser.time_ms) {
          const { error: upsertError } = await directSupabase
            .from(SUPABASE_TABLE)
            .upsert(
              {
                name: entry.name,
                time_ms: entry.timeMs,
                apples: entry.apples,
                score: entry.score,
                hazard_level: entry.hazardLevel || hazardLevel || 1,
                played_at: new Date().toISOString()
              },
              { onConflict: 'name' }
            );

          if (upsertError) throw upsertError;
          status = existingUser ? 'updated' : 'inserted';
        } else {
          status = 'kept';
        }

        if (status === 'inserted') {
          resultMsg = `🏆 ${entry.name} 파일럿 신규 랭킹 등록 완료! (${formatTime(entry.timeMs)})`;
        } else if (status === 'updated') {
          resultMsg = `🔥 ${entry.name} 파일럿 최고 생존 기록 갱신! (${formatTime(entry.timeMs)})`;
        } else {
          resultMsg = `ℹ️ ${entry.name} 파일럿의 기존 최고 기록(${formatTime(prevTime)})이 더 높아 유지되었습니다.`;
        }

        rankNotice.textContent = resultMsg;
        setTimeout(() => { rankNotice.textContent = ''; }, 4500);
        await loadAndRenderScores();
        return;
      } catch (err) {
        console.warn('Direct Supabase upsert error, falling back:', err);
      }
    }

    // 2. 서버리스 API 엔드포인트 (/api/leaderboard) 호출 시도 (Vercel 배포 환경)
    try {
      rankNotice.textContent = '📡 Supabase 서버에 생존 기록 동기화 중…';
      const response = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: entry.name,
          timeMs: entry.timeMs,
          apples: entry.apples,
          score: entry.score,
          hazardLevel: entry.hazardLevel || hazardLevel || 1
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.status === 'inserted') {
          resultMsg = `🏆 ${entry.name} 파일럿 신규 랭킹 등록 완료! (${formatTime(entry.timeMs)})`;
        } else if (result.status === 'updated') {
          resultMsg = `🔥 ${entry.name} 파일럿 최고 생존 기록 갱신! (${formatTime(entry.timeMs)})`;
        } else if (result.status === 'kept') {
          resultMsg = `ℹ️ ${entry.name} 파일럿의 기존 최고 기록(${formatTime(result.time_ms)})이 더 높아 유지되었습니다.`;
        } else {
          resultMsg = `⚡ ${entry.name} 파일럿의 기록이 Supabase에 성공적으로 저장되었습니다!`;
        }

        rankNotice.textContent = resultMsg;
        setTimeout(() => { rankNotice.textContent = ''; }, 4500);
        await loadAndRenderScores();
        return;
      }
    } catch (e) {
      // API 통신 불가 시 로컬스토리지 모드로 처리
    }

    // 3. 로컬스토리지 폴백 저장
    saveLocalScore(entry);
    resultMsg = `⚡ ${entry.name} 파일럿의 기록(${formatTime(entry.timeMs)})이 로컬에 등록되었습니다!`;
    rankNotice.textContent = resultMsg;
    setTimeout(() => { rankNotice.textContent = ''; }, 4500);
    await loadAndRenderScores();
  }

  function renderScores(scores = []) {
    rankingList.innerHTML = '';
    if (!scores || !scores.length) {
      rankingList.innerHTML = '<li class="empty">등록된 랭킹 기록이 없습니다.</li>';
      return;
    }

    scores.forEach((item, index) => {
      const isMe = currentPilotName && item.name && item.name.toUpperCase() === currentPilotName.toUpperCase();
      const li = document.createElement('li');
      li.className = isMe ? 'rank-row active-pilot' : 'rank-row';
      li.innerHTML = `
        <span class="p-name" title="${item.name}">${item.name || 'PILOT'}${isMe ? ' ◀ ME' : ''}</span>
        <span class="p-time">${formatTime(item.timeMs)}</span>
        <span class="p-apples">${item.apples ?? item.score ?? 0}</span>
      `;
      rankingList.appendChild(li);
    });
  }

  function updateBestTime(scores = []) {
    if (scores.length > 0) {
      personalBestMs = scores[0].timeMs;
      bestTimeDisplay.textContent = formatTime(personalBestMs);
    } else {
      bestTimeDisplay.textContent = '00:00.00';
    }
  }

  async function loadAndRenderScores() {
    const scores = await fetchLeaderboardScores();
    renderScores(scores);
    updateBestTime(scores);
  }

  // ==========================================
  // 7. 게임 로직 (스폰, AI, 물리 및 충돌)
  // ==========================================
  function spawnFood() {
    let newFood;
    let attempts = 0;
    do {
      newFood = {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS)
      };
      attempts++;
    } while (
      (snake.some(p => p.x === newFood.x && p.y === newFood.y) ||
       obstacles.some(o => o.x === newFood.x && o.y === newFood.y) ||
       hunters.some(h => h.body.some(p => p.x === newFood.x && p.y === newFood.y))) &&
      attempts < 200
    );

    food = newFood;
  }

  function spawnBonus() {
    if (bonusItem || Math.random() > 0.4) return;
    let bPos;
    let attempts = 0;
    do {
      bPos = {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS)
      };
      attempts++;
    } while (
      (snake.some(p => p.x === bPos.x && p.y === bPos.y) ||
       (food && food.x === bPos.x && food.y === bPos.y) ||
       obstacles.some(o => o.x === bPos.x && o.y === bPos.y) ||
       hunters.some(h => h.body.some(p => p.x === bPos.x && p.y === bPos.y))) &&
      attempts < 100
    );

    if (attempts < 100) {
      bonusItem = {
        x: bPos.x,
        y: bPos.y,
        type: Math.random() > 0.5 ? 'STAR' : 'TIME',
        expire: performance.now() + 8000
      };
    }
  }

  // --- 장애물 시스템 (Cyber Hazards) ---
  function getTargetObstacleCount() {
    if (hazardLevel < 2) return 0;
    // Lv.2 -> 2개, Lv.3 -> 4개, Lv.4 -> 6개, Lv.5 -> 8개, Lv.6+ -> 10개
    return Math.min(10, (hazardLevel - 1) * 2);
  }

  function spawnObstacle() {
    const target = getTargetObstacleCount();
    if (obstacles.length >= target) return;

    let attempts = 0;
    const head = snake[0];
    while (attempts < 120) {
      attempts++;
      const ox = Math.floor(Math.random() * (COLS - 2)) + 1;
      const oy = Math.floor(Math.random() * (ROWS - 2)) + 1;

      // 플레이어 머리에서 최소 4칸 이상 떨어져 스폰
      if (head && Math.abs(head.x - ox) + Math.abs(head.y - oy) < 4) continue;

      // 플레이어 몸통과 겹치지 않을 것
      if (snake.some(p => p.x === ox && p.y === oy)) continue;

      // 사과 및 보너스와 겹치지 않을 것
      if (food && food.x === ox && food.y === oy) continue;
      if (bonusItem && bonusItem.x === ox && bonusItem.y === oy) continue;

      // 기존 장애물과 겹치지 않을 것
      if (obstacles.some(o => o.x === ox && o.y === oy)) continue;

      // 적 헌터와 겹치지 않을 것
      if (hunters.some(h => h.body.some(p => p.x === ox && p.y === oy))) continue;

      const newObs = {
        x: ox,
        y: oy,
        state: 'warning',
        spawnTime: performance.now()
      };
      obstacles.push(newObs);
      playSound('alert');
      addFloatingText('⚠️ HAZARD WARNING', ox, oy, '#ff9f43');
      break;
    }
  }

  function updateObstacles(currentTime) {
    for (const obs of obstacles) {
      if (obs.state === 'warning' && currentTime - obs.spawnTime > 1600) {
        obs.state = 'solid';
        addParticles(obs.x, obs.y, '#ff9f43', 14);
      }
    }
  }

  // --- 적 사이버 헌터 뱀 (Rogue Hunter AI) ---
  function getTargetHunterCount() {
    if (hazardLevel < 3) return 0;
    if (hazardLevel < 6) return 1;
    return 2;
  }

  function spawnHunter() {
    const target = getTargetHunterCount();
    if (hunters.length >= target) return;

    let attempts = 0;
    const head = snake[0];
    let candidate = null;

    while (attempts < 120) {
      attempts++;
      const hx = Math.floor(Math.random() * (COLS - 4)) + 2;
      const hy = Math.floor(Math.random() * (ROWS - 4)) + 2;

      // 플레이어 머리와 최소 7칸 이상 떨어져 스폰
      if (head && Math.abs(head.x - hx) + Math.abs(head.y - hy) < 7) continue;

      // 플레이어 몸통 반경 2칸 이내 피하기
      if (snake.some(p => Math.abs(p.x - hx) <= 2 && Math.abs(p.y - hy) <= 2)) continue;

      // 사과 및 장애물 위치 피하기
      if (food && food.x === hx && food.y === hy) continue;
      if (obstacles.some(o => o.x === hx && o.y === hy)) continue;
      if (hunters.some(h => h.body.some(p => p.x === hx && p.y === hy))) continue;

      candidate = { x: hx, y: hy };
      break;
    }

    if (!candidate) return;

    // 헌터 뱀 몸통 생성 (기본 4~6마디)
    const initialLen = 4 + Math.min(3, Math.floor((hazardLevel - 3) / 2));
    const body = [];
    for (let i = 0; i < initialLen; i++) {
      body.push({ x: candidate.x, y: Math.min(ROWS - 1, candidate.y + i) });
    }

    hunters.push({
      body: body,
      dir: { x: 0, y: -1 },
      lastStepTime: performance.now()
    });

    playSound('hunter_spawn');
    screenShake = 12;
    addParticles(candidate.x, candidate.y, '#ff0055', 30);
    addFloatingText('⚠️ ROGUE HUNTER INTRUSION!', candidate.x, candidate.y, '#ff0055');
    statusMessage.textContent = '🚨 위협 경보: 적 사이버 헌터 뱀이 플레이어를 추적하기 시작합니다!';
  }

  function getHunterStepInterval() {
    // 플레이어 스텝 대비 약 1.3배의 인터벌 (플레이어보다 살짝 느려 전략적 회피 가능)
    const base = getStepInterval();
    return Math.max(85, Math.floor(base * 1.3 - (hazardLevel - 3) * 4));
  }

  function chooseHunterDirection(hunter) {
    const hHead = hunter.body[0];
    const target = snake[0];
    if (!hHead || !target) return null;

    const dirs = [
      { x: 0, y: -1 }, // 상
      { x: 0, y: 1 },  // 하
      { x: -1, y: 0 }, // 좌
      { x: 1, y: 0 }   // 우
    ];

    const validMoves = dirs.filter(d => {
      // 1. 즉시 180도 역주행 방지
      if (d.x === -hunter.dir.x && d.y === -hunter.dir.y) return false;

      const nx = hHead.x + d.x;
      const ny = hHead.y + d.y;

      // 2. 벽 충돌 방지
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return false;

      // 3. 고체 장애물 충돌 방지
      if (obstacles.some(o => o.state === 'solid' && o.x === nx && o.y === ny)) return false;

      // 4. 헌터 자신 몸통 충돌 방지 (곧 빠져나갈 꼬리 제외)
      if (hunter.body.slice(0, -1).some(p => p.x === nx && p.y === ny)) return false;

      // 5. 다른 헌터 충돌 방지
      if (hunters.some(h => h !== hunter && h.body.some(p => p.x === nx && p.y === ny))) return false;

      return true;
    });

    if (validMoves.length === 0) {
      // 비상 회피: 맵 경계 내에서 역주행 아닌 방향 선택
      const fallback = dirs.filter(d => {
        if (d.x === -hunter.dir.x && d.y === -hunter.dir.y) return false;
        const nx = hHead.x + d.x;
        const ny = hHead.y + d.y;
        return nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS;
      });
      return fallback.length > 0 ? fallback[0] : hunter.dir;
    }

    // 플레이어 머리(Target)와의 최단 맨해튼 거리 방향 선택
    validMoves.sort((a, b) => {
      const distA = Math.abs((hHead.x + a.x) - target.x) + Math.abs((hHead.y + a.y) - target.y);
      const distB = Math.abs((hHead.x + b.x) - target.x) + Math.abs((hHead.y + b.y) - target.y);
      return distA - distB;
    });

    return validMoves[0];
  }

  function updateHunters(currentTime) {
    if (!isRunning || isPaused || isGameOver) return;

    for (const hunter of hunters) {
      if (currentTime - hunter.lastStepTime < getHunterStepInterval()) continue;
      hunter.lastStepTime = currentTime;

      const nextDir = chooseHunterDirection(hunter);
      if (!nextDir) continue;
      hunter.dir = nextDir;

      const newHead = { x: hunter.body[0].x + nextDir.x, y: hunter.body[0].y + nextDir.y };

      // 헌터가 플레이어 몸통(또는 머리)을 덮쳤는지 검사
      if (snake.some(p => p.x === newHead.x && p.y === newHead.y)) {
        triggerGameOver('적 사이버 헌터 뱀에게 격추당했습니다!');
        return;
      }

      // 헌터 전진
      hunter.body.unshift(newHead);

      // 헌터가 사과를 가로채 먹었는지 검사
      if (food && newHead.x === food.x && newHead.y === food.y) {
        playSound('turn');
        addParticles(food.x, food.y, '#ff0055', 18);
        addFloatingText('HUNTER FED +1', food.x, food.y, '#ff3366');
        spawnFood(); // 사과 재생성 (헌터는 꼬리를 유지하여 1칸 성장!)
      } else {
        hunter.body.pop();
      }
    }
  }

  function addParticles(x, y, color, count = 16) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1.5;
      particles.push({
        x: x * CELL_SIZE + CELL_SIZE / 2,
        y: y * CELL_SIZE + CELL_SIZE / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 3 + 2,
        color: color,
        life: 1.0,
        decay: Math.random() * 0.03 + 0.02
      });
    }
  }

  function addFloatingText(text, x, y, color = '#34e7ff') {
    floatingTexts.push({
      text,
      x: x * CELL_SIZE + CELL_SIZE / 2,
      y: y * CELL_SIZE,
      vy: -1.2,
      life: 1.0,
      color
    });
  }

  function resetGame() {
    snake = [
      { x: 10, y: 11 },
      { x: 9, y: 11 },
      { x: 8, y: 11 }
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };

    score = 0;
    applesEaten = 0;
    hazardLevel = 1;
    totalSurvivalMs = 0;
    survivalStartTime = performance.now();
    lastStepTime = performance.now();

    obstacles = [];
    lastObstacleSpawnTime = performance.now();

    hunters = [];
    lastHunterSpawnTime = performance.now();

    bonusItem = null;
    particles = [];
    floatingTexts = [];
    screenShake = 0;

    isRunning = true;
    isPaused = false;
    isGameOver = false;
    isBoosting = false;

    pauseBtn.textContent = 'PAUSE';
    statusMessage.textContent = '생존 프로토콜 가동! 네온 사과를 먹어 성장하세요.';

    spawnFood();
    updateTelemetry();
    startBGM();
  }

  function updateTelemetry() {
    teleLength.textContent = snake.length;
    const spdMultiplier = (130 / getStepInterval()).toFixed(1);
    teleSpeed.textContent = `${spdMultiplier}x`;
    teleApples.textContent = applesEaten;

    if (teleObstacles) {
      const solidCount = obstacles.filter(o => o.state === 'solid').length;
      const warnCount = obstacles.length - solidCount;
      teleObstacles.textContent = warnCount > 0 ? `${solidCount} (+${warnCount})` : solidCount;
      teleObstacles.className = solidCount > 0 ? 'tele-val text-orange' : 'tele-val';
    }

    if (teleHunter) {
      if (hunters.length === 0) {
        teleHunter.textContent = hazardLevel >= 3 ? 'STANDBY' : 'INACTIVE';
        teleHunter.className = 'tele-val text-green';
      } else {
        teleHunter.textContent = `${hunters.length}x HUNTING`;
        teleHunter.className = 'tele-val text-red';
      }
    }

    if (snake[0] && food) {
      const dist = Math.abs(snake[0].x - food.x) + Math.abs(snake[0].y - food.y);
      teleDist.textContent = `${dist}m`;
    } else {
      teleDist.textContent = '--';
    }

    scoreDisplay.textContent = String(score).padStart(5, '0');
    levelDisplay.textContent = `LV.${String(hazardLevel).padStart(2, '0')}`;
  }

  function gameStep() {
    if (!isRunning || isPaused || isGameOver) return;

    direction = nextDirection;
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

    // 1. 벽 충돌 검사
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      triggerGameOver('벽에 충돌했습니다!');
      return;
    }

    // 2. 자기 자신 몸통 충돌 검사
    if (snake.some((part, idx) => idx > 0 && part.x === head.x && part.y === head.y)) {
      triggerGameOver('자신의 몸에 충돌했습니다!');
      return;
    }

    // 3. 고체화된 사이버 장애물 충돌 검사
    if (obstacles.some(obs => obs.state === 'solid' && obs.x === head.x && obs.y === head.y)) {
      triggerGameOver('사이버 장애물에 충돌했습니다!');
      return;
    }

    // 4. 적 사이버 헌터 충돌 검사
    if (hunters.some(h => h.body.some(p => p.x === head.x && p.y === head.y))) {
      triggerGameOver('적 사이버 헌터 뱀에게 격추당했습니다!');
      return;
    }

    // 머리 전진
    snake.unshift(head);

    // 5. 사과 먹었는지 검사
    if (head.x === food.x && head.y === food.y) {
      score += 100 * hazardLevel;
      applesEaten++;
      playSound('eat');
      addParticles(food.x, food.y, '#ff4cb8', 20);
      addFloatingText(`+${100 * hazardLevel} PTS`, food.x, food.y, '#ffe566');

      // 5개마다 위험 레벨(속도) 상승
      const newLevel = Math.floor(applesEaten / 5) + 1;
      if (newLevel !== hazardLevel) {
        hazardLevel = newLevel;
        playSound('levelup');
        screenShake = 6;
        addFloatingText(`LEVEL UP! LV.${hazardLevel}`, head.x, head.y, '#58f299');
        spawnObstacle();
        spawnHunter();
      }

      spawnFood();
      spawnBonus();
    } else if (bonusItem && head.x === bonusItem.x && head.y === bonusItem.y) {
      // 보너스 아이템 획득
      score += 300 * hazardLevel;
      playSound('bonus');
      addParticles(bonusItem.x, bonusItem.y, '#ffe566', 24);
      addFloatingText('+300 BONUS!', bonusItem.x, bonusItem.y, '#ffe566');
      bonusItem = null;
    } else {
      // 일반 이동 (꼬리 삭제)
      snake.pop();
    }

    // 보너스 만료 검사
    if (bonusItem && performance.now() > bonusItem.expire) {
      bonusItem = null;
    }

    updateTelemetry();
  }

  function triggerGameOver(reason) {
    isRunning = false;
    isGameOver = true;
    stopBGM();
    playSound('gameover');
    screenShake = 14;
    addParticles(snake[0].x, snake[0].y, '#ff5c5c', 40);

    const survivedStr = formatTime(totalSurvivalMs);
    resultTime.textContent = survivedStr;
    resultDetails.textContent = `SCORE: ${score.toLocaleString()} · APPLES: ${applesEaten} · LEVEL: ${hazardLevel}`;

    if (resultPlayerName) {
      resultPlayerName.value = currentPilotName || 'NEON_RUNNER';
      if (resultNameError) resultNameError.textContent = '';
    }

    const isNewRecord = personalBestMs === null || totalSurvivalMs > personalBestMs;
    resultKicker.textContent = isNewRecord ? '🏆 NEW RECORD!' : 'SIGNAL LOST';
    resultTitle.textContent = isNewRecord ? 'BEST SURVIVAL' : 'GAME OVER';

    resultScreen.classList.remove('hidden');
    statusMessage.textContent = `${reason} 최종 생존 시간: ${survivedStr}`;
  }

  function togglePause() {
    if (!isRunning || isGameOver) return;
    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? 'RESUME' : 'PAUSE';
    statusMessage.textContent = isPaused ? '시스템 일시 정지됨 [P/ESC로 재개]' : '생존 프로토콜 진행 중';

    if (isPaused) {
      stopBGM();
    } else {
      lastStepTime = performance.now();
      startBGM();
    }
  }

  // ==========================================
  // 8. 렌더링 엔진 (메인 캔버스 & 레이더)
  // ==========================================
  function renderMain() {
    ctx.save();

    // 화면 흔들림 효과
    if (screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * screenShake;
      const shakeY = (Math.random() - 0.5) * screenShake;
      ctx.translate(shakeX, shakeY);
      screenShake *= 0.85;
      if (screenShake < 0.2) screenShake = 0;
    }

    // 배경 클리어
    ctx.fillStyle = '#0a0d24';
    ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);

    // 사이버네틱 그리드 라인
    ctx.strokeStyle = 'rgba(52, 231, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL_SIZE, 0);
      ctx.lineTo(c * CELL_SIZE, mainCanvas.height);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL_SIZE);
      ctx.lineTo(mainCanvas.width, r * CELL_SIZE);
      ctx.stroke();
    }

    // 위험 경계선 네온 펄스
    const pulseAlpha = 0.35 + 0.15 * Math.sin(performance.now() * 0.005);
    ctx.strokeStyle = `rgba(255, 76, 184, ${pulseAlpha})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, mainCanvas.width - 2, mainCanvas.height - 2);

    // 1. 보너스 아이템 렌더링
    if (bonusItem) {
      const bx = bonusItem.x * CELL_SIZE + CELL_SIZE / 2;
      const by = bonusItem.y * CELL_SIZE + CELL_SIZE / 2;
      const bPulse = 1 + 0.2 * Math.sin(performance.now() * 0.01);

      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ffe566';
      ctx.fillStyle = '#ffe566';
      ctx.beginPath();
      ctx.arc(bx, by, (CELL_SIZE * 0.4) * bPulse, 0, Math.PI * 2);
      ctx.fill();

      // 회전 에너지 링
      ctx.strokeStyle = '#34e7ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(bx, by, CELL_SIZE * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 2. 사이버 장애물 (Obstacles / Glitch Hazards) 렌더링
    for (const obs of obstacles) {
      const ox = obs.x * CELL_SIZE;
      const oy = obs.y * CELL_SIZE;
      const pad = 2;

      ctx.save();
      if (obs.state === 'warning') {
        // 경고 상태: 깜빡이는 주황색 홀로그램 그리드 & 경고 느낌
        const blink = Math.sin(performance.now() * 0.018) > 0;
        ctx.strokeStyle = blink ? '#ff9f43' : 'rgba(255, 159, 67, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(ox + pad, oy + pad, CELL_SIZE - pad * 2, CELL_SIZE - pad * 2);
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(255, 159, 67, 0.18)';
        ctx.fillRect(ox + pad, oy + pad, CELL_SIZE - pad * 2, CELL_SIZE - pad * 2);

        if (blink) {
          ctx.fillStyle = '#ff9f43';
          ctx.font = 'bold 11px "Space Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('!', ox + CELL_SIZE / 2, oy + CELL_SIZE / 2);
        }
      } else {
        // 고체화된 활성 장애물: 사이버 오렌지/레드 메탈릭 베리어 블록
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#ff9f43';

        const obsGrad = ctx.createLinearGradient(ox, oy, ox + CELL_SIZE, oy + CELL_SIZE);
        obsGrad.addColorStop(0, '#ff9f43');
        obsGrad.addColorStop(0.5, '#c0392b');
        obsGrad.addColorStop(1, '#ff5c5c');

        ctx.fillStyle = obsGrad;
        ctx.fillRect(ox + pad, oy + pad, CELL_SIZE - pad * 2, CELL_SIZE - pad * 2);

        // 내부 사이버 메탈릭 디테일 (X자 패턴)
        ctx.strokeStyle = '#ffe566';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(ox + pad + 2, oy + pad + 2, CELL_SIZE - (pad + 2) * 2, CELL_SIZE - (pad + 2) * 2);

        ctx.beginPath();
        ctx.moveTo(ox + pad + 4, oy + pad + 4);
        ctx.lineTo(ox + CELL_SIZE - pad - 4, oy + CELL_SIZE - pad - 4);
        ctx.moveTo(ox + CELL_SIZE - pad - 4, oy + pad + 4);
        ctx.lineTo(ox + pad + 4, oy + CELL_SIZE - pad - 4);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. 네온 사과 (Food) 렌더링
    if (food) {
      const fx = food.x * CELL_SIZE + CELL_SIZE / 2;
      const fy = food.y * CELL_SIZE + CELL_SIZE / 2;
      const pulse = 1 + 0.15 * Math.sin(performance.now() * 0.008);

      ctx.save();
      ctx.shadowBlur = 18;
      ctx.shadowColor = 'rgba(255, 76, 184, 0.9)';

      // 외부 글로우 링
      ctx.strokeStyle = 'rgba(255, 76, 184, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(fx, fy, (CELL_SIZE * 0.55) * pulse, 0, Math.PI * 2);
      ctx.stroke();

      // 사과 본체 (네온 핑크 / 레드)
      const grad = ctx.createRadialGradient(fx - 2, fy - 2, 1, fx, fy, CELL_SIZE * 0.45);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, '#ff70c5');
      grad.addColorStop(1, '#ff1a75');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(fx, fy, (CELL_SIZE * 0.38) * pulse, 0, Math.PI * 2);
      ctx.fill();

      // 사과 꼭지/잎사귀
      ctx.fillStyle = '#58f299';
      ctx.shadowColor = '#58f299';
      ctx.shadowBlur = 6;
      ctx.fillRect(fx - 1.5, fy - CELL_SIZE * 0.45, 3, 3);
      ctx.restore();
    }

    // 4. 적 사이버 헌터 뱀 (Enemy Hunter Snake) 렌더링
    for (const hunter of hunters) {
      const len = hunter.body.length;
      for (let i = len - 1; i >= 0; i--) {
        const seg = hunter.body[i];
        const isHead = i === 0;
        const ratio = 1 - (i / len);
        const cx = seg.x * CELL_SIZE + CELL_SIZE / 2;
        const cy = seg.y * CELL_SIZE + CELL_SIZE / 2;
        const radius = isHead ? CELL_SIZE * 0.48 : CELL_SIZE * (0.32 + 0.12 * ratio);

        ctx.save();
        if (isHead) {
          // 헌터 머리: 붉은 네온 글로우 & 사악한 사이버 헬멧
          ctx.shadowBlur = 22;
          ctx.shadowColor = '#ff0055';

          const headGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius);
          headGrad.addColorStop(0, '#ffffff');
          headGrad.addColorStop(0.3, '#ff0055');
          headGrad.addColorStop(1, '#770022');
          ctx.fillStyle = headGrad;

          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fill();

          // 헌터 눈 (사악한 붉은빛 눈동자)
          const eyeOffset = radius * 0.45;
          const eyeForward = radius * 0.35;
          const eyeRadius = 3;
          let lEx = cx, lEy = cy, rEx = cx, rEy = cy;

          if (hunter.dir.x === 1) { // 우
            lEx = cx + eyeForward; lEy = cy - eyeOffset;
            rEx = cx + eyeForward; rEy = cy + eyeOffset;
          } else if (hunter.dir.x === -1) { // 좌
            lEx = cx - eyeForward; lEy = cy - eyeOffset;
            rEx = cx - eyeForward; rEy = cy + eyeOffset;
          } else if (hunter.dir.y === 1) { // 하
            lEx = cx - eyeOffset; lEy = cy + eyeForward;
            rEx = cx + eyeOffset; rEy = cy + eyeForward;
          } else if (hunter.dir.y === -1) { // 상
            lEx = cx - eyeOffset; lEy = cy - eyeForward;
            rEx = cx + eyeOffset; rEy = cy - eyeForward;
          }

          ctx.fillStyle = '#080b1d';
          ctx.beginPath();
          ctx.arc(lEx, lEy, eyeRadius, 0, Math.PI * 2);
          ctx.arc(rEx, rEy, eyeRadius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffe566';
          ctx.shadowColor = '#ff0033';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(lEx + hunter.dir.x, lEy + hunter.dir.y, 1.4, 0, Math.PI * 2);
          ctx.arc(rEx + hunter.dir.x, rEy + hunter.dir.y, 1.4, 0, Math.PI * 2);
          ctx.fill();

        } else {
          // 헌터 몸통 (다크 크림슨 ~ 블러드 레드 그라데이션)
          ctx.shadowBlur = 10;
          ctx.shadowColor = 'rgba(255, 0, 85, 0.6)';

          const bodyGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, radius);
          bodyGrad.addColorStop(0, '#ff3366');
          bodyGrad.addColorStop(1, '#550011');

          ctx.fillStyle = bodyGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // 5. 플레이어 네온 지렁이 (Snake) 렌더링
    if (snake.length > 0) {
      const len = snake.length;

      // 몸통 세그먼트 (꼬리부터 머리 방향으로)
      for (let i = len - 1; i >= 0; i--) {
        const seg = snake[i];
        const isHead = i === 0;
        const ratio = 1 - (i / len); // 1.0 (머리) -> 0.0 (꼬리)
        const cx = seg.x * CELL_SIZE + CELL_SIZE / 2;
        const cy = seg.y * CELL_SIZE + CELL_SIZE / 2;
        const radius = isHead ? CELL_SIZE * 0.46 : CELL_SIZE * (0.32 + 0.12 * ratio);

        ctx.save();
        if (isHead) {
          // 머리 글로우 & 사이버 헬멧
          ctx.shadowBlur = isBoosting ? 25 : 18;
          ctx.shadowColor = isBoosting ? '#ffe566' : '#34e7ff';

          const headGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius);
          headGrad.addColorStop(0, '#ffffff');
          headGrad.addColorStop(0.4, isBoosting ? '#ffe566' : '#34e7ff');
          headGrad.addColorStop(1, isBoosting ? '#ff9f43' : '#0099ff');
          ctx.fillStyle = headGrad;

          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fill();

          // 사이버네틱 눈 (진행 방향 응시)
          const eyeOffset = radius * 0.45;
          const eyeForward = radius * 0.35;
          const eyeRadius = 3;
          let leftEyeX = cx, leftEyeY = cy, rightEyeX = cx, rightEyeY = cy;

          if (direction.x === 1) { // 우
            leftEyeX = cx + eyeForward; leftEyeY = cy - eyeOffset;
            rightEyeX = cx + eyeForward; rightEyeY = cy + eyeOffset;
          } else if (direction.x === -1) { // 좌
            leftEyeX = cx - eyeForward; leftEyeY = cy - eyeOffset;
            rightEyeX = cx - eyeForward; rightEyeY = cy + eyeOffset;
          } else if (direction.y === 1) { // 하
            leftEyeX = cx - eyeOffset; leftEyeY = cy + eyeForward;
            rightEyeX = cx + eyeOffset; rightEyeY = cy + eyeForward;
          } else if (direction.y === -1) { // 상
            leftEyeX = cx - eyeOffset; leftEyeY = cy - eyeForward;
            rightEyeX = cx + eyeOffset; rightEyeY = cy - eyeForward;
          }

          ctx.fillStyle = '#080b1d';
          ctx.beginPath();
          ctx.arc(leftEyeX, leftEyeY, eyeRadius, 0, Math.PI * 2);
          ctx.arc(rightEyeX, rightEyeY, eyeRadius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = isBoosting ? '#ff5c5c' : '#34e7ff';
          ctx.beginPath();
          ctx.arc(leftEyeX + direction.x, leftEyeY + direction.y, 1.2, 0, Math.PI * 2);
          ctx.arc(rightEyeX + direction.x, rightEyeY + direction.y, 1.2, 0, Math.PI * 2);
          ctx.fill();

        } else {
          // 몸통 마디 (네온 그린 ~ 바이올렛 그라데이션)
          ctx.shadowBlur = 10;
          ctx.shadowColor = ratio > 0.5 ? 'rgba(88, 242, 153, 0.7)' : 'rgba(192, 132, 252, 0.7)';

          const bodyGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, radius);
          if (ratio > 0.5) {
            bodyGrad.addColorStop(0, '#a7f3b0');
            bodyGrad.addColorStop(1, '#2ba870');
          } else {
            bodyGrad.addColorStop(0, '#c084fc');
            bodyGrad.addColorStop(1, '#633199');
          }

          ctx.fillStyle = bodyGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // 6. 파티클 이펙트
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 7. 플로팅 텍스트
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y += ft.vy;
      ft.life -= 0.025;
      if (ft.life <= 0) {
        floatingTexts.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = ft.life;
      ctx.font = '700 12px "Space Mono", monospace';
      ctx.fillStyle = ft.color;
      ctx.textAlign = 'center';
      ctx.shadowBlur = 8;
      ctx.shadowColor = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore();
  }

  function renderRadar() {
    radarCtx.fillStyle = '#070a1e';
    radarCtx.fillRect(0, 0, radarCanvas.width, radarCanvas.height);

    const rCenter = radarCanvas.width / 2;
    const rScale = radarCanvas.width / (COLS * CELL_SIZE);

    // 동심원 레이더 그리드
    radarCtx.strokeStyle = 'rgba(52, 231, 255, 0.2)';
    radarCtx.lineWidth = 1;
    [rCenter * 0.33, rCenter * 0.66, rCenter * 0.95].forEach(r => {
      radarCtx.beginPath();
      radarCtx.arc(rCenter, rCenter, r, 0, Math.PI * 2);
      radarCtx.stroke();
    });

    // 십자선
    radarCtx.beginPath();
    radarCtx.moveTo(rCenter, 0); radarCtx.lineTo(rCenter, radarCanvas.height);
    radarCtx.moveTo(0, rCenter); radarCtx.lineTo(radarCanvas.width, rCenter);
    radarCtx.stroke();

    // 레이더 스위프(회전 스캔 라인)
    radarAngle = (radarAngle + 0.04) % (Math.PI * 2);
    radarCtx.save();
    radarCtx.translate(rCenter, rCenter);
    radarCtx.rotate(radarAngle);
    const sweepGrad = radarCtx.createLinearGradient(0, 0, rCenter, 0);
    sweepGrad.addColorStop(0, 'rgba(52, 231, 255, 0)');
    sweepGrad.addColorStop(1, 'rgba(52, 231, 255, 0.4)');
    radarCtx.fillStyle = sweepGrad;
    radarCtx.beginPath();
    radarCtx.moveTo(0, 0);
    radarCtx.arc(0, 0, rCenter * 0.95, 0, 0.5);
    radarCtx.lineTo(0, 0);
    radarCtx.fill();
    radarCtx.restore();

    // 장애물 핑 (주황색 네온 사각형)
    for (const obs of obstacles) {
      const ox = (obs.x * CELL_SIZE + CELL_SIZE / 2) * rScale;
      const oy = (obs.y * CELL_SIZE + CELL_SIZE / 2) * rScale;
      radarCtx.fillStyle = obs.state === 'solid' ? '#ff9f43' : 'rgba(255, 159, 67, 0.35)';
      radarCtx.shadowBlur = 6;
      radarCtx.shadowColor = '#ff9f43';
      radarCtx.fillRect(ox - 2, oy - 2, 4, 4);
    }

    // 음식 위치 핑 (빨간/핑크 점)
    if (food) {
      const rx = (food.x * CELL_SIZE + CELL_SIZE / 2) * rScale;
      const ry = (food.y * CELL_SIZE + CELL_SIZE / 2) * rScale;
      radarCtx.fillStyle = '#ff4cb8';
      radarCtx.shadowBlur = 8;
      radarCtx.shadowColor = '#ff4cb8';
      radarCtx.beginPath();
      radarCtx.arc(rx, ry, 3.5, 0, Math.PI * 2);
      radarCtx.fill();
    }

    // 적 사이버 헌터 핑 (붉은 펄스 점)
    for (const hunter of hunters) {
      if (hunter.body.length > 0) {
        const hHead = hunter.body[0];
        const hx = (hHead.x * CELL_SIZE + CELL_SIZE / 2) * rScale;
        const hy = (hHead.y * CELL_SIZE + CELL_SIZE / 2) * rScale;
        const pulse = 3.5 + 1.2 * Math.sin(performance.now() * 0.015);
        radarCtx.fillStyle = '#ff0055';
        radarCtx.shadowBlur = 10;
        radarCtx.shadowColor = '#ff0055';
        radarCtx.beginPath();
        radarCtx.arc(hx, hy, pulse, 0, Math.PI * 2);
        radarCtx.fill();
      }
    }

    // 플레이어 지렁이 머리 위치 핑 (시안 점)
    if (snake.length > 0) {
      const head = snake[0];
      const hx = (head.x * CELL_SIZE + CELL_SIZE / 2) * rScale;
      const hy = (head.y * CELL_SIZE + CELL_SIZE / 2) * rScale;
      radarCtx.fillStyle = '#34e7ff';
      radarCtx.shadowBlur = 10;
      radarCtx.shadowColor = '#34e7ff';
      radarCtx.beginPath();
      radarCtx.arc(hx, hy, 4, 0, Math.PI * 2);
      radarCtx.fill();
    }
  }

  // ==========================================
  // 9. 메인 게임 루프 (requestAnimationFrame)
  // ==========================================
  function mainLoop(currentTime) {
    if (isRunning && !isPaused && !isGameOver) {
      totalSurvivalMs = currentTime - survivalStartTime;
      timeDisplay.textContent = formatTime(totalSurvivalMs);

      // 장애물 상태 전환 및 헌터 AI 업데이트
      updateObstacles(currentTime);
      updateHunters(currentTime);

      // 주기적 장애물 및 헌터 침투 체크 (1.5초 주기)
      if (currentTime - lastObstacleSpawnTime > 1500) {
        lastObstacleSpawnTime = currentTime;
        spawnObstacle();
        spawnHunter();
      }

      // 플레이어 스텝 타이머 검사
      const interval = getStepInterval();
      if (currentTime - lastStepTime >= interval) {
        lastStepTime = currentTime;
        gameStep();
      }
    }

    renderMain();
    renderRadar();

    animFrameId = requestAnimationFrame(mainLoop);
  }

  // ==========================================
  // 10. 키보드 & 컨트롤러 입력 핸들링
  // ==========================================
  function setDirection(x, y) {
    if (!isRunning || isPaused || isGameOver) return;
    // 반대 방향으로의 즉시 역주행 방지
    if (x !== -direction.x || y !== -direction.y) {
      if (x !== nextDirection.x || y !== nextDirection.y) {
        nextDirection = { x, y };
        playSound('turn');
      }
    }
  }

  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();

    // 시작 화면 닉네임 입력 모달 처리
    if (!startScreen.classList.contains('hidden')) {
      if (e.key === 'Enter') confirmPilotName();
      return;
    }

    // 결과 화면 모달
    if (!resultScreen.classList.contains('hidden')) {
      if (e.key === 'Enter') handleSaveScore();
      return;
    }

    // 방향키 및 WASD
    if (['arrowup', 'w'].includes(k)) {
      e.preventDefault();
      setDirection(0, -1);
    } else if (['arrowdown', 's'].includes(k)) {
      e.preventDefault();
      setDirection(0, 1);
    } else if (['arrowleft', 'a'].includes(k)) {
      e.preventDefault();
      setDirection(-1, 0);
    } else if (['arrowright', 'd'].includes(k)) {
      e.preventDefault();
      setDirection(1, 0);
    } else if (e.code === 'Space') {
      e.preventDefault();
      isBoosting = true;
    } else if (['p', 'escape'].includes(k)) {
      e.preventDefault();
      togglePause();
    } else if (k === 'r') {
      e.preventDefault();
      initAudio();
      resetGame();
    }
  });

  document.addEventListener('keyup', e => {
    if (e.code === 'Space') {
      isBoosting = false;
    }
  });

  // 모바일 D-PAD 이벤트 바인딩
  btnMvUp.addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); setDirection(0, -1); });
  btnMvDown.addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); setDirection(0, 1); });
  btnMvLeft.addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); setDirection(-1, 0); });
  btnMvRight.addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); setDirection(1, 0); });
  btnBoost.addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); isBoosting = true; });
  btnBoost.addEventListener('pointerup', e => { e.preventDefault(); isBoosting = false; });
  btnBoost.addEventListener('pointerleave', e => { e.preventDefault(); isBoosting = false; });

  // ==========================================
  // 11. 모달 및 버튼 이벤트 리스너
  // ==========================================
  function confirmPilotName() {
    initAudio();
    const val = playerNameInput.value.trim().toUpperCase();
    if (!val) {
      nameError.textContent = '닉네임을 입력해 주세요!';
      return;
    }
    if (val.length < 2) {
      nameError.textContent = '2글자 이상 입력해 주세요.';
      return;
    }
    currentPilotName = val;
    if (resultPlayerName) resultPlayerName.value = currentPilotName;
    try {
      localStorage.setItem(PLAYER_NAME_KEY, currentPilotName);
    } catch (e) {}
    nameError.textContent = '';
    startScreen.classList.add('hidden');
    resetGame();
  }

  async function handleSaveScore() {
    playSound('click');
    const inputVal = (resultPlayerName ? resultPlayerName.value : currentPilotName || '').trim().toUpperCase();
    if (!inputVal) {
      if (resultNameError) resultNameError.textContent = '닉네임을 입력해 주세요!';
      return;
    }
    if (inputVal.length < 2) {
      if (resultNameError) resultNameError.textContent = '2글자 이상 입력해 주세요.';
      return;
    }
    currentPilotName = inputVal;
    if (playerNameInput) playerNameInput.value = currentPilotName;
    try {
      localStorage.setItem(PLAYER_NAME_KEY, currentPilotName);
    } catch (e) {}

    const entry = {
      name: currentPilotName,
      timeMs: totalSurvivalMs,
      apples: applesEaten,
      score: score,
      hazardLevel: hazardLevel,
      date: new Date().toISOString().split('T')[0]
    };
    resultScreen.classList.add('hidden');
    await saveScore(entry);
    resetGame();
  }

  startGameBtn.addEventListener('click', confirmPilotName);

  saveScoreBtn.addEventListener('click', handleSaveScore);

  skipScoreBtn.addEventListener('click', () => {
    playSound('click');
    resultScreen.classList.add('hidden');
    statusMessage.textContent = '이번 생존 기록은 등록되지 않았습니다.';
    resetGame();
  });

  restartBtn.addEventListener('click', () => {
    playSound('click');
    initAudio();
    if (!resultScreen.classList.contains('hidden')) resultScreen.classList.add('hidden');
    if (!startScreen.classList.contains('hidden')) startScreen.classList.add('hidden');
    resetGame();
  });

  pauseBtn.addEventListener('click', () => {
    playSound('click');
    togglePause();
  });

  // 오디오 토글
  bgmToggleBtn.addEventListener('click', () => {
    initAudio();
    if (isMutedAll) isMutedAll = false;
    bgmEnabled = !bgmEnabled;
    if (bgmEnabled && isRunning && !isPaused) startBGM();
    else stopBGM();
    updateAudioButtons();
  });

  sfxToggleBtn.addEventListener('click', () => {
    initAudio();
    if (isMutedAll) isMutedAll = false;
    sfxEnabled = !sfxEnabled;
    updateAudioButtons();
  });

  muteAllBtn.addEventListener('click', () => {
    initAudio();
    isMutedAll = !isMutedAll;
    if (isMutedAll) stopBGM();
    else if (bgmEnabled && isRunning && !isPaused) startBGM();
    updateAudioButtons();
  });

  // ==========================================
  // 12. 게임 초기화
  // ==========================================
  try {
    const savedName = localStorage.getItem(PLAYER_NAME_KEY);
    if (savedName) playerNameInput.value = savedName;
  } catch (e) {}

  updateAudioButtons();
  loadAndRenderScores();

  // 초기 렌더링 시작
  animFrameId = requestAnimationFrame(mainLoop);
})();
