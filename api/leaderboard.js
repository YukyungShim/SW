import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// 네온 웜 서바이벌 테이블명
const PRIMARY_TABLE = process.env.WORM_TABLE || 'neon_worm_leaderboard';

function validTime(value) {
  return Number.isInteger(value) && value >= 0 && value <= 86_400_000; // 최대 24시간
}

function sanitizeName(value) {
  return String(value || '').trim().slice(0, 12).replace(/[<>]/g, '');
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

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

      if (topError) throw topError;

      let personalBest = null;
      if (name) {
        const { data: userData, error: userError } = await supabase
          .from(PRIMARY_TABLE)
          .select('time_ms, apples, score, hazard_level')
          .ilike('name', name)
          .maybeSingle();

        if (!userError && userData) {
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
      const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body || {};
      const { name, timeMs, apples = 0, score = 0, hazardLevel = 1 } = body;

      const cleanName = sanitizeName(name);
      const numericTime = Number(timeMs);
      const numericApples = Number(apples) || 0;
      const numericScore = Number(score) || 0;
      const numericLevel = Number(hazardLevel) || 1;

      if (!cleanName || !validTime(numericTime)) {
        return response.status(400).json({ error: 'Invalid pilot name or survival time.' });
      }

      // 기존 닉네임 기록 조회
      const { data: existingUser, error: checkError } = await supabase
        .from(PRIMARY_TABLE)
        .select('*')
        .ilike('name', cleanName)
        .maybeSingle();

      if (checkError) throw checkError;

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

      if (!existingUser) {
        // 1. 신규 파일럿인 경우: INSERT
        const { error: insertError } = await supabase
          .from(PRIMARY_TABLE)
          .insert(recordData);

        if (insertError) throw insertError;
        status = 'inserted';
      } else if (numericTime > existingUser.time_ms) {
        // 2. 기존 기록보다 더 긴 생존 시간 달성 시: UPDATE
        const { error: updateError } = await supabase
          .from(PRIMARY_TABLE)
          .update(recordData)
          .ilike('name', cleanName);

        if (updateError) throw updateError;
        status = 'updated';
        finalBest = numericTime;
      } else {
        // 3. 기존 최고 기록이 더 높은 경우: 유지
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

      if (fetchError) throw fetchError;

      return response.status(201).json({
        status,
        scores: nextTop || [],
        personalBest: finalBest,
        time_ms: finalBest
      });
    }

    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('Supabase Leaderboard API Error:', error);
    return response.status(500).json({ error: error.message || 'Could not update leaderboard.' });
  }
}
