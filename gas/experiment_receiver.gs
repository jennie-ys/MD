/**
 * Google Apps Script – experiment_receiver.gs
 *
 * 역할:
 *  1. POST 요청(JSON)을 수신하여 Google Sheets에 기록
 *  2. IP 기반 중복 응답 방지 (IP는 저장하지 않고 해시만 저장)
 *  3. 참가자 개인 식별 정보 미수집 정책 유지
 *
 * 배포 방법:
 *  1. Google Drive → 새로 만들기 → Google Apps Script
 *  2. 아래 코드를 붙여넣기
 *  3. SHEET_ID 와 SHEET_NAME 상수를 본인 스프레드시트에 맞게 수정
 *  4. 배포 → 새 배포 → 유형: 웹 앱
 *     - 다음 사용자로 실행: 나(내 계정)
 *     - 액세스 권한: 모든 사용자(익명 포함)
 *  5. 배포 URL을 실험 웹페이지의 GAS URL 입력란에 붙여넣기
 *
 * ─────────────────────────────────────────────
 * 스프레드시트 컬럼 구조 (자동 생성됨):
 *  A: row_id
 *  B: submitted_at (ISO 8601)
 *  C: participant_id (익명 랜덤 문자열)
 *  D: group (C 또는 E)
 *  E: ip_hash (SHA-256, 원본 IP는 저장하지 않음)
 *  F: q1 (연령대)
 *  G: q2 (기분)
 *  H: q3 (이해도)
 *  I: q4 (자유응답, 선택)
 *  J: duplicate (중복 여부: TRUE/FALSE)
 * ─────────────────────────────────────────────
 */

// ── 설정 (연구자가 수정) ─────────────────────────────────────────────────────
var SHEET_ID   = 'YOUR_SPREADSHEET_ID_HERE'   // 스프레드시트 ID
var SHEET_NAME = 'responses'                   // 시트 이름

// IP 해시에 추가할 salt (원하는 문자열로 변경 – 보안 강화)
var IP_SALT = 'my_experiment_2025_salt'
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST 요청 진입점
 * Content-Type: application/json
 * Body: {
 *   participant_id: string,
 *   responses: {
 *     _group: 'C'|'E',
 *     q1: string,
 *     q2: string,
 *     q3: string,
 *     q4?: string
 *   },
 *   ip: string,           ← Hono 서버가 추출해서 전달
 *   submitted_at: string  ← ISO 8601
 * }
 */
function doPost(e) {
  var output = ContentService.createTextOutput()
  output.setMimeType(ContentService.MimeType.JSON)

  // CORS 헤더 (OPTIONS preflight 별도 불필요 – GAS는 리다이렉트 방식이므로)
  try {
    var payload = JSON.parse(e.postData.contents)
    var result  = processSubmission(payload)
    output.setContent(JSON.stringify(result))
  } catch (err) {
    output.setContent(JSON.stringify({ error: err.toString() }))
  }

  return output
}

/**
 * (선택) GET 요청 – 헬스체크용
 */
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON)
}

// ─────────────────────────────────────────────────────────────────────────────

function processSubmission(payload) {
  var participantId = payload.participant_id || ''
  var responses     = payload.responses     || {}
  var rawIp         = payload.ip            || 'unknown'
  var submittedAt   = payload.submitted_at  || new Date().toISOString()

  // 필수 값 검증
  if (!participantId) {
    return { error: 'missing participant_id' }
  }

  var group = responses._group || ''
  if (group !== 'C' && group !== 'E') {
    return { error: 'invalid group' }
  }

  // IP → SHA-256 해시 (원본 IP 비저장 원칙)
  var ipHash = sha256(rawIp + IP_SALT)

  var ss    = SpreadsheetApp.openById(SHEET_ID)
  var sheet = ss.getSheetByName(SHEET_NAME) || createSheet(ss)

  // 헤더 생성 (최초 1회)
  ensureHeader(sheet)

  // ── 중복 체크 (IP 해시 기준) ──────────────────────────────────────────────
  var isDuplicate = checkDuplicate(sheet, ipHash)

  // ── 행 기록 ──────────────────────────────────────────────────────────────
  var rowId = Utilities.getUuid()  // 행별 고유 UUID
  sheet.appendRow([
    rowId,
    submittedAt,
    participantId,
    group,
    ipHash,
    responses.q1  || '',
    responses.q2  || '',
    responses.q3  || '',
    responses.q4  || '',
    isDuplicate
  ])

  if (isDuplicate) {
    return { status: 'duplicate', message: '이미 응답한 IP입니다. 데이터는 중복 표시로 저장됩니다.' }
  }

  return { status: 'ok', row_id: rowId }
}

// ─── 헬퍼 함수 ───────────────────────────────────────────────────────────────

function createSheet(ss) {
  return ss.insertSheet(SHEET_NAME)
}

function ensureHeader(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'row_id', 'submitted_at', 'participant_id', 'group',
      'ip_hash', 'q1', 'q2', 'q3', 'q4', 'duplicate'
    ])
    sheet.setFrozenRows(1)
    // 헤더 스타일
    var headerRange = sheet.getRange(1, 1, 1, 10)
    headerRange.setFontWeight('bold')
    headerRange.setBackground('#e8f0fe')
  }
}

/**
 * ip_hash 열(E = 5번째)에서 중복 검색
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string} ipHash
 * @returns {boolean}
 */
function checkDuplicate(sheet, ipHash) {
  var lastRow = sheet.getLastRow()
  if (lastRow <= 1) return false  // 헤더만 있음

  // E열 전체 값 읽기 (2행~마지막 행)
  var ipCol = sheet.getRange(2, 5, lastRow - 1, 1).getValues()
  for (var i = 0; i < ipCol.length; i++) {
    if (ipCol[i][0] === ipHash) return true
  }
  return false
}

/**
 * SHA-256 (hex) – Apps Script 내장 Utilities 사용
 * @param {string} input
 * @returns {string}
 */
function sha256(input) {
  var rawHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    input,
    Utilities.Charset.UTF_8
  )
  return rawHash.map(function(b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2)
  }).join('')
}
