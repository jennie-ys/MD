import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
  GITHUB_TOKEN: string
  GITHUB_OWNER: string
  GITHUB_REPO:  string
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/static/*', (c) => c.env.ASSETS.fetch(c.req.raw))
app.use('/api/*', cors())

// ─────────────────────────────────────────────────────────────
// GET /api/images  –  초기 학습 이미지 목록 반환 (1학습단계.zip, 범주당 6개)
// 블록 무작위화 고정 순서: 6블록 × 6범주, 경계 포함 인접 범주 중복 없음
// (mulberry32 seed=5 로 생성, 모든 조건·참가자 동일 순서)
// ─────────────────────────────────────────────────────────────
app.get('/api/images', (c) => {
  const slides: { category: string; url: string }[] = [
    // ── 블록 1: AK → DF → BCC → NV → MEL → VASC ──
    { category: '광선각화증',        url: '/static/images/%EA%B4%91%EC%84%A0%EA%B0%81%ED%99%94%EC%A6%9D(AK)/ISIC_0146067.jpg' },
    { category: '피부섬유종',         url: '/static/images/%ED%94%BC%EB%B6%80%EC%84%AC%EC%9C%A0%EC%A2%85(DF)/ISIC_0811703.jpg' },
    { category: '기저세포암',        url: '/static/images/%EA%B8%B0%EC%A0%80%EC%84%B8%ED%8F%AC%EC%95%94(BCC)/ISIC_0195347.jpg' },
    { category: '멜라닌세포성 모반', url: '/static/images/%EB%A9%9C%EB%9D%BC%EB%8B%8C%EC%84%B8%ED%8F%AC%EC%84%B1%20%EB%AA%A8%EB%B0%98(NV)/ISIC_0073863.jpg' },
    { category: '흑색종',            url: '/static/images/%ED%9D%91%EC%83%89%EC%A2%85(MEL)/ISIC_0156507.jpg' },
    { category: '혈관 병변',        url: '/static/images/%ED%98%88%EA%B4%80%20%EB%B3%91%EB%B3%80(VASC)/ISIC_0552734.jpg' },
    // ── 블록 2: AK → VASC → NV → BCC → MEL → DF ──
    { category: '광선각화증',        url: '/static/images/%EA%B4%91%EC%84%A0%EA%B0%81%ED%99%94%EC%A6%9D(AK)/ISIC_0260732.jpg' },
    { category: '혈관 병변',        url: '/static/images/%ED%98%88%EA%B4%80%20%EB%B3%91%EB%B3%80(VASC)/ISIC_0686612.jpg' },
    { category: '멜라닌세포성 모반', url: '/static/images/%EB%A9%9C%EB%9D%BC%EB%8B%8C%EC%84%B8%ED%8F%AC%EC%84%B1%20%EB%AA%A8%EB%B0%98(NV)/ISIC_0080219.jpg' },
    { category: '기저세포암',        url: '/static/images/%EA%B8%B0%EC%A0%80%EC%84%B8%ED%8F%AC%EC%95%94(BCC)/ISIC_0365517.jpg' },
    { category: '흑색종',            url: '/static/images/%ED%9D%91%EC%83%89%EC%A2%85(MEL)/ISIC_0184224.jpg' },
    { category: '피부섬유종',         url: '/static/images/%ED%94%BC%EB%B6%80%EC%84%AC%EC%9C%A0%EC%A2%85(DF)/ISIC_0919412.jpg' },
    // ── 블록 3: VASC → AK → MEL → NV → DF → BCC ──
    { category: '혈관 병변',        url: '/static/images/%ED%98%88%EA%B4%80%20%EB%B3%91%EB%B3%80(VASC)/ISIC_1996485.jpg' },
    { category: '광선각화증',        url: '/static/images/%EA%B4%91%EC%84%A0%EA%B0%81%ED%99%94%EC%A6%9D(AK)/ISIC_0478016.jpg' },
    { category: '흑색종',            url: '/static/images/%ED%9D%91%EC%83%89%EC%A2%85(MEL)/ISIC_0204323.jpg' },
    { category: '멜라닌세포성 모반', url: '/static/images/%EB%A9%9C%EB%9D%BC%EB%8B%8C%EC%84%B8%ED%8F%AC%EC%84%B1%20%EB%AA%A8%EB%B0%98(NV)/ISIC_0097262.jpg' },
    { category: '피부섬유종',         url: '/static/images/%ED%94%BC%EB%B6%80%EC%84%AC%EC%9C%A0%EC%A2%85(DF)/ISIC_1176432.jpg' },
    { category: '기저세포암',        url: '/static/images/%EA%B8%B0%EC%A0%80%EC%84%B8%ED%8F%AC%EC%95%94(BCC)/ISIC_0368554.jpg' },
    // ── 블록 4: AK → VASC → MEL → NV → BCC → DF ──
    { category: '광선각화증',        url: '/static/images/%EA%B4%91%EC%84%A0%EA%B0%81%ED%99%94%EC%A6%9D(AK)/ISIC_0496864.jpg' },
    { category: '혈관 병변',        url: '/static/images/%ED%98%88%EA%B4%80%20%EB%B3%91%EB%B3%80(VASC)/ISIC_3849096.jpg' },
    { category: '흑색종',            url: '/static/images/%ED%9D%91%EC%83%89%EC%A2%85(MEL)/ISIC_0212251.jpg' },
    { category: '멜라닌세포성 모반', url: '/static/images/%EB%A9%9C%EB%9D%BC%EB%8B%8C%EC%84%B8%ED%8F%AC%EC%84%B1%20%EB%AA%A8%EB%B0%98(NV)/ISIC_0101767.jpg' },
    { category: '기저세포암',        url: '/static/images/%EA%B8%B0%EC%A0%80%EC%84%B8%ED%8F%AC%EC%95%94(BCC)/ISIC_0369681.jpg' },
    { category: '피부섬유종',         url: '/static/images/%ED%94%BC%EB%B6%80%EC%84%AC%EC%9C%A0%EC%A2%85(DF)/ISIC_1342857.jpg' },
    // ── 블록 5: VASC → NV → MEL → BCC → AK → DF ──
    { category: '혈관 병변',        url: '/static/images/%ED%98%88%EA%B4%80%20%EB%B3%91%EB%B3%80(VASC)/ISIC_5409072.jpg' },
    { category: '멜라닌세포성 모반', url: '/static/images/%EB%A9%9C%EB%9D%BC%EB%8B%8C%EC%84%B8%ED%8F%AC%EC%84%B1%20%EB%AA%A8%EB%B0%98(NV)/ISIC_0106322.jpg' },
    { category: '흑색종',            url: '/static/images/%ED%9D%91%EC%83%89%EC%A2%85(MEL)/ISIC_0305865.jpg' },
    { category: '기저세포암',        url: '/static/images/%EA%B8%B0%EC%A0%80%EC%84%B8%ED%8F%AC%EC%95%94(BCC)/ISIC_0377749.jpg' },
    { category: '광선각화증',        url: '/static/images/%EA%B4%91%EC%84%A0%EA%B0%81%ED%99%94%EC%A6%9D(AK)/ISIC_0605910.jpg' },
    { category: '피부섬유종',         url: '/static/images/%ED%94%BC%EB%B6%80%EC%84%AC%EC%9C%A0%EC%A2%85(DF)/ISIC_4324758.jpg' },
    // ── 블록 6: NV → DF → BCC → AK → MEL → VASC ──
    { category: '멜라닌세포성 모반', url: '/static/images/%EB%A9%9C%EB%9D%BC%EB%8B%8C%EC%84%B8%ED%8F%AC%EC%84%B1%20%EB%AA%A8%EB%B0%98(NV)/ISIC_0115114.jpg' },
    { category: '피부섬유종',         url: '/static/images/%ED%94%BC%EB%B6%80%EC%84%AC%EC%9C%A0%EC%A2%85(DF)/ISIC_4959784.jpg' },
    { category: '기저세포암',        url: '/static/images/%EA%B8%B0%EC%A0%80%EC%84%B8%ED%8F%AC%EC%95%94(BCC)/ISIC_0381913.jpg' },
    { category: '광선각화증',        url: '/static/images/%EA%B4%91%EC%84%A0%EA%B0%81%ED%99%94%EC%A6%9D(AK)/ISIC_0707479.jpg' },
    { category: '흑색종',            url: '/static/images/%ED%9D%91%EC%83%89%EC%A2%85(MEL)/ISIC_0320008.jpg' },
    { category: '혈관 병변',        url: '/static/images/%ED%98%88%EA%B4%80%20%EB%B3%91%EB%B3%80(VASC)/ISIC_5866736.jpg' },
  ]
  return c.json({ slides })
})

// ─────────────────────────────────────────────────────────────
// GET /api/task-images  –  AI 협업 과제 이미지 + AI 피드백 데이터
// (2개입단계.zip, 범주당 6개: 인덱스 0~2=정답 AI, 3~5=오답 AI)
// ─────────────────────────────────────────────────────────────
app.get('/api/task-images', (c) => {
  const CATS = ['광선각화증','기저세포암','멜라닌세포성 모반','피부섬유종','혈관 병변','흑색종']

  // 표시명(약자 없음) → 실제 폴더명(약자 포함) 매핑
  const FOLDER: Record<string, string> = {
    '광선각화증':        '광선각화증(AK)',
    '기저세포암':        '기저세포암(BCC)',
    '멜라닌세포성 모반': '멜라닌세포성 모반(NV)',
    '피부섬유종':        '피부섬유종(DF)',
    '혈관 병변':         '혈관 병변(VASC)',
    '흑색종':            '흑색종(MEL)',
  }

  // 오답용 카테고리 풀 (각 카테고리의 그럴듯한 오답 2가지 - 카테고리별 고정)
  const wrongAnswers: Record<string, [string, string]> = {
    '광선각화증':       ['기저세포암',       '흑색종'],
    '기저세포암':      ['광선각화증',        '멜라닌세포성 모반'],
    '멜라닌세포성 모반':['흑색종',           '피부섬유종'],
    '피부섬유종':       ['멜라닌세포성 모반', '혈관 병변'],
    '혈관 병변':      ['피부섬유종',        '광선각화증'],
    '흑색종':          ['멜라닌세포성 모반', '기저세포암'],
  }

  // AI 분석 근거 문장 (카테고리별, 정답/오답 각 1벌)
  const reasons: Record<string, { correct: string; wrong: string[] }> = {
    '광선각화증': {
      correct: '표면의 각질화 패턴과 홍반성 배경이 관찰됩니다. 경계가 불규칙하며 거친 표면 텍스처와 미세한 케라틴 구조물이 확인되어 광선각화증으로 분류하였습니다.',
      wrong: [
        '가지형 혈관 구조와 청회색 색소 침착이 확인됩니다. 색소망이 불규칙하게 분포하고 있어 기저세포암의 전형적 소견으로 판단하였습니다.',
        '불규칙한 경계와 다색성 색소 분포가 관찰됩니다. 비대칭적 구조와 비정형 색소망이 뚜렷하여 흑색종으로 분류하였습니다.',
      ]
    },
    '기저세포암': {
      correct: '색소망의 부재와 함께 가지형 혈관 구조가 명확히 관찰됩니다. 청회색 구조물과 궤양성 변화가 확인되어 기저세포암으로 분류하였습니다.',
      wrong: [
        '표면의 각질화와 홍반성 변화가 관찰됩니다. 경계부의 거친 텍스처와 케라틴 비후 소견이 광선각화증 패턴과 일치합니다.',
        '균일한 색상 분포와 대칭적 구조가 확인됩니다. 규칙적인 색소망과 명확한 경계가 멜라닌세포성 모반의 전형적 소견입니다.',
      ]
    },
    '멜라닌세포성 모반': {
      correct: '균일한 색상 분포와 대칭적인 구조가 확인됩니다. 규칙적인 색소망과 명확한 경계선이 관찰되어 멜라닌세포성 모반으로 분류하였습니다.',
      wrong: [
        '비대칭성 및 불규칙한 경계 소견이 관찰됩니다. 다색성 색소 분포와 비정형 색소망이 확인되어 흑색종으로 분류하였습니다.',
        '중심부 백색 반흔과 주변부 색소망의 이중 패턴이 관찰됩니다. 중심-주변 대비 구조가 뚜렷하여 피부섬유종으로 판단하였습니다.',
      ]
    },
    '피부섬유종': {
      correct: '중심부에 백색 반흔 형태의 구조물이 확인됩니다. 주변부의 색소망과 결합된 특징적인 중심-주변 대비 패턴이 관찰되어 피부섬유종으로 분류하였습니다.',
      wrong: [
        '균일한 색소 분포와 규칙적인 색소망이 관찰됩니다. 대칭적 구조와 명확한 경계가 멜라닌세포성 모반의 전형적 패턴과 일치합니다.',
        '적색 계열의 색상과 함께 혈관 구조물이 관찰됩니다. 표재성 혈관 확장 소견이 혈관 병변의 특성에 부합합니다.',
      ]
    },
    '혈관 병변': {
      correct: '적색 및 청색 계열의 색상 분포가 확인됩니다. 병변 내 혈관 구조가 명확히 관찰되며 주변 조직과의 경계가 뚜렷하여 혈관 병변으로 분류하였습니다.',
      wrong: [
        '중심부 백색 구조물과 주변 색소망의 이중 패턴이 확인됩니다. 특징적인 중심-주변 대비 구조가 피부섬유종과 일치합니다.',
        '표면의 각질화와 홍반성 변화가 관찰됩니다. 불규칙한 경계와 케라틴 비후 소견이 광선각화증 패턴에 해당합니다.',
      ]
    },
    '흑색종': {
      correct: '비대칭적 구조와 불규칙한 경계가 뚜렷하게 관찰됩니다. 다색성 색소 분포와 비정형 색소망, 색소 퇴행 소견이 확인되어 흑색종으로 분류하였습니다.',
      wrong: [
        '균일한 색소 분포와 대칭적 구조가 관찰됩니다. 규칙적인 색소망과 명확한 경계선이 멜라닌세포성 모반의 특성과 일치합니다.',
        '가지형 혈관과 청회색 색소 침착이 확인됩니다. 색소망 소실과 궤양성 변화 소견이 기저세포암 패턴에 부합합니다.',
      ]
    },
  }

  // 카테고리별 파일 목록 (2개입단계.zip, 범주당 6개)
  // 인덱스 0~2 → 정답 AI 피드백, 3~5 → 오답(가짜) AI 피드백
  const files: Record<string, string[]> = {
    '광선각화증':        ['ISIC_0723926.jpg','ISIC_0970615.jpg','ISIC_1076265.jpg','ISIC_1099402.jpg','ISIC_1115156.jpg','ISIC_1119486.jpg'],
    '기저세포암':       ['ISIC_0382621.jpg','ISIC_0913648.jpg','ISIC_0962183.jpg','ISIC_1186941.jpg','ISIC_1217127.jpg','ISIC_1230479.jpg'],
    '멜라닌세포성 모반': ['ISIC_0125513.jpg','ISIC_0167803.jpg','ISIC_0174869.jpg','ISIC_0179367.jpg','ISIC_0216815.jpg','ISIC_0356038.jpg'],
    '피부섬유종':         ['ISIC_5813817.jpg','ISIC_5844410.jpg','ISIC_6043617.jpg','ISIC_6312345.jpg','ISIC_6558326.jpg','ISIC_6943256.jpg'],
    '혈관 병변':        ['ISIC_6141128.jpg','ISIC_6192197.jpg','ISIC_7134919.jpg','ISIC_8020470.jpg','ISIC_8190843.jpg','ISIC_8462138.jpg'],
    '흑색종':            ['ISIC_0406149.jpg','ISIC_0410802.jpg','ISIC_0414164.jpg','ISIC_0529633.jpg','ISIC_1019384.jpg','ISIC_1074795.jpg'],
  }

  const tasks: {
    url: string
    correctCategory: string
    aiCategory: string
    aiReason: string
    aiCorrect: boolean
  }[] = []

  for (const cat of CATS) {
    const fList = files[cat]
    const r     = reasons[cat]
    const w     = wrongAnswers[cat]
    fList.forEach((f, i) => {
      // 0~2: 정답 AI, 3~4: 오답1, 5: 오답2
      const isCorrect = i < 3
      const wrongIdx  = i < 5 ? 0 : 1
      tasks.push({
        url: `/static/task-images/${encodeURIComponent(FOLDER[cat] ?? cat)}/${f}`,
        correctCategory: cat,
        aiCategory: isCorrect ? cat : w[wrongIdx],
        aiReason:   isCorrect ? r.correct : r.wrong[wrongIdx],
        aiCorrect:  isCorrect,
      })
    })
  }

  return c.json({ tasks, categories: CATS })
})


// ─────────────────────────────────────────────────────────────
// GET /api/exam-images  –  시험 단계 이미지 (3시험단계.zip, 범주당 4개)
// ─────────────────────────────────────────────────────────────
app.get('/api/exam-images', (c) => {
  // 표시명(약자 없음) → 실제 폴더명(약자 포함) 매핑
  const FOLDER: Record<string, string> = {
    '광선각화증':        '광선각화증(AK)',
    '기저세포암':        '기저세포암(BCC)',
    '멜라닌세포성 모반': '멜라닌세포성 모반(NV)',
    '피부섬유종':        '피부섬유종(DF)',
    '혈관 병변':         '혈관 병변(VASC)',
    '흑색종':            '흑색종(MEL)',
  }

  const examImages: Record<string, string[]> = {
    '광선각화증':        ['ISIC_3004699.jpg','ISIC_3009842.jpg','ISIC_3531459.jpg','ISIC_3532225.jpg'],
    '기저세포암':       ['ISIC_1464471.jpg','ISIC_1484722.jpg','ISIC_2231864.jpg','ISIC_2232926.jpg'],
    '멜라닌세포성 모반': ['ISIC_0422017.jpg','ISIC_0597607.jpg','ISIC_0767613.jpg','ISIC_0769255.jpg'],
    '피부섬유종':         ['ISIC_7009788.jpg','ISIC_7454975.jpg','ISIC_8705648.jpg','ISIC_8981897.jpg'],
    '혈관 병변':        ['ISIC_8600102.jpg','ISIC_8614567.jpg','ISIC_8791057.jpg','ISIC_9504198.jpg'],
    '흑색종':            ['ISIC_1264034.jpg','ISIC_1285798.jpg','ISIC_3642584.jpg','ISIC_4563142.jpg'],
  }

  const exams: { url: string; correctCategory: string }[] = []
  for (const [cat, files] of Object.entries(examImages)) {
    for (const f of files) {
      exams.push({
        url: `/static/exam-images/${encodeURIComponent(FOLDER[cat] ?? cat)}/${f}`,
        correctCategory: cat,
      })
    }
  }
  return c.json({ exams })
})


app.post('/api/submit', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body) return c.json({ error: 'bad_request' }, 400)

  const { participant_id, responses } = body
  if (!participant_id || !responses) return c.json({ error: 'missing_fields' }, 400)

  const submittedAt = new Date().toISOString()
  const dateStr     = submittedAt.slice(0, 10)          // "YYYY-MM-DD"
  const group       = responses._group ?? 'unknown'

  // IP 해시 (익명화)
  const rawIp  = c.req.header('CF-Connecting-IP')
              ?? c.req.header('X-Forwarded-For')
              ?? 'unknown'
  const ipHash = await hashIp(rawIp)

  // 저장할 전체 페이로드
  const payload = {
    participant_id,
    group,
    ip_hash:      ipHash,
    submitted_at: submittedAt,
    responses
  }

  const token = c.env?.GITHUB_TOKEN
  const owner = c.env?.GITHUB_OWNER
  const repo  = c.env?.GITHUB_REPO

  const isConfigured = !!(
    token && owner && repo
    && !token.includes('여기에')
    && !owner.includes('your-')
  )

  if (isConfigured) {
    // ── GitHub Contents API: responses/{날짜}/{pid_8자리}_{timestamp}.json ──
    const safeId   = participant_id.slice(0, 8).replace(/[^a-z0-9]/gi, '_')
    const tsMs     = Date.now()
    const filePath = `responses/${dateStr}/${safeId}_${tsMs}.json`
    // Cloudflare Workers 런타임: unescape()가 없으므로 TextEncoder 방식으로 base64 인코딩
    // 청크 처리로 스택 오버플로우 방지 (대용량 JSON 안전)
    const jsonStr  = JSON.stringify(payload, null, 2)
    const encoded  = new TextEncoder().encode(jsonStr)
    let binary = ''
    for (let i = 0; i < encoded.length; i++) binary += String.fromCharCode(encoded[i])
    const content  = btoa(binary)

    try {
      const ghRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
        {
          method: 'PUT',
          headers: {
            'Authorization':        `Bearer ${token}`,
            'Content-Type':         'application/json',
            'Accept':               'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent':           'experiment-webapp'
          },
          body: JSON.stringify({
            message: `[응답] ${dateStr} | ${safeId} | group:${group}`,
            content
          })
        }
      )

      if (!ghRes.ok) {
        const detail = await ghRes.text()
        console.error('[SUBMIT] GitHub API error:', detail)
        // GitHub 저장 실패해도 콘솔에 전체 데이터 출력 후 성공 반환 (참가자 차단 방지)
        console.log('[SUBMIT][FALLBACK]', JSON.stringify(payload, null, 2))
        return c.json({ status: 'ok', saved: 'console_fallback', github_error: detail })
      }

      const result = await ghRes.json() as { content: { path: string } }
      return c.json({ status: 'ok', saved: 'github', path: result.content?.path ?? filePath })

    } catch (err) {
      console.error('[SUBMIT] upstream error:', err)
      // 네트워크 오류도 콘솔 폴백 후 성공 반환
      console.log('[SUBMIT][FALLBACK]', JSON.stringify(payload, null, 2))
      return c.json({ status: 'ok', saved: 'console_fallback', upstream_error: String(err) })
    }
  }

  // GitHub 미설정 시 → 콘솔 출력 후 성공 반환
  console.log('[SUBMIT]', JSON.stringify(payload, null, 2))
  return c.json({ status: 'ok', saved: 'console' })
})

// ─────────────────────────────────────────────────────────────
// POST /api/backup  — 제출 직전 sessionStorage raw 데이터를 GitHub에 백업
//   • 성공/실패 모두 200 반환 (제출 흐름을 절대 막지 않음)
//   • 저장 경로: responses/{날짜}/{pid}_backup_{timestamp}.json
//   • 정식 응답 파일과 구분: 파일명에 _backup_ 포함
// ─────────────────────────────────────────────────────────────
app.post('/api/backup', async (c) => {
  try {
    const body = await c.req.json().catch(() => null)
    if (!body?.participant_id || !body?.session_raw) {
      return c.json({ status: 'skip', reason: 'missing_fields' })
    }

    const { participant_id, session_raw } = body
    const token = c.env?.GITHUB_TOKEN
    const owner = c.env?.GITHUB_OWNER
    const repo  = c.env?.GITHUB_REPO

    const isConfigured = !!(
      token && owner && repo
      && !token.includes('여기에')
      && !owner.includes('your-')
    )
    if (!isConfigured) return c.json({ status: 'skip', reason: 'not_configured' })

    const now      = new Date().toISOString()
    const dateStr  = now.slice(0, 10)
    const safeId   = participant_id.slice(0, 8).replace(/[^a-z0-9]/gi, '_')
    const tsMs     = Date.now()
    const filePath = `responses/${dateStr}/${safeId}_backup_${tsMs}.json`

    const payload  = { participant_id, backed_up_at: now, session_raw }
    const jsonStr  = JSON.stringify(payload, null, 2)
    const encoded  = new TextEncoder().encode(jsonStr)
    let binary = ''
    for (let i = 0; i < encoded.length; i++) binary += String.fromCharCode(encoded[i])
    const content = btoa(binary)

    const ghRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          'Authorization':        `Bearer ${token}`,
          'Content-Type':         'application/json',
          'Accept':               'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent':           'experiment-webapp'
        },
        body: JSON.stringify({
          message: `[백업] ${dateStr} | ${safeId}`,
          content
        })
      }
    )

    if (!ghRes.ok) {
      const detail = await ghRes.text()
      console.error('[BACKUP] GitHub API error:', detail)
      return c.json({ status: 'error', reason: 'github_api_error' })
    }

    return c.json({ status: 'ok', path: filePath })

  } catch (err) {
    // 백업 실패는 조용히 처리 — 제출 흐름에 영향 없음
    console.error('[BACKUP] error:', err)
    return c.json({ status: 'error', reason: String(err) })
  }
})

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + 'exp_salt_2025')
  const buf  = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─────────────────────────────────────────────────────────────
// GET /
// 흐름: consent → branch → instruct1 → instruct2 → survey → done
// ─────────────────────────────────────────────────────────────
app.get('/', (c) => {
  return c.html(/* html */`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>온라인 실험 참가</title>
  <link rel="stylesheet" href="/static/style.css" />
</head>
<body>

<!-- ══════════════════════════════════════════════════════════
     STEP 0 : (제거됨) 참가 안내 & 동의 — 더 이상 표시 안 함
══════════════════════════════════════════════════════════ -->
<div id="step-consent" class="step" style="display:none">
  <div class="page-wrap">
    <header class="page-header">
      <h1>온라인 실험 연구 안내</h1>
    </header>
    <div class="card">
      <div class="btn-row">
        <button id="btn-start" class="btn-primary" disabled>다음 단계로 →</button>
      </div>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     STEP 1 : 조건 선택
══════════════════════════════════════════════════════════ -->
<div id="step-branch" class="step active">
  <div class="page-wrap">
    <header class="page-header">
      <h1>참가 조건을 선택해 주세요</h1>
    </header>
    <div class="branch-wrap">
      <button class="branch-btn" id="btn-group-c">T</button>
      <button class="branch-btn branch-btn--exp" id="btn-group-e">J</button>
      <button class="branch-btn" id="btn-group-a">A</button>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     STEP 2 : 실험 시작 지시문 1
══════════════════════════════════════════════════════════ -->
<div id="step-instruct1" class="step">
  <div class="page-wrap">
    <div class="card instruct-card">
      <p class="instruct-lead">지금부터 실험을 시작합니다.</p>

      <div class="instruct-body">
        <p>실험에 참여하는 동안, 컴퓨터를 이용한 다른 작업(예. 카카오톡, 인터넷 서핑 등)을 할 수 없습니다.</p>
        <p>모든 실험단계에 집중하여 성심성의껏 참여해 주시길 요청드립니다.</p>
        <p>또한, 필기구나 휴대폰 등을 활용해 학습내용을 기록할 수 없습니다.</p>
      </div>

      <div class="btn-row">
        <button id="btn-instruct1-next" class="btn-arrow" aria-label="다음으로">→</button>
      </div>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     STEP 3 : 학습 안내 지시문 2
══════════════════════════════════════════════════════════ -->
<div id="step-instruct2" class="step">
  <div class="page-wrap">
    <div class="card instruct-card">
      <p class="instruct-lead">지금부터 6종의 피부 병변을 진단하기 위한 학습을 시작합니다.</p>

      <div class="instruct-body">
        <p>한 장씩 제시되는 피부 병변의 사진과 이름을 보며 시각적 특징을 학습하면 됩니다.<br>
        화면은 5초마다 자동으로 넘어가며, 다음 화면으로 넘어가면 앞으로 돌아갈 수 없습니다.</p>
        <p>학습할 피부 병변 6종의 이름은 다음과 같습니다.</p>

        <p class="lesion-names">
          <strong>광선각화증, 기저세포암, 멜라닌세포성 모반, 피부섬유종, 혈관 병변, 흑색종</strong>
        </p>

        <p class="instruct-ready">준비되었으면 아래 버튼을 눌러주세요. 학습이 시작됩니다.</p>
      </div>

      <div class="btn-row">
        <button id="btn-instruct2-next" class="btn-primary">학습 시작하기</button>
      </div>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     STEP 4 : 자동 학습 (이미지 슬라이드)
     – 5초 자동 전환, 사용자 조작 불가
══════════════════════════════════════════════════════════ -->
<div id="step-learning" class="step">
  <div class="learning-screen">
    <img id="learn-img" src="" alt="" />
    <p id="learn-label"></p>
    <button id="btn-skip" class="btn-skip">(임시) skip →</button>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     STEP 4-B : 2바퀴 학습 시작 안내
══════════════════════════════════════════════════════════ -->
<div id="step-learning-break" class="step">
  <div class="page-wrap">
    <div class="card instruct-card">
      <div class="instruct-body" style="text-align:center">
        <p>지금부터 같은 학습을 한 번 더 하게 됩니다.</p>
        <p>준비되었으면 아래 버튼을 눌러주세요. 학습이 시작됩니다.</p>
      </div>
      <div class="btn-row" style="margin-top:2rem">
        <button id="btn-learning-break-next" class="btn-primary">학습 시작하기</button>
      </div>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     STEP 5 : 과제 안내 (task intro)
══════════════════════════════════════════════════════════ -->
<div id="step-task-intro" class="step">
  <div class="page-wrap">
    <div class="card instruct-card">
      <div class="instruct-body">
        <p class="instruct-lead">학습이 끝났습니다. 지금부터 피부 병변 분류 과제를 시작합니다.</p>
        <p>이 과제에서는 피부 병변 이미지를 보고 해당 병변의 범주를 판단하게 됩니다.</p>
        <p>각 이미지에 대해 아래의 순서대로 진행합니다.</p>
        <!-- 집단별 순서 안내 (JS가 채움) -->
        <ol id="task-intro-steps" class="lesion-list"></ol>
        <p>위 과정을 모든 이미지에 대해 반복합니다.</p>
        <p class="instruct-ready">준비되었으면 아래 버튼을 눌러주세요.</p>
      </div>
      <div class="btn-row">
        <button id="btn-task-intro-next" class="btn-primary">과제 시작하기</button>
      </div>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     STEP 6 : 과제 (E/C집단) — 한 화면 연속 표시
     이미지(왼쪽) | 박스 스택(오른쪽) 2열 레이아웃
══════════════════════════════════════════════════════════ -->
<div id="step-task" class="step">
  <div class="task-screen">

    <!-- (임시) skip -->
    <div class="task-skip-row">
      <button id="btn-task-skip" class="btn-skip">(임시) skip →</button>
    </div>

    <!-- 진행바 -->
    <div class="task-prog-inline">
      <span id="task-progress-text" class="task-progress-text"></span>
      <div class="task-progress-track"><div id="task-progress-fill" class="task-progress-fill"></div></div>
    </div>

    <!-- 2열: 이미지 | 박스 -->
    <div class="task-cols">
      <!-- 왼쪽: 이미지 -->
      <div class="task-col-img">
        <img id="task-img-main" src="" alt="" class="task-img-main" />
      </div>

      <!-- 오른쪽: 박스 순차 표시 -->
      <div class="task-col-boxes">

        <!-- [박스 A] 초기 답안 -->
        <div id="box-initial" class="task-box task-box--active">
          <p class="task-box-desc">이 이미지의 피부 병변 범주를 선택하세요.</p>
          <div id="task-initial-choices" class="task-choices task-choices--compact"></div>
          <div class="btn-row" style="margin-top:.6rem">
            <button id="btn-initial-next" class="btn-primary btn-sm" disabled>다음 →</button>
          </div>
        </div>

        <!-- [박스 B] 확신도 (E집단 전용) -->
        <div id="box-confidence" class="task-box" style="display:none">
          <div id="task-exp-mid-content"></div>
          <div class="btn-row" style="margin-top:.6rem">
            <button id="btn-exp-mid-next" class="btn-primary btn-sm">다음 →</button>
          </div>
        </div>

        <!-- [박스 C] AI 분석 결과 -->
        <div id="box-ai" class="task-box" style="display:none">
          <p class="ai-label-row" style="margin:0">
            <span class="ai-badge">AI 분석 결과</span>
            <strong id="ai-category-text"></strong>
          </p>
          <p id="ai-reason-text" class="ai-reason" style="font-size:.82rem;margin-top:.3rem"></p>
          <div class="btn-row" style="margin-top:.6rem">
            <button id="btn-ai-next" class="btn-primary btn-sm">다음 →</button>
          </div>
        </div>

        <!-- [박스 D] 최종 답안 -->
        <div id="box-final" class="task-box" style="display:none">
          <p class="task-box-desc">자신의 판단과 AI의 의견을 종합하여 최종 답안을 선택하세요.</p>
          <div id="task-final-choices" class="task-choices task-choices--compact"></div>
          <div class="btn-row" style="margin-top:.6rem">
            <button id="btn-final-next" class="btn-primary btn-sm" disabled>제출</button>
          </div>
        </div>

      </div>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     STEP 6-A : 비교집단(A) 전용 과제 — 한 화면 연속 표시
══════════════════════════════════════════════════════════ -->
<div id="step-task-a" class="step">
  <div class="task-screen">

    <!-- (임시) skip -->
    <div class="task-skip-row">
      <button id="btn-task-a-skip" class="btn-skip">(임시) skip →</button>
    </div>

    <!-- 진행바 -->
    <div class="task-prog-inline">
      <span id="task-progress-text-a" class="task-progress-text"></span>
      <div class="task-progress-track"><div id="task-progress-fill-a" class="task-progress-fill"></div></div>
    </div>

    <!-- 2열: 이미지 | 박스 -->
    <div class="task-cols">
      <div class="task-col-img">
        <img id="task-img-a" src="" alt="" class="task-img-main" />
      </div>
      <div class="task-col-boxes">

        <!-- [박스 A] AI 분석 결과 -->
        <div id="box-a-ai" class="task-box task-box--active">
          <p class="ai-label-row" style="margin:0">
            <span class="ai-badge">AI 분석 결과</span>
            <strong id="ai-category-text-a"></strong>
          </p>
          <p id="ai-reason-text-a" class="ai-reason" style="font-size:.82rem;margin-top:.3rem"></p>
          <div class="btn-row" style="margin-top:.6rem">
            <button id="btn-a-ai-next" class="btn-primary btn-sm">다음 →</button>
          </div>
        </div>

        <!-- [박스 B] 최종 답안 -->
        <div id="task-a-final-box" class="task-box" style="display:none">
          <p class="task-box-desc">자신의 판단과 AI의 의견을 종합하여 최종 답안을 선택하세요.</p>
          <div id="task-a-final-choices" class="task-choices task-choices--compact"></div>
          <div class="btn-row" style="margin-top:.6rem">
            <button id="btn-a-final-submit" class="btn-primary btn-sm" disabled>제출</button>
          </div>
        </div>

      </div>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     STEP 7 : 수학 문제 안내
══════════════════════════════════════════════════════════ -->
<div id="step-math-intro" class="step">
  <div class="page-wrap">
    <div class="card instruct-card">
      <div class="instruct-body">
        <p class="instruct-lead">피부 병변 분류 과제를 마쳤습니다. 이제 간단한 수학 문제를 풉니다.</p>
        <p>3분 동안 문제를 풀 수 있으며, 3분이 되면 자동으로 페이지가 넘어갑니다.<br>문제를 가능한 한 빠르고 정확하게 풀어주세요.</p>
        <p class="instruct-ready">준비 되었으면 아래 버튼을 눌러주세요.</p>
      </div>
      <div class="btn-row">
        <button id="btn-math-intro-next" class="btn-primary">시작하기</button>
      </div>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     STEP 8 : 수학 문제 풀이 (3분 타이머)
══════════════════════════════════════════════════════════ -->
<div id="step-math" class="step">
  <div class="page-wrap">
    <div class="card math-card">
      <p id="math-question" class="math-question"></p>
      <div class="math-input-row">
        <input type="number" id="math-answer" class="math-input" placeholder="답을 입력하세요" autocomplete="off" />
        <button id="btn-math-submit" class="btn-primary">확인</button>
      </div>
    </div>
    <div style="text-align:right;margin-top:0.8rem">
      <button id="btn-math-skip" class="btn-skip">(임시) skip →</button>
    </div>

  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     STEP 9 : 회상 지시문
══════════════════════════════════════════════════════════ -->
<div id="step-recall-intro" class="step">
  <div class="page-wrap">
    <div class="card instruct-card">
      <div class="instruct-body">
        <p class="instruct-lead">지금부터는 앞서 학습한 피부 병변 이미지에 관한 질문이 제시될 것입니다.</p>
        <p>질문이 제시되면 앞에서 배웠던 지문의 내용과 본인의 학습 과정에 대해 충분히 생각한 후, 질문에 대한 답을 해주세요.</p>
        <p>답 입력은 질문이 제시된 후 10초 이후부터 작성할 수 있습니다.<br>처음 10초 동안은 질문에 대한 응답을 잘 생각해본 후, 답을 입력하라는 지시문이 나타나면 답을 입력해주세요.</p>
        <p class="instruct-ready">준비가 되었으면 아래 버튼을 눌러주세요.</p>
      </div>
      <div class="btn-row">
        <button id="btn-recall-intro-next" class="btn-primary">시작하기</button>
      </div>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     STEP 10-A : AI 협업 과제 정확도 추정
══════════════════════════════════════════════════════════ -->
<div id="step-task-conf" class="step">
  <div class="page-wrap">
    <div class="card">
      <fieldset>
        <legend style="font-size:1.05rem;font-weight:600;line-height:1.7">
          앞서 진행된 AI 협업 피부 병변 분류 과제에서 얼마나 정답을 맞혔다고 생각하나요? 0에서 100 사이의 값으로 표시하십시오.<br>
          <span style="font-size:.93rem;font-weight:400;color:var(--muted)">최종적으로 제출한 답변에 대한 정답률을 예측해보세요</span>
        </legend>
        <div class="math-input-row" style="max-width:300px;margin-top:1.4rem">
          <input type="number" id="task-conf-input" min="0" max="100" class="math-input" placeholder="0 – 100" />
          <span style="font-size:1.1rem;font-weight:600;color:var(--muted)">%</span>
        </div>
      </fieldset>
      <div class="btn-row" style="margin-top:1.4rem">
        <button id="btn-task-conf-next" class="btn-primary">다음 →</button>
      </div>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     STEP 10-B : AI 없이 자신감 입력
══════════════════════════════════════════════════════════ -->
<div id="step-recall" class="step">
  <div class="page-wrap">
    <div class="card instruct-card">
      <div class="instruct-body">
        <div id="recall-question-area">
          <p id="recall-question-text" class="instruct-lead"></p>
          <div id="recall-countdown-area" class="recall-countdown-area">
            <span id="recall-countdown" class="recall-countdown">10</span>
            <p class="recall-countdown-label">초 후 답변 입력 가능</p>
          </div>
          <div id="recall-answer-area" class="recall-answer-area" style="display:none">
            <div id="recall-answer-content"></div>
            <div class="btn-row" style="margin-top:1.2rem">
              <button id="btn-recall-next" class="btn-primary">다음 →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     STEP 11 : 시험 안내
══════════════════════════════════════════════════════════ -->
<div id="step-exam-intro" class="step">
  <div class="page-wrap">
    <div class="card instruct-card">
      <div class="instruct-body">
        <p class="instruct-lead">지금부터는 AI 없이 피부 병변 범주를 분류하는 문제를 풀게 됩니다.</p>
        <p>피부 병변 이미지가 제시되면, 해당하는 병변의 종류를 보기에서 찾아 선택하세요.</p>
        <p class="instruct-ready">준비되었으면 아래 버튼을 눌러주세요.</p>
      </div>
      <div class="btn-row">
        <button id="btn-exam-intro-next" class="btn-primary">시험 시작하기</button>
      </div>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     STEP 12 : 시험 문제
══════════════════════════════════════════════════════════ -->
<div id="step-exam" class="step">
  <div class="page-wrap">
    <!-- (임시) 시험 전체 skip 버튼 -->
    <div style="text-align:right">
      <button id="btn-exam-skip" class="btn-skip">(임시) skip →</button>
    </div>
    <div id="exam-img-card" class="card task-img-card">
      <img id="exam-img" src="" alt="" class="task-img" />
    </div>
    <div id="exam-ans-card" class="card">
      <fieldset>
        <legend id="exam-legend">이 이미지의 피부 병변 범주를 선택하세요.</legend>
        <div id="exam-choices" class="task-choices"></div>
      </fieldset>
      <div class="btn-row" style="margin-top:1.2rem">
        <button id="btn-exam-next" class="btn-primary" disabled>다음 →</button>
      </div>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     STEP 13-0 : 사후 설문 안내
══════════════════════════════════════════════════════════ -->
<div id="step-ps-0" class="step">
  <div class="page-wrap">
    <div class="card instruct-card">
      <div class="instruct-body">
        <p class="instruct-lead">모든 시험이 끝났습니다.</p>
        <p>지금부터는 다음 질문을 읽고, 해당하는 정도에 체크해주세요.</p>
        <p style="margin-top:.8rem;font-size:.9rem"><strong style="color:#e53e3e">(답변에 관계없이 실험이 완료되면 보상이 지급되니, 솔직하게 응답해주세요.)</strong></p>
        <p class="instruct-ready">준비되었으면 아래 버튼을 눌러주세요.</p>
      </div>
      <div class="btn-row">
        <button id="btn-ps0-next" class="btn-primary">다음 →</button>
      </div>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     STEP 13-1 : Q4 사전지식
══════════════════════════════════════════════════════════ -->
<div id="step-ps-1" class="step">
  <div class="page-wrap">
    <div class="card">
      <fieldset>
        <legend style="font-size:1.05rem;font-weight:600;line-height:1.6"><strong style="color:#e53e3e">본 실험에 참가하기 전</strong>, 피부 병변에 대해 얼마나 알고 있었나요?<br>
          <span style="font-size:.93rem;font-weight:400;color:var(--muted)">피부 병변에 대한 사전지식이 얼마나 있었는지 7점 척도로 응답해주세요.</span>
        </legend>
        <div class="scale-row" style="margin-top:1.4rem">
          <span class="scale-label-end" style="font-size:.75rem">피부 병변에 대한<br>사전지식이<br>전혀 없었음</span>
          <label class="scale-item"><input type="radio" name="q4" value="1" /><span>1</span></label>
          <label class="scale-item"><input type="radio" name="q4" value="2" /><span>2</span></label>
          <label class="scale-item"><input type="radio" name="q4" value="3" /><span>3</span></label>
          <label class="scale-item"><input type="radio" name="q4" value="4" /><span>4</span></label>
          <label class="scale-item"><input type="radio" name="q4" value="5" /><span>5</span></label>
          <label class="scale-item"><input type="radio" name="q4" value="6" /><span>6</span></label>
          <label class="scale-item"><input type="radio" name="q4" value="7" /><span>7</span></label>
          <span class="scale-label-end" style="font-size:.75rem">피부 병변에 대해<br>많이 알고<br>있었음</span>
        </div>
      </fieldset>
      <p id="ps1-err" class="inline-err" style="display:none"></p>
      <div class="btn-row" style="margin-top:1.4rem">
        <button id="btn-ps1-next" class="btn-primary" disabled>다음 →</button>
      </div>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     STEP 13-2 : Q5 초기 정확도 예측
══════════════════════════════════════════════════════════ -->
<div id="step-ps-2" class="step">
  <div class="page-wrap">
    <div class="card">
      <fieldset>
        <legend style="font-size:1.05rem;font-weight:600;line-height:1.7">만약 <strong style="color:#e53e3e">학습단계 없이</strong> 실험을 시작하자마자 바로 사진을 보고<br>피부 병변의 종류를 맞히는 시험을 봤다면, 몇 %의 문제를 맞혔을 거라고 생각하나요?<br>
          <span style="font-size:.93rem;font-weight:400;color:var(--muted)">0~100 사이의 숫자를 입력해주세요.</span>
        </legend>
        <div class="math-input-row" style="max-width:300px;margin-top:1.4rem">
          <input type="number" id="q5-input" name="q5" min="0" max="100" class="math-input" placeholder="0 – 100" />
          <span style="font-size:1.1rem;font-weight:600;color:var(--muted)">%</span>
        </div>
      </fieldset>
      <p id="ps2-err" class="inline-err" style="display:none"></p>
      <div class="btn-row" style="margin-top:1.4rem">
        <button id="btn-ps2-next" class="btn-primary">다음 →</button>
      </div>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     STEP 13-2b : AI 지식 설문 (맞다/틀리다)
══════════════════════════════════════════════════════════ -->
<div id="step-ai-survey" class="step">
  <div class="page-wrap">
    <div class="card" id="ai-survey-card">
      <!-- JS가 문항을 순차적으로 주입 -->
    </div>
    <p id="ai-survey-err" class="inline-err" style="display:none"></p>
    <div class="btn-row" style="margin-top:1.2rem;display:none" id="ai-survey-next-row">
      <button id="btn-ai-survey-next" class="btn-primary">다음 →</button>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     STEP 13-2c : AI 태도 설문 (동의 정도)
══════════════════════════════════════════════════════════ -->
<div id="step-ai-survey-b" class="step">
  <div class="page-wrap">
    <div class="card" id="ai-survey-b-card">
      <!-- JS가 문항을 순차적으로 주입 -->
    </div>
    <p id="ai-survey-b-err" class="inline-err" style="display:none"></p>
    <div class="btn-row" style="margin-top:1.2rem;display:none" id="ai-survey-b-next-row">
      <button id="btn-ai-survey-b-next" class="btn-primary">다음 →</button>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     STEP 13-3 : Q6 인구통계
══════════════════════════════════════════════════════════ -->
<div id="step-ps-3" class="step">
  <div class="page-wrap">
    <div class="card">
      <fieldset>
        <legend style="font-size:1.05rem;font-weight:600;line-height:1.6">지금부터는 아래의 질문에 답해주세요.</legend>
        <div class="demog-wrap" style="margin-top:1.2rem">
          <div class="demog-row">
            <label class="demog-label" for="q6-age">만 나이</label>
            <input type="number" id="q6-age" name="q6_age" min="0" max="120" class="demog-input" placeholder="숫자 입력" />
          </div>
          <div class="demog-row">
            <label class="demog-label">성별</label>
            <div class="demog-radio-group">
              <label class="demog-radio"><input type="radio" name="q6_gender" value="male" /><span>남자</span></label>
              <label class="demog-radio"><input type="radio" name="q6_gender" value="female" /><span>여자</span></label>
              <label class="demog-radio"><input type="radio" name="q6_gender" value="no_answer" /><span>응답을 원치 않음</span></label>
            </div>
          </div>
          <div class="demog-row">
            <label class="demog-label" for="q6-major">전공</label>
            <input type="text" id="q6-major" name="q6_major" class="demog-input" placeholder="전공을 입력해주세요" />
          </div>
        </div>
      </fieldset>
      <div class="btn-row" style="margin-top:1.4rem">
        <button id="btn-ps3-submit" class="btn-primary btn-full">제출하기</button>
      </div>
      <p id="ps3-err" class="inline-err" style="display:none"></p>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     STEP 14 : 설문 응답 (기존, 미사용 보존)
══════════════════════════════════════════════════════════ -->
<div id="step-survey" class="step">
  <div class="page-wrap">
    <header class="page-header">
      <h1>설문에 응답해 주세요</h1>
      <p class="page-sub">모든 문항에 응답한 후 제출 버튼을 눌러 주세요.</p>
    </header>

    <form id="survey-form" class="survey-form">

      <div class="card">
        <fieldset>
          <legend>Q1. 귀하의 연령대를 선택해 주세요.</legend>
          <div class="radio-grid">
            <label class="radio-card"><input type="radio" name="q1" value="10s" required /><span>10대</span></label>
            <label class="radio-card"><input type="radio" name="q1" value="20s" /><span>20대</span></label>
            <label class="radio-card"><input type="radio" name="q1" value="30s" /><span>30대</span></label>
            <label class="radio-card"><input type="radio" name="q1" value="40s" /><span>40대 이상</span></label>
          </div>
        </fieldset>
      </div>

      <div class="card">
        <fieldset>
          <legend>Q2. 오늘 기분은 어떠세요?</legend>
          <div class="scale-row">
            <span class="scale-label-end">매우 나쁨</span>
            <label class="scale-item"><input type="radio" name="q2" value="1" required /><span>1</span></label>
            <label class="scale-item"><input type="radio" name="q2" value="2" /><span>2</span></label>
            <label class="scale-item"><input type="radio" name="q2" value="3" /><span>3</span></label>
            <label class="scale-item"><input type="radio" name="q2" value="4" /><span>4</span></label>
            <label class="scale-item"><input type="radio" name="q2" value="5" /><span>5</span></label>
            <span class="scale-label-end">매우 좋음</span>
          </div>
        </fieldset>
      </div>

      <div id="group-questions"></div>

      <div class="card form-footer-card">
        <button type="submit" id="btn-submit" class="btn-primary btn-full">응답 제출하기</button>
      </div>

    </form>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     STEP 12 : 완료
══════════════════════════════════════════════════════════ -->
<div id="step-done" class="step">
  <div class="page-wrap page-wrap--center">
    <div class="result-card">
      <div class="result-icon result-icon--ok">✓</div>
      <h2>실험에 참여해 주셔서 감사합니다.</h2>
      <p>응답해 주신 내용이 제출되었습니다.</p>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     STEP E : 오류
══════════════════════════════════════════════════════════ -->
<div id="step-error" class="step">
  <div class="page-wrap page-wrap--center">
    <div class="result-card">
      <div class="result-icon result-icon--err">✕</div>
      <h2>제출 오류</h2>
      <p id="error-msg" class="muted"></p>
      <button id="btn-retry" class="btn-secondary">다시 시도</button>
    </div>
  </div>
</div>

<script src="/static/experiment.js"></script>
</body>
</html>`)
})

export default app
