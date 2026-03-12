const CN_NUM_MAP = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
const WEEKDAY_MAP = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 }
const QUARTER_MONTHS = {
  一: [1, 2, 3],
  二: [4, 5, 6],
  三: [7, 8, 9],
  四: [10, 11, 12],
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function cnToNumber(raw) {
  if (!raw) return null
  if (/^\d+$/.test(raw)) return Number(raw)
  if (raw === '十') return 10
  if (raw.startsWith('十')) return 10 + (CN_NUM_MAP[raw[1]] || 0)
  if (raw.endsWith('十')) return (CN_NUM_MAP[raw[0]] || 0) * 10
  const tenIndex = raw.indexOf('十')
  if (tenIndex > 0) {
    const tens = CN_NUM_MAP[raw.slice(0, tenIndex)] || 0
    const ones = CN_NUM_MAP[raw.slice(tenIndex + 1)] || 0
    return tens * 10 + ones
  }
  return CN_NUM_MAP[raw] ?? null
}

function normalizeDate(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`
}

function parseStatus(text) {
  if (/HO半天上午/i.test(text) || text.includes('HO上午') || (/上午/.test(text) && /HO/i.test(text))) return 'ho-am'
  if (/HO半天下午/i.test(text) || text.includes('HO下午') || (/下午/.test(text) && /HO/i.test(text))) return 'ho-pm'
  if (text.includes('休假半天上午') || text.includes('休假上午') || (/上午/.test(text) && text.includes('休假'))) return 'off-am'
  if (text.includes('休假半天下午') || text.includes('休假下午') || (/下午/.test(text) && text.includes('休假'))) return 'off-pm'
  if (text.includes('休假')) return 'off'
  if (/HO/i.test(text) || text.includes('居家')) return 'ho'
  if (text.includes('出差')) return 'business'
  if (text.includes('在公司') || text.includes('到公司') || text.includes('办公室')) return 'office'
  return null
}

function containsStatusKeyword(text) {
  return /(HO|居家|休假|出差|在公司|到公司|办公室)/i.test(text)
}

function splitCommandGroups(input) {
  const groups = []
  let buffer = ''
  for (const ch of input) {
    if (/[；;。]/.test(ch)) {
      if (buffer.trim()) groups.push(buffer.trim())
      buffer = ''
      continue
    }
    if (/[，,]/.test(ch) && containsStatusKeyword(buffer)) {
      if (buffer.trim()) groups.push(buffer.trim())
      buffer = ''
      continue
    }
    buffer += ch
  }
  if (buffer.trim()) groups.push(buffer.trim())
  return groups
}

function extractMembers(text, members) {
  return members.filter((name) => new RegExp(`(^|[^A-Za-z])${name}([^A-Za-z]|$)`, 'i').test(text))
}

function getNextWeekday(anchorDate, targetWeekday) {
  const cursor = new Date(anchorDate)
  const currentWeekday = cursor.getDay()
  cursor.setDate(cursor.getDate() - currentWeekday + 7 + targetWeekday)
  return cursor
}

function allWeekdaysInMonth(year, month, weekday) {
  const dates = []
  const cursor = new Date(year, month - 1, 1)
  while (cursor.getMonth() === month - 1) {
    if (cursor.getDay() === weekday) dates.push(formatDate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}


function addRangeDates(results, startDate, endDate) {
  const cursor = new Date(startDate)
  while (cursor <= endDate) {
    results.add(formatDate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
}

function extractDateSet(text, baseDate, defaultYear) {
  const results = new Set()

  const quarterMatch = text.match(/第([一二三四])季度每周([一二三四五六日天])/)
  if (quarterMatch) {
    const [, q, wd] = quarterMatch
    const weekday = WEEKDAY_MAP[wd]
    QUARTER_MONTHS[q].forEach((month) => {
      allWeekdaysInMonth(defaultYear, month, weekday).forEach((d) => results.add(d))
    })
  }

  const monthWeekdayMatch = text.match(/((?:\d{1,2}月|[一二三四五六七八九十两]{1,3}月)(?:\s*(?:和|、|，|,|&|and)\s*(?:\d{1,2}月|[一二三四五六七八九十两]{1,3}月))*)\s*每周([一二三四五六日天])/i)
  if (monthWeekdayMatch) {
    const [, monthsPart, wd] = monthWeekdayMatch
    const weekday = WEEKDAY_MAP[wd]
    const monthTokens = [...monthsPart.matchAll(/(\d{1,2}|[一二三四五六七八九十两]{1,3})月/g)]
    monthTokens.forEach((m) => {
      const month = cnToNumber(m[1])
      allWeekdaysInMonth(defaultYear, month, weekday).forEach((d) => results.add(d))
    })
  }

  for (const m of text.matchAll(/(\d{1,2}|[一二三四五六七八九十两]{1,3})月(\d{1,2}|[一二三四五六七八九十两]{1,3})号?到(\d{1,2}|[一二三四五六七八九十两]{1,3})月(\d{1,2}|[一二三四五六七八九十两]{1,3})号?/g)) {
    const startMonth = cnToNumber(m[1])
    const startDay = cnToNumber(m[2])
    const endMonth = cnToNumber(m[3])
    const endDay = cnToNumber(m[4])
    addRangeDates(results, new Date(defaultYear, startMonth - 1, startDay), new Date(defaultYear, endMonth - 1, endDay))
  }

  for (const m of text.matchAll(/(\d{1,2}|[一二三四五六七八九十两]{1,3})月(\d{1,2}|[一二三四五六七八九十两]{1,3})号?到(\d{1,2}|[一二三四五六七八九十两]{1,3})号?/g)) {
    const month = cnToNumber(m[1])
    const startDay = cnToNumber(m[2])
    const endDay = cnToNumber(m[3])
    addRangeDates(results, new Date(defaultYear, month - 1, startDay), new Date(defaultYear, month - 1, endDay))
  }

  for (const m of text.matchAll(/(今天|明天|后天)/g)) {
    const cursor = new Date(baseDate)
    if (m[1] === '明天') cursor.setDate(cursor.getDate() + 1)
    if (m[1] === '后天') cursor.setDate(cursor.getDate() + 2)
    results.add(formatDate(cursor))
  }

  for (const m of text.matchAll(/下周([一二三四五六日天])/g)) {
    const targetWeekday = WEEKDAY_MAP[m[1]]
    results.add(formatDate(getNextWeekday(baseDate, targetWeekday)))
  }

  for (const m of text.matchAll(/(\d{1,2}|[一二三四五六七八九十两]{1,3})月(\d{1,2}|[一二三四五六七八九十两]{1,3})号?/g)) {
    const month = cnToNumber(m[1])
    const day = cnToNumber(m[2])
    results.add(normalizeDate(defaultYear, month, day))
  }

  for (const m of text.matchAll(/(?:^|\s)(\d{1,2})\.(\d{1,2})(?:\s|$)/g)) {
    const month = Number(m[1])
    const day = Number(m[2])
    results.add(normalizeDate(defaultYear, month, day))
  }

  for (const m of text.matchAll(/(?:^|\s)(\d{2})(\d{2})(?:\s|$)/g)) {
    const month = Number(m[1])
    const day = Number(m[2])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      results.add(normalizeDate(defaultYear, month, day))
    }
  }

  return [...results].sort()
}

export function parseAiCommand(input, { members, statusMap, baseDate = new Date(), defaultYear = 2026 }) {
  const text = input.trim()
  if (!text) return { ok: false, message: '请输入一句指令。' }

  const groups = splitCommandGroups(text)
  const operations = []

  for (const group of groups) {
    const memberList = extractMembers(group, members)
    if (!memberList.length) {
      return { ok: false, message: '没有识别到组员名称，请输入 Doris、Mary、Mark、Jerry 或 Helen。' }
    }

    const status = parseStatus(group)
    if (!status) {
      return { ok: false, message: '没有识别到状态，请使用 在公司 / HO / 休假 / 出差。' }
    }

    const dates = extractDateSet(group, baseDate, defaultYear)
    if (!dates.length) {
      return { ok: false, message: '没有识别到日期，请使用例如“Doris从3月23号到3月31号休假”。' }
    }

    memberList.forEach((member) => {
      dates.forEach((dateStr) => {
        operations.push({ member, dateStr, status })
      })
    })
  }

  const first = operations[0]
  const summary = `共更新 ${operations.length} 条：` + operations
    .slice(0, 3)
    .map((op) => `${op.member} ${op.dateStr} ${statusMap[op.status].label}`)
    .join('；') + (operations.length > 3 ? '…' : '')

  return { ok: true, operations, summary, firstDateStr: first.dateStr, firstMember: first.member }
}
