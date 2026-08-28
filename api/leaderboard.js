import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// 네온 웜 서바이벌 테이블명
const PRIMARY_TABLE = process.env.WORM_TABLE || 'neon_worm_leaderboard';

function sanitizeName(value) {
  return String(value || '').trim().slice(0, 12).replace(/[<>]/g, '');
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (!supabase) {
    return response.status(503).json({ error: 'Supabase URL or Key is not configured in .env' });
  }

  try {
    // -----------------------------------------------------------
    // GET: 상위 10위 랭킹 조회
    // -----------------------------------------------------------
    if (request.method === 'GET') {
      const name = sanitizeName(request.query?.name);

      const { data: topScores, error: topError } = await supabase
        .from(PRIMARY_TABLE)
        .select('*')
        .order('time_ms', { ascending: false })
        .order('apples', { ascending: false })
        .order('played_at', { ascending: true })
        .limit(10);

      if (topError) {
        console.error('Supabase SELECT error:', topError);
        return response.status(500).json({ error: topError.message });
      }

      let personalBest = null;
      if (name) {
        const { data: userData } = await supabase
          .from(PRIMARY_TABLE)
          .select('time_ms')
          .ilike('name', name)
          .maybeSingle();

        if (userData) {
          personalBest = userData.time_ms;
        }
      }

      return response.status(200).json({
        scores: topScores || [],
        personalBest
      });
    }

    // -----------------------------------------------------------
    // POST: 생존 기록 등록 및 최고기록 자동 갱신
    // -----------------------------------------------------------
    if (request.method === 'POST') {
      let body = request.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {
          return response.status(400).json({ error: 'Invalid JSON body.' });
        }
      }
      body = body || {};

      const name = body.name;
      const rawTime = body.timeMs ?? body.time_ms ?? body.time ?? 0;
      const rawApples = body.apples ?? 0;
      const rawScore = body.score ?? 0;
      const rawLevel = body.hazardLevel ?? body.hazard_level ?? 1;

      const cleanName = sanitizeName(name);
      const numericTime = Math.max(0, Math.round(Number(rawTime) || 0));
      const numericApples = Math.max(0, Math.round(Number(rawApples) || 0));
      const numericScore = Math.max(0, Math.round(Number(rawScore) || 0));
      const numericLevel = Math.max(1, Math.round(Number(rawLevel) || 1));

      if (!cleanName) {
        return response.status(400).json({ error: 'Pilot name is required.' });
      }

      // 기존 닉네임 기록 조회
      const { data: existingUser, error: checkError } = await supabase
        .from(PRIMARY_TABLE)
        .select('time_ms')
        .ilike('name', cleanName)
        .maybeSingle();

      if (checkError) {
        console.warn('Supabase Check Warning:', checkError);
      }

      const recordData = {
        name: cleanName,
        time_ms: numericTime,
        apples: numericApples,
        score: numericScore,
        hazard_level: numericLevel,
        played_at: new Date().toISOString()
      };

      let status = 'inserted';
      let finalBest = numericTime;

      // 신규 유저이거나 이전 최고기록보다 높은 경우 upsert 실행
      if (!existingUser || numericTime > (existingUser.time_ms || 0)) {
        const { error: upsertError } = await supabase
          .from(PRIMARY_TABLE)
          .upsert(recordData, { onConflict: 'name' });

        if (upsertError) {
          console.error('Supabase UPSERT Error:', upsertError);
          return response.status(500).json({ error: upsertError.message });
        }
        status = existingUser ? 'updated' : 'inserted';
      } else {
        status = 'kept';
        finalBest = existingUser.time_ms;
      }

      // 갱신 후 상위 TOP 10 다시 조회
      const { data: nextTop, error: fetchError } = await supabase
        .from(PRIMARY_TABLE)
        .select('*')
        .order('time_ms', { ascending: false })
        .order('apples', { ascending: false })
        .order('played_at', { ascending: true })
        .limit(10);

      if (fetchError) {
        console.warn('Supabase Refresh Warning:', fetchError);
      }

      return response.status(201).json({
        status,
        scores: nextTop || [],
        personalBest: finalBest,
        time_ms: finalBest
      });
    }

    response.setHeader('Allow', 'GET, POST, OPTIONS');
    return response.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('Supabase Leaderboard API Error:', error);
    return response.status(500).json({ error: error.message || 'Could not update leaderboard.' });
  }
}
