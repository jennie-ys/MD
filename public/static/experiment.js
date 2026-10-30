/**
 * experiment.js  v7
 *
 * 흐름:
 *  STEP 0  consent       → 동의 체크 → [다음 단계로]
 *  STEP 1  branch        → [통제조건] 또는 [실험조건]
 *  STEP 2  instruct1     → 실험 시작 지시문 → [→]
 *  STEP 3  instruct2     → 학습 안내 지시문 → [학습 시작하기]
 *  STEP 4  learning      → 자동 이미지 슬라이드 (5초, 조작 불가)
 *  STEP 5  task-intro    → 과제 안내 → [과제 시작하기]
 *  STEP 6  task          → 초기진단 → (E조건: 신뢰도) → AI 피드백 → 최종진단 (36장 반복)
 *  STEP 7  math-intro    → 수학 문제 안내
 *  STEP 8  math          → 수학 문제 (3분 타이머, 100문제)
 *  STEP 9  recall-intro  → 회상 질문 안내
 *  STEP 10 recall        → AI없이 자신감 슬라이더
 *  STEP 11 exam-intro    → 시험 안내
 *  STEP 12 exam          → 시험 문제 (24문제)
 *  STEP 13 ps-0~3        → 사후 설문 (4페이지)
 *  STEP 14 done          → 완료
 *
 * 타이밍 추적:
 *  - 모든 페이지(step) 진입/이탈 시각 기록 → _page_durations
 *  - 과제 단계별(초기진단/신뢰도/AI/최종진단) 타이밍 → _task_phase_durations
 *  - 시험 단계별 타이밍 → _exam_durations
 *
 * 보안 원칙:
 *  - group('C'/'E'/'A')는 DOM 어디에도 노출하지 않는다
 *  - participant_id는 sessionStorage에만 존재
 */

;(function () {
  'use strict'

  const KEY_PID          = '__exp_pid__'
  const KEY_GROUP        = '__exp_group__'
  const KEY_STEP         = '__exp_step__'
  const KEY_DONE         = '__exp_done__'
  const KEY_TASK_ANSWERS = '__exp_task_answers__'

  // ════════════════════════════════════════════════════════════════
  // ── 타이밍 추적 시스템 ──────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════

  // 페이지별 머문 시간 기록 (단위: ms)
  // { stepId: [{ enter: isoString, leave: isoString, duration_ms: number }, ...] }
  const pageDurations = {}

  // 현재 활성 페이지 진입 시각 (Date.now() 기반)
  let _currentStepId   = null
  let _currentEnterTs  = null

  /**
   * 현재 페이지 이탈 처리 — 새 페이지 진입 전 호출
   */
  function _leaveCurrentPage() {
    if (!_currentStepId || !_currentEnterTs) return
    const leaveTs = Date.now()
    const dur     = leaveTs - _currentEnterTs
    if (!pageDurations[_currentStepId]) pageDurations[_currentStepId] = []
    pageDurations[_currentStepId].push({
      enter:       new Date(_currentEnterTs).toISOString(),
      leave:       new Date(leaveTs).toISOString(),
      duration_ms: dur
    })
  }

  /**
   * 새 페이지 진입 처리
   */
  function _enterPage(stepId) {
    _currentStepId  = stepId
    _currentEnterTs = Date.now()
  }

  // 과제 단계별 타이밍 (이미지 인덱스별)
  // _taskPhaseDurations[imgIdx] = { initial_ms, confidence_ms, ai_ms, final_ms }
  const taskPhaseDurations = []
  let _phaseEnterTs = null

  function taskPhaseEnter() {
    _phaseEnterTs = Date.now()
  }

  function taskPhaseLeave() {
    const elapsed = _phaseEnterTs ? Date.now() - _phaseEnterTs : null
    _phaseEnterTs = null
    return elapsed  // ms 반환
  }

  // 시험 단계별 타이밍
  const examDurations = []
  let _examEnterTs = null

  function examQuestionEnter() {
    _examEnterTs = Date.now()
  }

  function examQuestionLeave() {
    const elapsed = _examEnterTs ? Date.now() - _examEnterTs : null
    _examEnterTs = null
    return elapsed
  }

  // 수학 단계 타이밍
  let _mathStartTs = null
  let _mathEndTs   = null

  // ════════════════════════════════════════════════════════════════
  // ── 유틸리티 ────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════

  function generateParticipantId() {
    const arr = new Uint8Array(16)
    crypto.getRandomValues(arr)
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
  }

  // ── 깜빡임(빈화면 0.5초) 유틸 ──────────────────────────────────────────────
  // imgEl   : <img> 요소
  // url     : 표시할 새 이미지 URL
  // cb      : 이미지가 표시된 후 실행할 콜백 (선택)
  function flashBlank(imgEl, url, cb) {
    if (!imgEl) { if (cb) cb(); return }
    imgEl.style.visibility = 'hidden'   // 이미지 숨김 (레이아웃 유지)
    imgEl.src = ''                      // 기존 이미지 초기화
    setTimeout(() => {
      imgEl.src = url
      imgEl.onload  = () => { imgEl.style.visibility = ''; if (cb) cb() }
      imgEl.onerror = () => { imgEl.style.visibility = ''; if (cb) cb() }
    }, 300)  // 0.3초 빈화면
  }

  // 단계 전환 — duration 자동 기록
  function showStep(id) {
    _leaveCurrentPage()
    document.querySelectorAll('.step').forEach(el => el.classList.remove('active'))
    const t = document.getElementById(id)
    if (t) t.classList.add('active')
    window.scrollTo(0, 0)
    sessionStorage.setItem(KEY_STEP, id)
    _enterPage(id)
  }

  // ── N초 후 버튼 조용히 표시 ────────────────────────────────────
  // btnEl   : 숨겨놓을 버튼 요소
  // delay   : 다시 나타나기까지 대기 ms (기본 3000)
  function _revealBtnAfter(btnEl, delay) {
    if (!btnEl) return
    btnEl.style.display = 'none'
    setTimeout(() => { btnEl.style.display = '' }, delay ?? 3000)
  }

  // ID로 지정한 .inline-err 단락에 메시지 표시, duration ms 후 자동 숨김 (기본 3초)
  function _showErr(errId, msg, duration) {
    const el = document.getElementById(errId)
    if (!el) return
    el.textContent = msg
    el.style.display = ''
    clearTimeout(el._errT)
    el._errT = setTimeout(() => { el.style.display = 'none' }, duration ?? 3000)
  }

  // 숫자 입력 인라인 에러 표시 헬퍼
  // inputEl : 입력 요소, msg : 표시할 메시지 문자열
  // 에러 span을 input 바로 뒤에 삽입(이미 있으면 재사용), 2초 후 자동 제거
  function _showInputError(inputEl, msg) {
    if (!inputEl) return
    inputEl.style.outline = '2px solid #e53e3e'
    inputEl.focus()
    let errEl = inputEl.parentNode.querySelector('._input-err')
    if (!errEl) {
      errEl = document.createElement('span')
      errEl.className = '_input-err'
      errEl.style.cssText = 'color:#e53e3e;font-size:.88rem;margin-left:.6rem;font-weight:600'
      inputEl.parentNode.insertBefore(errEl, inputEl.nextSibling)
    }
    errEl.textContent = msg
    clearTimeout(errEl._t)
    errEl._t = setTimeout(() => {
      inputEl.style.outline = ''
      if (errEl.parentNode) errEl.parentNode.removeChild(errEl)
    }, 2500)
  }

  // 시드 기반 pseudo-random (mulberry32)
  function seededShuffle(arr, seed) {
    let s = seed >>> 0
    function rand() {
      s |= 0; s = s + 0x9e3779b9 | 0
      let t = Math.imul(s ^ s >>> 15, 1 | s)
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
      return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
    const out = arr.slice()
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }

  // ════════════════════════════════════════════════════════════════
  // ── 초기화 ──────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════

  // ── 참가자 ID → 집단 자동 배정 (균등 3분배) ──────────────────
  // pid(hex 문자열)의 첫 두 바이트를 합산해 0~2 나머지로 E/C/A 배정
  // 동일 pid는 항상 동일 집단 → 새로고침/세션 복원 시에도 일관성 유지
  function assignGroup(pid) {
    const b0 = parseInt(pid.slice(0, 2), 16) || 0
    const b1 = parseInt(pid.slice(2, 4), 16) || 0
    const groups = ['E', 'C', 'A']
    return groups[(b0 + b1) % 3]
  }

  function init() {
    let pid = sessionStorage.getItem(KEY_PID)
    if (!pid) {
      pid = generateParticipantId()
      sessionStorage.setItem(KEY_PID, pid)
    }

    // 집단이 아직 배정되지 않았으면 자동 배정
    if (!sessionStorage.getItem(KEY_GROUP)) {
      sessionStorage.setItem(KEY_GROUP, assignGroup(pid))
    }

    if (sessionStorage.getItem(KEY_DONE) === '1') {
      showStep('step-done')
      return
    }

    const savedStep  = sessionStorage.getItem(KEY_STEP)
    const savedGroup = sessionStorage.getItem(KEY_GROUP)

    if (savedStep === 'step-done') { showStep('step-done'); return }
    if (savedStep === 'step-survey' && savedGroup) { showStep('step-done'); return }
    if (savedStep === 'step-task' || savedStep === 'step-task-a' || savedStep === 'step-task-intro') {
      startTaskIntro(); return
    }
    if (savedStep === 'step-learning')       { startLearning(); return }
    if (savedStep === 'step-learning-break') { showStep('step-learning-break'); bindLearningBreakEvents(); return }
    if (savedStep === 'step-instruct2') { showStep('step-instruct2'); bindInstruct2Events(); return }
    if (savedStep === 'step-instruct1') { showStep('step-instruct1'); bindInstruct1Events(); return }
    if (savedStep === 'step-branch')    { showStep('step-branch');    bindBranchEvents();    return }

    // 동의 페이지 제거: 처음 방문 시 바로 branch(조건 선택)부터 시작
    showStep('step-branch')
    bindBranchEvents()
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 0 : 동의 ───────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════

  function bindConsentEvents() {
    const check    = document.getElementById('consent-check')
    const btnStart = document.getElementById('btn-start')
    if (!check || !btnStart) return
    check.addEventListener('change', () => { btnStart.disabled = !check.checked })
    btnStart.addEventListener('click', () => {
      if (!check.checked) return
      showStep('step-branch')
      bindBranchEvents()
    }, { once: true })
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 1 : 조건 선택 ──────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════

  function bindBranchEvents() {
    const btnC = document.getElementById('btn-group-c')
    const btnE = document.getElementById('btn-group-e')
    const btnA = document.getElementById('btn-group-a')
    function choose(group) {
      sessionStorage.setItem(KEY_GROUP, group)
      showStep('step-instruct1')
      bindInstruct1Events()
    }
    btnC?.addEventListener('click', () => choose('C'), { once: true })
    btnE?.addEventListener('click', () => choose('E'), { once: true })
    btnA?.addEventListener('click', () => choose('A'), { once: true })
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 2 : 지시문 1 ───────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════

  function bindInstruct1Events() {
    const btn = document.getElementById('btn-instruct1-next')
    btn?.addEventListener('click', () => {
      showStep('step-instruct2')
      bindInstruct2Events()
    }, { once: true })
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 3 : 지시문 2 ───────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════

  function bindInstruct2Events() {
    const btn = document.getElementById('btn-instruct2-next')
    btn?.addEventListener('click', () => { startLearning() }, { once: true })
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 4 : 자동 이미지 학습 ───────────────────────────────────
  // ════════════════════════════════════════════════════════════════

  let learningTimer = null
  let _learningSlidesCache = null  // fetch 결과 캐시 (2바퀴용)

  function startLearning() {
    showStep('step-learning')
    if (_learningSlidesCache) {
      // 이미 fetch된 경우 캐시 사용 (2바퀴 재시작 시)
      runSlideshow(_learningSlidesCache, 'first')
      return
    }
    fetch('/api/images')
      .then(r => r.json())
      .then(data => {
        _learningSlidesCache = data.slides
        runSlideshow(data.slides, 'first')
      })
      .catch(() => goToTaskIntro())
  }

  // round: 'first' | 'second'
  function runSlideshow(slides, round) {
    if (!slides || slides.length === 0) { goToTaskIntro(); return }
    const imgEl   = document.getElementById('learn-img')
    const labelEl = document.getElementById('learn-label')
    const skipBtn = document.getElementById('btn-skip')
    let idx = 0

    function blockKey(e) { e.preventDefault(); e.stopImmediatePropagation() }
    window.addEventListener('keydown',  blockKey, true)
    window.addEventListener('keyup',    blockKey, true)
    window.addEventListener('keypress', blockKey, true)

    function cleanup() {
      clearTimeout(learningTimer)
      window.removeEventListener('keydown',  blockKey, true)
      window.removeEventListener('keyup',    blockKey, true)
      window.removeEventListener('keypress', blockKey, true)
    }

    // 1바퀴 완료 후 분기: 2바퀴 안내 or 과제 이동
    function onSlideshowEnd() {
      cleanup()
      if (round === 'first') {
        showStep('step-learning-break')
        bindLearningBreakEvents()
      } else {
        goToTaskIntro()
      }
    }

    function revealSlide(i) {
      if (imgEl)   imgEl.src = slides[i].url
      if (imgEl)   imgEl.style.visibility = ''
      if (labelEl) {
        labelEl.textContent      = slides[i].category
        labelEl.style.visibility = ''
      }

      learningTimer = setTimeout(() => {
        if (imgEl)   imgEl.style.visibility   = 'hidden'
        if (labelEl) labelEl.style.visibility = 'hidden'

        learningTimer = setTimeout(() => {
          idx++
          if (idx >= slides.length) { onSlideshowEnd(); return }
          preloadAndShow(idx)
        }, 100)
      }, 5000)
    }

    function preloadAndShow(i) {
      const loader = new Image()
      loader.onload = loader.onerror = () => { revealSlide(i) }
      loader.src = slides[i].url
    }

    // skip 버튼: 현재 라운드 건너뛰기
    if (skipBtn) {
      const nb = skipBtn.cloneNode(true)
      skipBtn.parentNode.replaceChild(nb, skipBtn)
      nb.addEventListener('click', () => { onSlideshowEnd() }, { once: true })
    }

    preloadAndShow(0)
  }

  function bindLearningBreakEvents() {
    const btn = document.getElementById('btn-learning-break-next')
    if (!btn) return
    const nb = btn.cloneNode(true)
    btn.parentNode.replaceChild(nb, btn)
    nb.addEventListener('click', () => {
      showStep('step-learning')
      runSlideshow(_learningSlidesCache, 'second')
    }, { once: true })
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 5 : 과제 안내 ──────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════

  function goToTaskIntro() {
    showStep('step-task-intro')

    // 집단별 순서 안내문 채우기
    const stepsEl = document.getElementById('task-intro-steps')
    if (stepsEl) {
      const group = sessionStorage.getItem(KEY_GROUP)
      if (group === 'A') {
        stepsEl.innerHTML = `
          <li>피부 병변의 이미지와 해당 이미지의 범주에 대한 <strong>AI 분석 결과</strong>를 확인하십시오.</li>
          <li>자신의 판단과 AI의 의견을 종합하여 <strong>답안을 제출</strong>하십시오.</li>`
      } else {
        stepsEl.innerHTML = `
          <li>이미지를 충분히 관찰한 후, 해당 병변의 범주를 선택하여 <strong>초기 답안</strong>을 제출하십시오.</li>
          <li>동일한 이미지에 대한 <strong>AI 분석 결과</strong>를 확인하십시오.</li>
          <li>초기 판단과 AI의 의견을 종합하여 <strong>최종 답안</strong>을 제출하십시오.</li>`
      }
    }

    const btn = document.getElementById('btn-task-intro-next')
    if (btn) {
      const newBtn = btn.cloneNode(true)
      btn.parentNode.replaceChild(newBtn, btn)
      newBtn.addEventListener('click', () => startTask(), { once: true })
    }
  }

  function startTaskIntro() { goToTaskIntro() }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 6 : 과제 ───────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════

  let taskItems   = []
  let taskIdx     = 0
  let taskAnswers = []

  const CATS_SORTED = [
    '광선각화증', '기저세포암', '멜라닌세포성 모반',
    '피부섬유종', '혈관 병변', '흑색종'
  ]

  function startTask() {
    fetch('/api/task-images')
      .then(r => r.json())
      .then(data => {
        // 고정 순서: seededShuffle(seed=0xdeadbeef) 후 연속 동일 카테고리 제거
        // 인접 항목이 같은 correctCategory가 되지 않도록 수동 스왑 적용한 최종 인덱스 순서
        const FIXED_ORDER = [2,19,34,3,11,22,9,35,23,12,1,15,33,8,17,25,31,4,20,14,5,27,21,6,28,16,24,10,13,0,26,30,7,29,32,18]
        taskItems   = FIXED_ORDER.map(i => data.tasks[i])
        taskIdx     = 0
        taskAnswers = []
        updateProgressBar()

        const group = sessionStorage.getItem(KEY_GROUP)

        // ── (임시) task skip 버튼 ──────────────────────────────────
        const skipBtn = document.getElementById('btn-task-skip')
        if (skipBtn) {
          const newSkip = skipBtn.cloneNode(true)
          skipBtn.parentNode.replaceChild(newSkip, skipBtn)
          newSkip.addEventListener('click', () => {
            sessionStorage.setItem(KEY_TASK_ANSWERS, JSON.stringify(taskAnswers))
            goToMathIntro()
          }, { once: true })
        }
        const skipBtnA = document.getElementById('btn-task-a-skip')
        if (skipBtnA) {
          const newSkipA = skipBtnA.cloneNode(true)
          skipBtnA.parentNode.replaceChild(newSkipA, skipBtnA)
          newSkipA.addEventListener('click', () => {
            sessionStorage.setItem(KEY_TASK_ANSWERS, JSON.stringify(taskAnswers))
            goToMathIntro()
          }, { once: true })
        }
        // ──────────────────────────────────────────────────────────

        if (group === 'A') {
          showTaskPhaseA()
        } else {
          showTaskPhaseInitial()
        }
      })
      .catch(() => goToMathIntro())
  }

  function updateProgressBar() {
    const total   = taskItems.length
    const current = taskIdx + 1
    const pct     = total > 0 ? Math.round((taskIdx / total) * 100) : 0
    // E/C집단 진행바
    const textEl  = document.getElementById('task-progress-text')
    const fillEl  = document.getElementById('task-progress-fill')
    if (textEl) textEl.textContent = `${current} / ${total}`
    if (fillEl) fillEl.style.width = pct + '%'
    // A집단 진행바 (별도 ID)
    const textElA = document.getElementById('task-progress-text-a')
    const fillElA = document.getElementById('task-progress-fill-a')
    if (textElA) textElA.textContent = `${current} / ${total}`
    if (fillElA) fillElA.style.width = pct + '%'
  }

  function buildChoices(containerId, name) {
    const container = document.getElementById(containerId)
    if (!container) return
    container.innerHTML = CATS_SORTED.map((cat, i) => `
      <label class="task-choice">
        <input type="radio" name="${name}" value="${cat}" />
        <span class="task-choice-alpha">${String.fromCharCode(65 + i)}.</span>
        <span>${cat}</span>
      </label>`).join('')

    // 버튼은 buildChoices 호출 시점에 이미 _revealBtnAfter()로 숨겨짐
    // 라디오 선택 시 disabled만 해제 (display는 타이머가 이미 진행 중)
    const btnId = name === 'initial' ? 'btn-initial-next' : 'btn-final-next'
    container.querySelectorAll('input[type=radio]').forEach(r => {
      r.addEventListener('change', () => {
        const btn = document.getElementById(btnId)
        if (btn) btn.disabled = false
      })
    })
  }


  // ── 한 화면 연속 표시: 박스 잠금 헬퍼 ───────────────────────────
  function _lockBox(boxId) {
    const box = document.getElementById(boxId)
    if (!box) return
    box.classList.remove('task-box--active')
    box.classList.add('task-box--locked')
  }
  function _openBox(boxId) {
    const box = document.getElementById(boxId)
    if (!box) return
    box.style.display = ''
    box.classList.add('task-box--active')
    box.classList.remove('task-box--locked')
  }

  // ── 초기 답안 페이즈 (E/C집단) ────────────────────────────────────
  function showTaskPhaseInitial() {
    showStep('step-task')
    updateProgressBar()
    taskPhaseEnter()   // ← 초기답안 타이밍 시작

    const item = taskItems[taskIdx]
    if (!taskPhaseDurations[taskIdx]) taskPhaseDurations[taskIdx] = {}

    // 이미지 세팅 (한 문항 내내 고정)
    const imgEl = document.getElementById('task-img-main')
    if (imgEl) imgEl.src = item.url

    // 모든 박스 초기화
    ;['box-initial','box-confidence','box-ai','box-final'].forEach(id => {
      const b = document.getElementById(id)
      if (!b) return
      b.style.display = id === 'box-initial' ? '' : 'none'
      b.classList.remove('task-box--active','task-box--locked')
      if (id === 'box-initial') b.classList.add('task-box--active')
    })

    // 초기 답안 선택지 구성
    buildChoices('task-initial-choices', 'initial')

    const btnNext = document.getElementById('btn-initial-next')
    if (btnNext) {
      const newBtn = btnNext.cloneNode(true)
      btnNext.parentNode.replaceChild(newBtn, btnNext)
      newBtn.disabled = true
      _revealBtnAfter(newBtn, 3000)
      newBtn.addEventListener('click', () => {
        taskPhaseDurations[taskIdx].initial_ms = taskPhaseLeave()

        // 선택지 잠금
        document.querySelectorAll('input[name="initial"]').forEach(r => r.disabled = true)
        _lockBox('box-initial')

        const chosen = document.querySelector('input[name="initial"]:checked')?.value
        if (!taskAnswers[taskIdx]) taskAnswers[taskIdx] = {}
        taskAnswers[taskIdx].initial         = chosen
        taskAnswers[taskIdx].correctCategory = item.correctCategory
        taskAnswers[taskIdx].aiCategory      = item.aiCategory
        taskAnswers[taskIdx].aiCorrect       = item.aiCorrect
        taskAnswers[taskIdx].imageUrl        = item.url

        const group = sessionStorage.getItem(KEY_GROUP)
        if (group === 'E') {
          showTaskPhaseExpMid()
        } else {
          showTaskPhaseAI()
        }
      }, { once: true })
    }
  }

  // ── 확신도 페이즈 (E집단 전용) ──────────────────────────────────
  function showTaskPhaseExpMid() {
    const item = taskItems[taskIdx]
    taskPhaseEnter()

    _openBox('box-confidence')

    const contentEl = document.getElementById('task-exp-mid-content')
    if (contentEl) {
      contentEl.innerHTML = `
        <fieldset>
          <legend style="font-size:.85rem;font-weight:600;line-height:1.6">
            방금 제출한 답이 정답이라고 생각하나요? 0에서 100 사이의 값으로 표시하세요.<br>
            <span style="font-size:.78rem;font-weight:400;color:var(--muted)">(0 = 잘 모르겠다 &nbsp;……&nbsp; 100 = 정답으로 확신한다)</span>
          </legend>
          <div class="math-input-row" style="max-width:220px;margin-top:.6rem">
            <input type="number" id="confidence-input" min="0" max="100"
                   class="math-input" placeholder="0 – 100" />
            <span style="font-size:1rem;font-weight:600;color:var(--muted)">%</span>
          </div>
        </fieldset>`
    }

    const btnMid = document.getElementById('btn-exp-mid-next')
    let newBtn = null
    if (btnMid) {
      newBtn = btnMid.cloneNode(true)
      btnMid.parentNode.replaceChild(newBtn, btnMid)
    }
    _revealBtnAfter(newBtn, 3000)

    if (newBtn) {
      function onConfidenceClick() {
        const inp = document.getElementById('confidence-input')
        const val = inp ? parseInt(inp.value, 10) : NaN
        if (!inp || inp.value.trim() === '' || isNaN(val) || val < 0 || val > 100) {
          _showInputError(inp, '0~100 사이의 숫자를 입력해 주세요.')
          return
        }
        newBtn.removeEventListener('click', onConfidenceClick)
        taskPhaseDurations[taskIdx].confidence_ms = taskPhaseLeave()
        if (!taskAnswers[taskIdx]) taskAnswers[taskIdx] = {}
        taskAnswers[taskIdx].confidence = val

        // 확신도 박스 잠금 (값 표시로 교체)
        if (inp) inp.disabled = true
        _lockBox('box-confidence')
        showTaskPhaseAI()
      }
      newBtn.addEventListener('click', onConfidenceClick)
    }
  }

  // ── AI 피드백 페이즈 (E/C 집단용) ───────────────────────────────
  function showTaskPhaseAI() {
    const item = taskItems[taskIdx]
    taskPhaseEnter()

    _openBox('box-ai')

    const catEl    = document.getElementById('ai-category-text')
    const reasonEl = document.getElementById('ai-reason-text')
    if (catEl)    catEl.textContent    = item.aiCategory
    if (reasonEl) reasonEl.textContent = item.aiReason

    const btnAi = document.getElementById('btn-ai-next')
    if (btnAi) {
      const newBtn = btnAi.cloneNode(true)
      btnAi.parentNode.replaceChild(newBtn, btnAi)
      _revealBtnAfter(newBtn, 3000)
      newBtn.addEventListener('click', () => {
        taskPhaseDurations[taskIdx].ai_ms = taskPhaseLeave()
        _lockBox('box-ai')
        showTaskPhaseFinal()
      }, { once: true })
    }
  }

  // ── 최종 답안 페이즈 (E/C 집단용) ───────────────────────────────
  function showTaskPhaseFinal() {
    const item = taskItems[taskIdx]
    taskPhaseEnter()

    _openBox('box-final')
    buildChoices('task-final-choices', 'final')

    const btnFinal = document.getElementById('btn-final-next')
    if (btnFinal) {
      const newBtn = btnFinal.cloneNode(true)
      btnFinal.parentNode.replaceChild(newBtn, btnFinal)
      newBtn.disabled = true
      _revealBtnAfter(newBtn, 3000)
      newBtn.addEventListener('click', () => {
        taskPhaseDurations[taskIdx].final_ms = taskPhaseLeave()

        const chosen = document.querySelector('input[name="final"]:checked')?.value
        if (!taskAnswers[taskIdx]) taskAnswers[taskIdx] = {}
        taskAnswers[taskIdx].final = chosen
        taskAnswers[taskIdx].phase_durations_ms = { ...taskPhaseDurations[taskIdx] }

        // 이미지 즉시 제거
        const imgEl = document.getElementById('task-img-main')
        if (imgEl) imgEl.src = ''

        taskIdx++
        if (taskIdx < taskItems.length) {
          showTaskPhaseInitial()
        } else {
          sessionStorage.setItem(KEY_TASK_ANSWERS, JSON.stringify(taskAnswers))
          sessionStorage.setItem('__exp_task_phase_dur__', JSON.stringify(taskPhaseDurations))
          goToMathIntro()
        }
      }, { once: true })
    }
  }

  // ── 비교집단(A) 전용 과제 페이즈 ────────────────────────────────
  function showTaskPhaseA() {
    showStep('step-task-a')
    updateProgressBar()

    const item = taskItems[taskIdx]
    if (!taskPhaseDurations[taskIdx]) taskPhaseDurations[taskIdx] = {}
    taskPhaseEnter()

    // 이미지 세팅
    const imgEl = document.getElementById('task-img-a')
    if (imgEl) imgEl.src = item.url

    // 박스 초기화
    ;['box-a-ai','task-a-final-box'].forEach(id => {
      const b = document.getElementById(id)
      if (!b) return
      b.style.display = id === 'box-a-ai' ? '' : 'none'
      b.classList.remove('task-box--active','task-box--locked')
      if (id === 'box-a-ai') b.classList.add('task-box--active')
    })

    const catEl    = document.getElementById('ai-category-text-a')
    const reasonEl = document.getElementById('ai-reason-text-a')
    if (catEl)    catEl.textContent    = item.aiCategory
    if (reasonEl) reasonEl.textContent = item.aiReason

    if (!taskAnswers[taskIdx]) taskAnswers[taskIdx] = {}
    taskAnswers[taskIdx].correctCategory = item.correctCategory
    taskAnswers[taskIdx].aiCategory      = item.aiCategory
    taskAnswers[taskIdx].aiCorrect       = item.aiCorrect
    taskAnswers[taskIdx].imageUrl        = item.url

    const btnAiNext = document.getElementById('btn-a-ai-next')
    if (btnAiNext) {
      const newAiBtn = btnAiNext.cloneNode(true)
      btnAiNext.parentNode.replaceChild(newAiBtn, btnAiNext)
      _revealBtnAfter(newAiBtn, 3000)
      newAiBtn.addEventListener('click', () => {
        taskPhaseDurations[taskIdx].ai_ms = taskPhaseLeave()
        _lockBox('box-a-ai')
        taskPhaseEnter()

        // 최종 답안 박스 표시
        const box = document.getElementById('task-a-final-box')
        if (box) {
          _openBox('task-a-final-box')
          buildChoicesA()
          const btnSubmit = document.getElementById('btn-a-final-submit')
          if (btnSubmit) {
            const newSubmit = btnSubmit.cloneNode(true)
            btnSubmit.parentNode.replaceChild(newSubmit, btnSubmit)
            newSubmit.disabled = true
            _revealBtnAfter(newSubmit, 3000)
            newSubmit.addEventListener('click', () => {
              taskPhaseDurations[taskIdx].final_ms = taskPhaseLeave()
              const chosen = document.querySelector('input[name="final-a"]:checked')?.value
              taskAnswers[taskIdx].final = chosen
              taskAnswers[taskIdx].phase_durations_ms = { ...taskPhaseDurations[taskIdx] }

              const prevImg = document.getElementById('task-img-a')
              if (prevImg) prevImg.src = ''

              taskIdx++
              if (taskIdx < taskItems.length) {
                showTaskPhaseA()
              } else {
                sessionStorage.setItem(KEY_TASK_ANSWERS, JSON.stringify(taskAnswers))
                sessionStorage.setItem('__exp_task_phase_dur__', JSON.stringify(taskPhaseDurations))
                goToMathIntro()
              }
            }, { once: true })
          }
        }
      }, { once: true })
    }
  }

  // A집단 전용 선택지 빌더
  function buildChoicesA() {
    const container = document.getElementById('task-a-final-choices')
    if (!container) return
    container.innerHTML = CATS_SORTED.map((cat, i) => `
      <label class="task-choice">
        <input type="radio" name="final-a" value="${cat}" />
        <span class="task-choice-alpha">${String.fromCharCode(65 + i)}.</span>
        <span>${cat}</span>
      </label>`).join('')
    container.querySelectorAll('input[type=radio]').forEach(r => {
      r.addEventListener('change', () => {
        const btn = document.getElementById('btn-a-final-submit')
        if (btn) btn.disabled = false
      })
    })
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 7 : 수학 문제 안내 ────────────────────────────────────
  // ════════════════════════════════════════════════════════════════

  function goToMathIntro() {
    showStep('step-math-intro')
    const btn = document.getElementById('btn-math-intro-next')
    if (btn) {
      const nb = btn.cloneNode(true)
      btn.parentNode.replaceChild(nb, btn)
      nb.addEventListener('click', () => startMath(), { once: true })
    }
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 8 : 수학 문제 풀이 (3분 타이머, 100문제) ──────────────
  // ════════════════════════════════════════════════════════════════

  let mathAnswers  = []
  let mathTimerRef = null

  function startMath() {
    showStep('step-math')
    mathAnswers  = []
    _mathStartTs = Date.now()

    let remaining = 180
    let mathQIdx  = 0
    let score     = 0

    // 답이 2자리 양의 정수(10~99)인 문제만 수집
    const problems = []
    while (problems.length < 100) {
      const a  = Math.floor(Math.random() * 90) + 10   // 10~99
      const b  = Math.floor(Math.random() * 90) + 10   // 10~99
      const op = Math.random() < 0.5 ? '+' : '-'
      const ans = op === '+' ? a + b : a - b
      if (ans >= 10 && ans <= 99) {                     // 답도 2자리 양의 정수
        problems.push({ a, b, op, ans })
      }
    }

    function showQuestion() {
      if (mathQIdx >= problems.length) { endMath(); return }
      const p   = problems[mathQIdx]
      const qEl = document.getElementById('math-question')
      const fbEl = document.getElementById('math-feedback')
      if (qEl)  qEl.textContent  = `${p.a} ${p.op} ${p.b} = ?`
      if (fbEl) fbEl.textContent = ''
      const ans = document.getElementById('math-answer')
      if (ans) { ans.value = ''; ans.focus() }
    }

    function handleSubmitMath() {
      const ansEl   = document.getElementById('math-answer')
      if (!ansEl || ansEl.value.trim() === '') { if (ansEl) ansEl.focus(); return }
      const val     = parseInt(ansEl.value, 10)
      if (isNaN(val)) { ansEl.focus(); return }
      const p       = problems[mathQIdx]
      const correct = val === p.ans
      if (correct) score++
      mathAnswers.push({ q: `${p.a}${p.op}${p.b}`, userAns: val, correct })
      mathQIdx++
      showQuestion()
    }

    const btnMath = document.getElementById('btn-math-submit')
    if (btnMath) {
      const nb = btnMath.cloneNode(true)
      btnMath.parentNode.replaceChild(nb, btnMath)
      nb.addEventListener('click', handleSubmitMath)
    }

    const ansEl = document.getElementById('math-answer')
    if (ansEl) {
      const nb = ansEl.cloneNode(true)
      ansEl.parentNode.replaceChild(nb, ansEl)
      nb.addEventListener('keydown', e => { if (e.key === 'Enter') handleSubmitMath() })
    }

    // ── (임시) math skip 버튼 ──────────────────────────────────────
    const mathSkipBtn = document.getElementById('btn-math-skip')
    if (mathSkipBtn) {
      const nb = mathSkipBtn.cloneNode(true)
      mathSkipBtn.parentNode.replaceChild(nb, mathSkipBtn)
      nb.addEventListener('click', () => endMath(), { once: true })
    }
    // ──────────────────────────────────────────────────────────────

    function tick() {
      remaining--
      const m = Math.floor(remaining / 60)
      const s = remaining % 60
      const timerEl = document.getElementById('math-timer')
      if (timerEl) timerEl.textContent = `${m}:${String(s).padStart(2, '0')}`
      if (remaining <= 0) endMath()
    }
    if (mathTimerRef) clearInterval(mathTimerRef)
    mathTimerRef = setInterval(tick, 1000)

    function endMath() {
      if (mathTimerRef) { clearInterval(mathTimerRef); mathTimerRef = null }
      _mathEndTs = Date.now()
      sessionStorage.setItem('__exp_math_answers__', JSON.stringify({
        answers:     mathAnswers,
        score,
        duration_ms: _mathStartTs ? _mathEndTs - _mathStartTs : null
      }))
      goToRecallIntro()
    }

    showQuestion()
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 9 : 회상 질문 안내 ─────────────────────────────────────
  // ════════════════════════════════════════════════════════════════

  function goToRecallIntro() {
    showStep('step-recall-intro')
    const btn = document.getElementById('btn-recall-intro-next')
    if (btn) {
      const nb = btn.cloneNode(true)
      btn.parentNode.replaceChild(nb, btn)
      nb.addEventListener('click', () => goToTaskConfidence(), { once: true })
    }
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 10-A : AI 협업 과제 정확도 추정 ────────────────────────
  // ════════════════════════════════════════════════════════════════

  function goToTaskConfidence() {
    showStep('step-task-conf')

    // 입력란 초기화
    const inp = document.getElementById('task-conf-input')
    if (inp) inp.value = ''

    // 버튼 교체 후 10초 뒤에 조용히 표시
    const btn = document.getElementById('btn-task-conf-next')
    let nb = null
    if (btn) {
      nb = btn.cloneNode(true)
      btn.parentNode.replaceChild(nb, btn)
    }
    _revealBtnAfter(nb, 3000)

    if (nb) {
      function onTaskConfClick() {
        const inp2 = document.getElementById('task-conf-input')
        const val  = inp2 ? parseInt(inp2.value, 10) : NaN
        if (!inp2 || inp2.value.trim() === '' || isNaN(val) || val < 0 || val > 100) {
          _showInputError(inp2, '0~100 사이의 숫자를 입력해 주세요.')
          return
        }
        nb.removeEventListener('click', onTaskConfClick)
        sessionStorage.setItem('__exp_task_conf__', String(val))
        goToSelfConfidence()
      }
      nb.addEventListener('click', onTaskConfClick)
    }
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 10 : AI 없이 자신감 슬라이더 ───────────────────────────
  // ════════════════════════════════════════════════════════════════

  function goToSelfConfidence() {
    showStep('step-recall')

    const qEl        = document.getElementById('recall-question-text')
    const countArea  = document.getElementById('recall-countdown-area')
    const answerArea = document.getElementById('recall-answer-area')
    const ansContent = document.getElementById('recall-answer-content')

    if (qEl) qEl.textContent = '만약 지금부터 AI 없이 스스로 피부 병변 분류 과제를 하게 된다면, 얼마나 많은 문제를 맞힐 수 있을 것이라고 생각하나요?'

    // 카운트다운 영역 숨기고 입력 영역 바로 표시
    if (countArea)  countArea.style.display  = 'none'
    if (answerArea) answerArea.style.display = ''

    // 입력창 주입
    if (ansContent) {
      ansContent.innerHTML = `
        <div class="math-input-row" style="max-width:300px;margin-top:0.8rem">
          <input type="number" id="self-conf-input" min="0" max="100"
                 class="math-input" placeholder="0 – 100" />
          <span style="font-size:1.1rem;font-weight:600;color:var(--muted)">%</span>
        </div>`
    }

    // 버튼 교체 후 10초 뒤에 조용히 표시
    const btnNext = document.getElementById('btn-recall-next')
    let nb = null
    if (btnNext) {
      nb = btnNext.cloneNode(true)
      btnNext.parentNode.replaceChild(nb, btnNext)
    }
    _revealBtnAfter(nb, 3000)

    if (nb) {
      function onSelfConfClick() {
        const inp = document.getElementById('self-conf-input')
        const val = inp ? parseInt(inp.value, 10) : NaN
        if (!inp || inp.value.trim() === '' || isNaN(val) || val < 0 || val > 100) {
          _showInputError(inp, '0~100 사이의 숫자를 입력해 주세요.')
          return
        }
        nb.removeEventListener('click', onSelfConfClick)
        sessionStorage.setItem('__exp_self_conf__', String(val))
        goToExamIntro()
      }
      nb.addEventListener('click', onSelfConfClick)
    }
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 11 : 시험 안내 ─────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════

  function goToExamIntro() {
    showStep('step-exam-intro')
    const btn = document.getElementById('btn-exam-intro-next')
    if (btn) {
      const nb = btn.cloneNode(true)
      btn.parentNode.replaceChild(nb, btn)
      nb.addEventListener('click', () => startExam(), { once: true })
    }
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 12 : 시험 문제 ─────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════

  let examItems   = []
  let examIdx     = 0
  let examAnswers = []

  function startExam() {
    fetch('/api/exam-images')
      .then(r => r.json())
      .then(data => {
        examItems   = seededShuffle(data.exams, 0xcafebabe)
        examIdx     = 0
        examAnswers = []

        // ── (임시) exam skip 버튼 ────────────────────────────────
        const examSkip = document.getElementById('btn-exam-skip')
        if (examSkip) {
          const nb = examSkip.cloneNode(true)
          examSkip.parentNode.replaceChild(nb, examSkip)
          nb.addEventListener('click', () => {
            sessionStorage.setItem('__exp_exam_answers__', JSON.stringify(examAnswers))
            goToPostSurvey()
          }, { once: true })
        }
        // ─────────────────────────────────────────────────────────

        showExamQuestion()
      })
      .catch(() => goToPostSurvey())
  }

  function updateExamProgress() {
    const total   = examItems.length
    const current = examIdx + 1
    const pct     = total > 0 ? Math.round((examIdx / total) * 100) : 0
    const textEl  = document.getElementById('exam-progress-text')
    const fillEl  = document.getElementById('exam-progress-fill')
    if (textEl) textEl.textContent = `${current} / ${total}`
    if (fillEl) fillEl.style.width = pct + '%'
  }

  function _renderExamQuestion() {
    updateExamProgress()
    examQuestionEnter()   // ← 시험 문제 타이밍 시작

    const item    = examItems[examIdx]
    const imgEl   = document.getElementById('exam-img')
    const choices = document.getElementById('exam-choices')
    const imgCard = document.getElementById('exam-img-card')
    const ansCard = document.getElementById('exam-ans-card')

    // 이미지·선택지 카드 표시
    if (imgCard) imgCard.style.visibility = ''
    if (ansCard) ansCard.style.visibility = ''

    if (imgEl) imgEl.src = item.url

    if (choices) {
      choices.innerHTML = CATS_SORTED.map((cat, i) => `
        <label class="task-choice">
          <input type="radio" name="exam" value="${cat}" />
          <span class="task-choice-alpha">${String.fromCharCode(65 + i)}.</span>
          <span>${cat}</span>
        </label>`).join('')

      choices.querySelectorAll('input[type=radio]').forEach(r => {
        r.addEventListener('change', () => {
          const btn = document.getElementById('btn-exam-next')
          if (btn) btn.disabled = false   // 지연 없이 즉시 활성화
        })
      })
    }

    const btnNext = document.getElementById('btn-exam-next')
    if (btnNext) {
      const nb = btnNext.cloneNode(true)
      btnNext.parentNode.replaceChild(nb, btnNext)
      nb.disabled = true   // 라디오 선택 전까지만 비활성, 지연 없음
      nb.addEventListener('click', () => {
        const duration_ms = examQuestionLeave()   // ← 시험 문제 타이밍 종료
        const chosen = document.querySelector('input[name="exam"]:checked')?.value
        examAnswers.push({
          url:             item.url,
          correctCategory: item.correctCategory,
          chosen,
          duration_ms
        })
        examIdx++
        if (examIdx < examItems.length) {
          // ── 0.1초 blank 후 다음 문항 렌더 ──
          const imgCard2 = document.getElementById('exam-img-card')
          const ansCard2 = document.getElementById('exam-ans-card')
          const imgEl2   = document.getElementById('exam-img')
          if (imgCard2) imgCard2.style.visibility = 'hidden'
          if (ansCard2) ansCard2.style.visibility = 'hidden'
          if (imgEl2)   imgEl2.src = ''
          setTimeout(_renderExamQuestion, 100)
        } else {
          sessionStorage.setItem('__exp_exam_answers__', JSON.stringify(examAnswers))
          goToPostSurvey()
        }
      }, { once: true })
    }
  }

  function showExamQuestion() {
    showStep('step-exam')
    _renderExamQuestion()
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 13 : 사후 설문 (4페이지) ──────────────────────────────
  // ════════════════════════════════════════════════════════════════

  const psData = {}

  // 13-0: 안내
  function goToPostSurvey() {
    showStep('step-ps-0')
    const btn = document.getElementById('btn-ps0-next')
    if (btn) {
      const nb = btn.cloneNode(true)
      btn.parentNode.replaceChild(nb, btn)
      nb.addEventListener('click', () => showPS1(), { once: true })
    }
  }

  // 13-1: Q4 사전지식 7점 척도
  function showPS1() {
    showStep('step-ps-1')
    const btnNext = document.getElementById('btn-ps1-next')
    if (btnNext) {
      btnNext.disabled = true
      const nb = btnNext.cloneNode(true)
      btnNext.parentNode.replaceChild(nb, btnNext)
      nb.disabled = !document.querySelector('input[name="q4"]:checked')
      document.querySelectorAll('input[name="q4"]').forEach(r => {
        r.addEventListener('change', () => { if (nb) nb.disabled = false })
      })
      nb.addEventListener('click', () => {
        const val = document.querySelector('input[name="q4"]:checked')?.value
        if (!val) { _showErr('ps1-err', '응답을 선택해 주세요.'); return }
        psData.pk1 = val
        showPS2()
      }, { once: true })
    }
  }

  // 13-2: Q5 초기 정확도
  function showPS2() {
    showStep('step-ps-2')
    const btn = document.getElementById('btn-ps2-next')
    if (btn) {
      const nb = btn.cloneNode(true)
      btn.parentNode.replaceChild(nb, btn)
      function onPS2Click() {
        const inp = document.getElementById('q5-input')
        const val = inp?.value?.trim()
        if (!val || val === '') { _showErr('ps2-err', '0~100 사이의 숫자를 입력해 주세요.'); if (inp) inp.focus(); return }
        nb.removeEventListener('click', onPS2Click)
        psData.pk2 = val
        showAiSurvey()   // ← Q5 다음에 AI 설문으로 이동
      }
      nb.addEventListener('click', onPS2Click)
    }
  }

  // ════════════════════════════════════════════════════════════════
  // ── 13-2b : AI 지식·태도 설문 (순차 문항 공개) ──────────────────
  // ════════════════════════════════════════════════════════════════

  // ── 섹션 A: 지식 문항 (맞다/틀리다) ────────────────────────────
  const AI_SURVEY_ITEMS_A = [
    { type: 'yn', name: 'ai_k1', text: '생성형 AI는 수학적 문제를 신뢰할 만하게 해결할 수 있다.', correct: '틀리다' },
    { type: 'yn', name: 'ai_k2', text: '생성형 AI는 동일한 질문에 대해 동일한 답변을 제공한다.', correct: '틀리다' },
    { type: 'yn', name: 'ai_k3', text: '생성형 AI는 인간의 언어 행동을 가능한 한 가깝게 모방하도록 설계되었다.', correct: '맞다' },
    { type: 'yn', name: 'ai_k4', text: '생성형 AI는 웹 검색을 수행한다.', correct: '틀리다' },
    { type: 'yn', name: 'ai_k5', text: '생성형 AI는 사실에 근거하지 않은 내용을 제공할 수 있다.', correct: '맞다' },
    { type: 'yn', name: 'ai_k6', text: '생성형 AI는 매일 업데이트되는 정보를 검색하거나 가져온다.', correct: '틀리다' },
  ]

  // ── 섹션 B: 태도 문항 (4점 척도) ─────────────────────────────
  const AI_SURVEY_ITEMS_B = [
    { type: 'likert4', name: 'ai_a1', text: '생성형 AI는 신뢰할 수 있다.' },
    { type: 'likert4', name: 'ai_a2', text: '생성형 AI는 개인정보 사용과 관련된 위험을 내포한다.' },
    { type: 'likert4', name: 'ai_a3', text: '생성형 AI는 고정관념과 편견을 재생산한다.' },
    { type: 'likert4', name: 'ai_a4', text: '생성형 AI 사용은 저작권 문제를 초래한다.' },
    { type: 'likert4', name: 'ai_a5', text: '생성형 AI는 너무 많은 전력을 소비한다.' },
    { type: 'likert4', name: 'ai_a6', text: '생성형 AI는 21세기의 가장 중요한 발명 중 하나이다.' },
    { type: 'likert4', name: 'ai_a7', text: '생성형 AI는 기반이 되는 텍스트 자료에 대해 투명하지 않다.' },
    { type: 'likert4', name: 'ai_a8', text: '생성형 AI는 잘못된 정보의 확산에 기여한다.' },
  ]

  const LIKERT4_LABELS = ['전혀 그렇지 않다', '그렇지 않다', '그렇다', '매우 그렇다']

  // ── 공통: 문항 목록을 카드에 순차 주입하는 헬퍼 ──────────────
  function _buildSurveyPage(items, cardId, errId, nextRowId, btnId, sectionText, onComplete) {
    const card    = document.getElementById(cardId)
    const nextRow = document.getElementById(nextRowId)
    if (!card) return

    card.innerHTML = ''
    if (nextRow) nextRow.style.display = 'none'

    // 섹션 헤더
    if (sectionText) {
      const secEl = document.createElement('p')
      secEl.className = 'ai-survey-section'
      secEl.textContent = sectionText
      card.appendChild(secEl)
    }

    const answers    = {}
    let   shownCount = 0

    function revealNext() {
      if (shownCount >= items.length) return

      const item = items[shownCount]
      shownCount++

      const wrap = document.createElement('div')
      wrap.className = 'ai-survey-item'
      wrap.id = 'ai-item-' + item.name

      const qText = document.createElement('p')
      qText.className = 'ai-survey-q'
      qText.textContent = item.text
      wrap.appendChild(qText)

      const choiceWrap = document.createElement('div')
      choiceWrap.className = item.type === 'yn' ? 'ai-choice-yn' : 'ai-choice-likert4'

      if (item.type === 'yn') {
        ;['맞다', '틀리다'].forEach(label => {
          const lbl = document.createElement('label')
          lbl.className = 'ai-radio-label'
          lbl.innerHTML = `<input type="radio" name="${item.name}" value="${label}" /><span>${label}</span>`
          choiceWrap.appendChild(lbl)
        })
      } else {
        LIKERT4_LABELS.forEach((label, idx) => {
          const lbl = document.createElement('label')
          lbl.className = 'ai-radio-label'
          lbl.innerHTML = `<input type="radio" name="${item.name}" value="${idx + 1}" /><span>${label}</span>`
          choiceWrap.appendChild(lbl)
        })
      }

      wrap.appendChild(choiceWrap)
      card.appendChild(wrap)

      choiceWrap.querySelectorAll('input[type=radio]').forEach(r => {
        r.addEventListener('change', () => {
          answers[item.name] = r.value
          if (shownCount >= items.length) {
            if (nextRow) nextRow.style.display = ''
          } else {
            revealNext()
          }
          setTimeout(() => wrap.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
        }, { once: true })
      })
    }

    revealNext()

    const btn = document.getElementById(btnId)
    if (btn) {
      const nb = btn.cloneNode(true)
      btn.parentNode.replaceChild(nb, btn)
      function onNext() {
        const missing = items.find(it => !answers[it.name])
        if (missing) {
          _showErr(errId, '모든 문항에 응답해 주세요.')
          document.getElementById('ai-item-' + missing.name)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          return
        }
        nb.removeEventListener('click', onNext)
        onComplete(answers)
      }
      nb.addEventListener('click', onNext)
    }
  }

  // ── 섹션A 페이지 (맞다/틀리다) ───────────────────────────────
  function showAiSurvey() {
    showStep('step-ai-survey')
    _buildSurveyPage(
      AI_SURVEY_ITEMS_A,
      'ai-survey-card', 'ai-survey-err', 'ai-survey-next-row', 'btn-ai-survey-next',
      '다음 문항들은 생성형 AI에 관한 내용입니다. 각 문장이 맞다고 생각하면 "맞다", 틀리다고 생각하면 "틀리다"를 선택해 주십시오.',
      (answersA) => {
        if (!psData._ai_survey) psData._ai_survey = {}
        Object.assign(psData._ai_survey, answersA)
        showAiSurveyB()
      }
    )
  }

  // ── 섹션B 페이지 (동의 정도) ──────────────────────────────────
  function showAiSurveyB() {
    showStep('step-ai-survey-b')
    _buildSurveyPage(
      AI_SURVEY_ITEMS_B,
      'ai-survey-b-card', 'ai-survey-b-err', 'ai-survey-b-next-row', 'btn-ai-survey-b-next',
      '다음 문항들은 생성형 AI에 대한 귀하의 생각을 묻는 문항입니다. 각 문장에 대해 동의 정도를 선택해 주십시오.',
      (answersB) => {
        if (!psData._ai_survey) psData._ai_survey = {}
        Object.assign(psData._ai_survey, answersB)
        showPS3()
      }
    )
  }

  // 13-3: Q6 인구통계 + 최종 제출
  function showPS3() {
    showStep('step-ps-3')
    const btn = document.getElementById('btn-ps3-submit')
    if (btn) {
      const nb = btn.cloneNode(true)
      btn.parentNode.replaceChild(nb, btn)
      // once 없이 등록 — handlePS3Submit 내부에서 유효성 통과 후 직접 제거
      nb.addEventListener('click', () => handlePS3Submit(nb))
    }
  }

  async function handlePS3Submit(btn) {
    const age    = document.getElementById('q6-age')?.value?.trim()
    const gender = document.querySelector('input[name="q6_gender"]:checked')?.value
    const major  = document.getElementById('q6-major')?.value?.trim()

    if (!age)    { _showErr('ps3-err', '만 나이를 입력해 주세요.'); document.getElementById('q6-age')?.focus(); return }
    if (!gender) { _showErr('ps3-err', '성별을 선택해 주세요.'); return }
    if (!major)  { _showErr('ps3-err', '전공을 입력해 주세요.'); document.getElementById('q6-major')?.focus(); return }

    // 유효성 통과 — 중복 제출 방지
    if (btn) btn.disabled = true

    psData.q6_age    = age
    psData.q6_gender = gender
    psData.q6_major  = major

    const pid   = sessionStorage.getItem(KEY_PID)
    const group = sessionStorage.getItem(KEY_GROUP)
    if (!pid || !group) { showError('세션 정보가 유실되었습니다. 페이지를 새로고침 해주세요.'); return }

    // ── 페이지 타이밍 최종 수집 ──────────────────────────────────
    _leaveCurrentPage()   // 현재(step-ps-3) 이탈 기록

    const responses = {
      _group: group,
      ...psData,

      // ── 과제 응답 ──────────────────────────────────────────────
      _task_answers: (() => {
        try { return JSON.parse(sessionStorage.getItem(KEY_TASK_ANSWERS) || 'null') } catch { return null }
      })(),

      // ── 수학 응답 ──────────────────────────────────────────────
      _math: (() => {
        try { return JSON.parse(sessionStorage.getItem('__exp_math_answers__') || 'null') } catch { return null }
      })(),

      // ── AI 협업 과제 정확도 추정 ────────────────────────────────
      jol1: (() => {
        const v = sessionStorage.getItem('__exp_task_conf__')
        return v !== null ? parseInt(v, 10) : null
      })(),

      // ── AI 없이 자신감 ──────────────────────────────────────────
      jol2: (() => {
        const v = sessionStorage.getItem('__exp_self_conf__')
        return v ? parseInt(v, 10) : null
      })(),

      // ── 시험 응답 ──────────────────────────────────────────────
      _exam_answers: (() => {
        try { return JSON.parse(sessionStorage.getItem('__exp_exam_answers__') || 'null') } catch { return null }
      })(),

      // ── 자동채점 ────────────────────────────────────────────────
      _scoring: (() => {
        // 1) 시험 단계 정답여부
        const examRaw = (() => {
          try { return JSON.parse(sessionStorage.getItem('__exp_exam_answers__') || 'null') } catch { return null }
        })()
        const exam_correct = examRaw
          ? examRaw.map(e => ({ url: e.url, correctCategory: e.correctCategory, chosen: e.chosen, correct: e.chosen === e.correctCategory }))
          : null
        const exam_score = exam_correct
          ? { correct: exam_correct.filter(e => e.correct).length, total: exam_correct.length }
          : null

        // 2) AI 지식 문항(ai_k1~6) 정답여부
        const AI_K_ANSWERS = { ai_k1: '틀리다', ai_k2: '틀리다', ai_k3: '맞다', ai_k4: '틀리다', ai_k5: '맞다', ai_k6: '틀리다' }
        const aiSurvey = psData._ai_survey ?? {}
        const ai_k_correct = {}
        for (const [k, correctVal] of Object.entries(AI_K_ANSWERS)) {
          ai_k_correct[k] = aiSurvey[k] !== undefined ? aiSurvey[k] === correctVal : null
        }
        const ai_k_score = {
          correct: Object.values(ai_k_correct).filter(v => v === true).length,
          total:   Object.keys(AI_K_ANSWERS).length
        }

        // 3) 과제 단계: E/C 조건 — initial→final 변경여부, final과 aiCategory 일치여부
        const taskRaw = (() => {
          try { return JSON.parse(sessionStorage.getItem(KEY_TASK_ANSWERS) || 'null') } catch { return null }
        })()
        const task_ec = (taskRaw && group !== 'A')
          ? taskRaw.map((t, i) => ({
              idx:              i,
              correctCategory:  t.correctCategory,
              aiCategory:       t.aiCategory,
              initial:          t.initial,
              final:            t.final,
              changed:          t.initial !== t.final,          // initial→final 변경여부
              final_eq_ai:      t.final === t.aiCategory,       // final과 aiCategory 일치
              final_correct:    t.final === t.correctCategory,  // 최종정답여부
            }))
          : null

        // 4) 과제 단계: A 조건 — final(=유일한 응답)과 aiCategory 일치여부
        const task_a = (taskRaw && group === 'A')
          ? taskRaw.map((t, i) => ({
              idx:             i,
              correctCategory: t.correctCategory,
              aiCategory:      t.aiCategory,
              final:           t.final,
              final_eq_ai:     t.final === t.aiCategory,      // 응답과 AI 일치여부
              final_correct:   t.final === t.correctCategory, // 정답여부
            }))
          : null

        return {
          exam_correct,
          exam_score,
          ai_k_correct,
          ai_k_score,
          task_ec,
          task_a,
        }
      })(),

      // ── 페이지 머문 시간 ────────────────────────────────────────
      _page_durations: { ...pageDurations },

      // ── 과제 단계별 타이밍 (별도 저장본 우선, 없으면 메모리) ────
      _task_phase_durations: (() => {
        try {
          const saved = sessionStorage.getItem('__exp_task_phase_dur__')
          return saved ? JSON.parse(saved) : taskPhaseDurations
        } catch { return taskPhaseDurations }
      })(),
    }

    btn.disabled    = true
    btn.textContent = '제출 중...'

    // ── Step 1: 제출 전 sessionStorage 원본 백업 ─────────────────
    // 실패해도 조용히 무시 — 제출 흐름을 절대 막지 않음
    try {
      const SESSION_KEYS = [
        KEY_PID, KEY_GROUP, KEY_STEP, KEY_DONE, KEY_TASK_ANSWERS,
        '__exp_math_answers__', '__exp_exam_answers__',
        '__exp_task_conf__', '__exp_self_conf__', '__exp_task_phase_dur__'
      ]
      const session_raw = {}
      SESSION_KEYS.forEach(k => {
        const v = sessionStorage.getItem(k)
        if (v !== null) {
          try { session_raw[k] = JSON.parse(v) } catch { session_raw[k] = v }
        }
      })
      await fetch('/api/backup', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ participant_id: pid, session_raw })
      })
    } catch (_) { /* 백업 실패는 무시 */ }

    // ── Step 2: 정식 제출 ────────────────────────────────────────
    try {
      const res  = await fetch('/api/submit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ participant_id: pid, responses })
      })
      const data = await res.json()
      if (!res.ok || data.error || data.saved !== 'github') throw new Error(data.error ?? 'github_save_not_confirmed')
      sessionStorage.setItem(KEY_DONE, '1')
      showStep('step-done')
    } catch (err) {
      // 제출 실패: step-ps-3 인라인 에러로 표시, 버튼 즉시 복구
      btn.disabled    = false
      btn.textContent = '제출하기'
      _showErr('ps3-err', '제출 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. (' + err.message + ')', 10000)
    }
  }

  // ── 오류 표시 (세션 유실 등 복구 불가 상황에만 사용) ───────────────
  function showError(msg) {
    const el = document.getElementById('error-msg')
    if (el) el.textContent = msg
    // btn-retry: step-ps-3로 돌아가 재시도
    const retryBtn = document.getElementById('btn-retry')
    if (retryBtn) {
      const nb = retryBtn.cloneNode(true)
      retryBtn.parentNode.replaceChild(nb, retryBtn)
      nb.addEventListener('click', () => {
        showStep('step-ps-3')
      }, { once: true })
    }
    showStep('step-error')
  }

  // ── 실행 ─────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
