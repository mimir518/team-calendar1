import { supabase } from './lib/supabase'
import React, { useEffect, useMemo, useRef, useState } from 'react'

const members = ['Doris', 'Mary', 'Mark', 'Jerry', 'Helen']

const statusOptions = [
  { value: 'office', label: '在公司', shortLabel: '在公司', className: 'status-office' },
  { value: 'ho', label: 'HO', shortLabel: 'HO', className: 'status-ho' },
  { value: 'ho-am', label: 'HO上午', shortLabel: 'HO上', className: 'status-ho' },
  { value: 'ho-pm', label: 'HO下午', shortLabel: 'HO下', className: 'status-ho-dark' },
  { value: 'off', label: '休假', shortLabel: '休假', className: 'status-off' },
  { value: 'off-am', label: '休假上午', shortLabel: '休上', className: 'status-off' },
  { value: 'off-pm', label: '休假下午', shortLabel: '休下', className: 'status-off-dark' },
  { value: 'business', label: '出差', shortLabel: '出差', className: 'status-business' },
]

const statusMap = Object.fromEntries(statusOptions.map((s) => [s.value, s]))
const weekdayNames = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日']

const holidayMapByYear = {
  2026: {
    '2026-01-01': '元旦',
    '2026-01-02': '元旦',
    '2026-01-03': '元旦',
    '2026-02-15': '春节',
    '2026-02-16': '春节',
    '2026-02-17': '春节',
    '2026-02-18': '春节',
    '2026-02-19': '春节',
    '2026-02-20': '春节',
    '2026-02-21': '春节',
    '2026-02-22': '春节',
    '2026-02-23': '春节',
    '2026-04-05': '清明节',
    '2026-04-06': '清明节',
    '2026-05-01': '劳动节',
    '2026-05-02': '劳动节',
    '2026-05-03': '劳动节',
    '2026-05-31': '端午节',
    '2026-06-01': '端午节',
    '2026-09-25': '中秋节',
    '2026-09-26': '中秋节',
    '2026-10-01': '国庆节',
    '2026-10-02': '国庆节',
    '2026-10-03': '国庆节',
    '2026-10-04': '国庆节',
    '2026-10-05': '国庆节',
    '2026-10-06': '国庆节',
    '2026-10-07': '国庆节',
    '2026-10-08': '国庆节',
  },
}

const makeupWorkdaysByYear = {
  2026: new Set([
    '2026-02-14',
    '2026-02-28',
    '2026-04-04',
    '2026-05-30',
    '2026-09-27',
    '2026-10-10',
  ]),
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function isWeekend(date) {
  const day = date.getDay()
  return day === 0 || day === 6
}

function getDayType(dateStr) {
  const dt = new Date(`${dateStr}T00:00:00`)
  const targetYear = dt.getFullYear()
  const holidayMap = holidayMapByYear[targetYear] || {}
  const makeupWorkdays = makeupWorkdaysByYear[targetYear] || new Set()
  const holidayName = holidayMap[dateStr]

  if (holidayName) return { type: 'holiday', label: holidayName }
  if (makeupWorkdays.has(dateStr)) return { type: 'workday', label: '调休上班' }
  if (isWeekend(dt)) return { type: 'weekend', label: '周末' }
  return { type: 'workday', label: '工作日' }
}

function getDefaultStatus(dateStr) {
  const dayType = getDayType(dateStr).type
  return dayType === 'holiday' || dayType === 'weekend' ? 'off' : 'office'
}

function isHalfDayStatus(status) {
  return typeof status === 'string' && /-(am|pm)$/.test(status)
}

function isOffStatus(status) {
  if (!status) return false
  return status.split('+').some((item) => item === 'off' || item.startsWith('off-'))
}

function getHalfDayPeriod(status) {
  if (status.endsWith('-am')) return 'am'
  if (status.endsWith('-pm')) return 'pm'
  return null
}

function splitCompositeStatus(status) {
  return String(status || '')
    .split('+')
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildCompositeStatus(segments) {
  const unique = [...new Set(segments)]
  const ordered = unique.sort((a, b) => {
    const periodA = getHalfDayPeriod(a)
    const periodB = getHalfDayPeriod(b)
    if (periodA === periodB) return 0
    if (periodA === 'am') return -1
    if (periodB === 'am') return 1
    return a.localeCompare(b)
  })
  return ordered.join('+')
}

function getStatusMeta(status) {
  if (statusMap[status]) return statusMap[status]

  const segments = splitCompositeStatus(status).filter((item) => statusMap[item])
  if (!segments.length) {
    return { label: String(status), shortLabel: String(status), className: 'status-office' }
  }

  return {
    label: segments.map((item) => statusMap[item].label).join(' + '),
    shortLabel: segments.map((item) => statusMap[item].shortLabel).join('+'),
    className: 'status-mixed',
  }
}

function resolveNextStatus(currentStatus, requestedStatus) {
  if (!isHalfDayStatus(requestedStatus)) return requestedStatus

  const currentSegments = splitCompositeStatus(currentStatus)
  const halfDaySegments = currentSegments.filter(isHalfDayStatus)

  if (!halfDaySegments.length) return requestedStatus

  const requestedPeriod = getHalfDayPeriod(requestedStatus)
  const withoutSamePeriod = halfDaySegments.filter((item) => getHalfDayPeriod(item) !== requestedPeriod)
  return buildCompositeStatus([...withoutSamePeriod, requestedStatus])
}

function normalizeChineseDate(month, day, year) {
  return `${year}-${pad(Number(month))}-${pad(Number(day))}`
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getQuarterDateRange(quarter, year = 2026) {
  const quarterMap = {
    1: { startDateStr: `${year}-01-01`, endDateStr: `${year}-03-31` },
    2: { startDateStr: `${year}-04-01`, endDateStr: `${year}-06-30` },
    3: { startDateStr: `${year}-07-01`, endDateStr: `${year}-09-30` },
    4: { startDateStr: `${year}-10-01`, endDateStr: `${year}-12-31` },
  }
  return quarterMap[quarter]
}

function parseStatusFromText(text) {
  if (/HO半天上午/i.test(text) || text.includes('HO上午')) return 'ho-am'
  if (/HO半天下午/i.test(text) || text.includes('HO下午')) return 'ho-pm'
  if (text.includes('休假半天上午') || text.includes('休假上午')) return 'off-am'
  if (text.includes('休假半天下午') || text.includes('休假下午')) return 'off-pm'
  if (text.includes('休假')) return 'off'
  if (/\bHO\b/i.test(text) || text.includes('居家')) return 'ho'
  if (text.includes('出差')) return 'business'
  if (text.includes('在公司') || text.includes('到公司') || text.includes('办公室')) return 'office'
  return null
}

function extractMembersFromText(text) {
  const matched = members.filter((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i').test(text))
  return [...new Set(matched)]
}

function parseTemporalRuleFromText(text, fallbackQuarter, defaultYear = 2026) {
  const fullRangeMatch = text.match(/(\d{1,2})月(\d{1,2})号?到(\d{1,2})月(\d{1,2})号?/)
  if (fullRangeMatch) {
    const [, startMonth, startDay, endMonth, endDay] = fullRangeMatch
    return {
      temporalRule: {
        type: 'date-range',
        startDateStr: normalizeChineseDate(startMonth, startDay, defaultYear),
        endDateStr: normalizeChineseDate(endMonth, endDay, defaultYear),
      },
      summary: `从 ${Number(startMonth)}月${Number(startDay)}日 到 ${Number(endMonth)}月${Number(endDay)}日`,
    }
  }

  const sameMonthRangeMatch = text.match(/(\d{1,2})月(\d{1,2})号?到(\d{1,2})号?/)
  if (sameMonthRangeMatch) {
    const [, month, startDay, endDay] = sameMonthRangeMatch
    return {
      temporalRule: {
        type: 'date-range',
        startDateStr: normalizeChineseDate(month, startDay, defaultYear),
        endDateStr: normalizeChineseDate(month, endDay, defaultYear),
      },
      summary: `从 ${Number(month)}月${Number(startDay)}日 到 ${Number(month)}月${Number(endDay)}日`,
    }
  }

  const singleMatch = text.match(/(\d{1,2})月(\d{1,2})号?/)
  if (singleMatch) {
    const [, month, day] = singleMatch
    return {
      temporalRule: {
        type: 'date-range',
        startDateStr: normalizeChineseDate(month, day, defaultYear),
        endDateStr: normalizeChineseDate(month, day, defaultYear),
      },
      summary: `${Number(month)}月${Number(day)}日`,
    }
  }

  const quarterMatch = text.match(/第?([一二三四1234])季度/)
  const quarterToken = quarterMatch?.[1] || fallbackQuarter
  const quarterValueMap = { 一: 1, 二: 2, 三: 3, 四: 4, '1': 1, '2': 2, '3': 3, '4': 4 }
  const quarter = quarterToken ? quarterValueMap[quarterToken] : null

  const weekdayMatch = text.match(/每周([一二三四五六日天])/)
  if (weekdayMatch) {
    const weekdayMap = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 }
    const weekday = weekdayMap[weekdayMatch[1]]
    const range = quarter
      ? getQuarterDateRange(quarter, defaultYear)
      : { startDateStr: `${defaultYear}-01-01`, endDateStr: `${defaultYear}-12-31` }

    return {
      temporalRule: {
        type: 'weekly',
        weekday,
        ...range,
        quarter,
      },
      summary: `${quarter ? `第${quarter}季度` : '全年'}每周${weekdayMatch[1]}`,
    }
  }

  return null
}

function parseAiCommand(input, defaultYear = 2026) {
  const text = input.trim()
  if (!text) return { ok: false, message: '请输入一句指令。' }

  const quarterMatch = text.match(/第?([一二三四1234])季度/)
  const fallbackQuarter = quarterMatch?.[1]
  const memberPattern = members.map(escapeRegExp).join('|')

  const clauses = text
    .split(/[，;。&]+/)
    .flatMap((segment) => segment.split(new RegExp(`\\s+(?=(?:${memberPattern})\\b)`, 'i')))
    .map((item) => item.trim())
    .filter(Boolean)

  const actions = []

  for (const clause of clauses) {
    const membersInClause = extractMembersFromText(clause.replace(/(和|、|,|and)/gi, ' '))
    if (!membersInClause.length) continue

    const status = parseStatusFromText(clause)
    if (!status) {
      return { ok: false, message: `子句“${clause}”没有识别到状态，请使用 在公司 / HO / 休假 / 出差。` }
    }

    const temporalResult = parseTemporalRuleFromText(clause, fallbackQuarter, defaultYear)
    if (!temporalResult) {
      return { ok: false, message: `子句“${clause}”没有识别到时间，请补充日期或“每周几”。` }
    }

    actions.push({
      members: membersInClause,
      status,
      temporalRule: temporalResult.temporalRule,
      summary: `${membersInClause.join('、')} ${temporalResult.summary} 改为${statusMap[status].label}`,
    })
  }

  if (!actions.length) {
    return { ok: false, message: '没有识别到可执行的子句，请输入包含成员、时间和状态的指令。' }
  }

  return { ok: true, actions }
}

function rowsToOverrides(rows) {
  const next = {}
  for (const row of rows || []) {
    if (!next[row.event_date]) next[row.event_date] = {}
    next[row.event_date][row.person_name] = row.status
  }
  return next
}

function getWeekDates(baseDate) {
  const day = baseDate.getDay()
  const offset = day === 0 ? -6 : 1 - day
  const monday = new Date(baseDate)
  monday.setDate(baseDate.getDate() + offset)

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    return date
  })
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

async function fetchOverridesFromSupabase() {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('id, person_name, event_date, status')

  if (error) throw error
  return rowsToOverrides(data)
}

async function saveOverrides(entries) {
  const dedupedEntries = new Map()

  for (const entry of entries) {
    const key = `${entry.member}::${entry.dateStr}`
    dedupedEntries.set(key, entry)
  }

  const deleteDatesByMember = new Map()
  const upsertRows = []

  for (const { dateStr, member, status } of dedupedEntries.values()) {
    const defaultStatus = getDefaultStatus(dateStr)

    if (status === defaultStatus) {
      if (!deleteDatesByMember.has(member)) deleteDatesByMember.set(member, [])
      deleteDatesByMember.get(member).push(dateStr)
      continue
    }

    upsertRows.push({ person_name: member, event_date: dateStr, status })
  }

  const deleteTasks = []
  const DELETE_CHUNK_SIZE = 80

  for (const [member, dateList] of deleteDatesByMember.entries()) {
    const uniqueDates = [...new Set(dateList)]

    for (let i = 0; i < uniqueDates.length; i += DELETE_CHUNK_SIZE) {
      const dateChunk = uniqueDates.slice(i, i + DELETE_CHUNK_SIZE)
      deleteTasks.push(
        supabase
          .from('calendar_events')
          .delete()
          .eq('person_name', member)
          .in('event_date', dateChunk),
      )
    }
  }

  if (deleteTasks.length) {
    const deleteResults = await Promise.all(deleteTasks)
    for (const result of deleteResults) {
      if (result.error) throw result.error
    }
  }

  if (upsertRows.length) {
    const { error: upsertError } = await supabase
      .from('calendar_events')
      .upsert(upsertRows, { onConflict: 'person_name,event_date' })

    if (upsertError) throw upsertError
  }
}

async function saveOneOverride(dateStr, member, status) {
  await saveOverrides([{ dateStr, member, status }])
}

async function saveRangeOverride(member, startDateStr, endDateStr, status) {
  const start = new Date(`${startDateStr}T00:00:00`)
  const end = new Date(`${endDateStr}T00:00:00`)
  const cursor = new Date(start)

  while (cursor <= end) {
    const dateStr = formatDate(cursor)
    await saveOneOverride(dateStr, member, status)
    cursor.setDate(cursor.getDate() + 1)
  }
}

async function saveTemporalRuleOverride(member, status, temporalRule) {
  if (temporalRule.type === 'date-range') {
    await saveRangeOverride(member, temporalRule.startDateStr, temporalRule.endDateStr, status)
    return
  }

  if (temporalRule.type === 'weekly') {
    const start = new Date(`${temporalRule.startDateStr}T00:00:00`)
    const end = new Date(`${temporalRule.endDateStr}T00:00:00`)
    const cursor = new Date(start)

    while (cursor <= end) {
      if (cursor.getDay() === temporalRule.weekday) {
        await saveOneOverride(formatDate(cursor), member, status)
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  }
}

function getDateStringsFromTemporalRule(temporalRule) {
  const results = []

  if (temporalRule.type === 'date-range') {
    const start = new Date(`${temporalRule.startDateStr}T00:00:00`)
    const end = new Date(`${temporalRule.endDateStr}T00:00:00`)
    const cursor = new Date(start)
    while (cursor <= end) {
      results.push(formatDate(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    return results
  }

  if (temporalRule.type === 'weekly') {
    const start = new Date(`${temporalRule.startDateStr}T00:00:00`)
    const end = new Date(`${temporalRule.endDateStr}T00:00:00`)
    const cursor = new Date(start)
    while (cursor <= end) {
      if (cursor.getDay() === temporalRule.weekday) {
        results.push(formatDate(cursor))
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  return results
}

export default function App() {
  const today = new Date()
  const currentYear = today.getFullYear()
  const todayStr = formatDate(today)

  const [overrides, setOverrides] = useState({})
  const [aiInput, setAiInput] = useState('')
  const [aiFeedback, setAiFeedback] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingCell, setEditingCell] = useState(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [yearPickerOpen, setYearPickerOpen] = useState(false)
  const [actionMenuOpen, setActionMenuOpen] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const actionMenuRef = useRef(null)
  const lastSilentRefreshAtRef = useRef(0)
  const silentRefreshTimerRef = useRef(null)

  const thisWeekMonday = useMemo(() => getWeekDates(today)[0], [todayStr])
  const [weekAnchorDate, setWeekAnchorDate] = useState(thisWeekMonday)
  const [jumpMonth, setJumpMonth] = useState(thisWeekMonday.getMonth() + 1)
  const [jumpDay, setJumpDay] = useState(thisWeekMonday.getDate())

  const yearOptions = useMemo(() => {
    return Array.from({ length: 6 }, (_, idx) => currentYear - 1 + idx)
  }, [currentYear])

  useEffect(() => {
    async function loadInitialData() {
      try {
        const nextOverrides = await fetchOverridesFromSupabase()
        setOverrides(nextOverrides)
      } catch (error) {
        console.error('Failed to load overrides from Supabase', error)
        setAiFeedback('读取数据库失败，请稍后重试。')
      } finally {
        setLoading(false)
      }
    }

    loadInitialData()

    return () => {
      if (silentRefreshTimerRef.current) {
        clearTimeout(silentRefreshTimerRef.current)
      }
    }
  }, [])

  const weekDates = useMemo(() => {
    const targetDate = new Date(weekAnchorDate)
    targetDate.setDate(targetDate.getDate() + weekOffset * 7)
    return getWeekDates(targetDate)
  }, [weekAnchorDate, weekOffset])

  const dayOptions = useMemo(() => {
    const daysInMonth = getDaysInMonth(selectedYear, jumpMonth)
    return Array.from({ length: daysInMonth }, (_, idx) => idx + 1)
  }, [selectedYear, jumpMonth])

  useEffect(() => {
    if (!dayOptions.includes(jumpDay)) {
      setJumpDay(dayOptions[dayOptions.length - 1])
    }
  }, [dayOptions, jumpDay])

  useEffect(() => {
    const targetDate = new Date(selectedYear, jumpMonth - 1, jumpDay)
    setWeekAnchorDate(targetDate)
    setWeekOffset(0)
  }, [selectedYear, jumpMonth, jumpDay])

  useEffect(() => {
    if (!actionMenuOpen) return

    const handleClickOutside = (event) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) {
        setActionMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [actionMenuOpen])

  const getStatusForDate = (dateStr, member) => overrides[dateStr]?.[member] || getDefaultStatus(dateStr)

  const getStatusFromMap = (dateStr, member, sourceMap) => sourceMap[dateStr]?.[member] || getDefaultStatus(dateStr)

  const fetchAndSyncOverrides = async (errorMessage) => {
    try {
      const nextOverrides = await fetchOverridesFromSupabase()
      setOverrides(nextOverrides)
      return true
    } catch (error) {
      console.error('Failed to sync overrides from Supabase', error)
      if (errorMessage) setAiFeedback(errorMessage)
      return false
    }
  }

  const putStatusToMap = (dateStr, member, status, sourceMap) => {
    const next = { ...sourceMap }
    const dayMap = { ...(next[dateStr] || {}) }
    const defaultStatus = getDefaultStatus(dateStr)

    if (status === defaultStatus) {
      delete dayMap[member]
      if (Object.keys(dayMap).length) next[dateStr] = dayMap
      else delete next[dateStr]
      return next
    }

    dayMap[member] = status
    next[dateStr] = dayMap
    return next
  }

  const putStatusToMutableMap = (dateStr, member, status, targetMap) => {
    const dayMap = targetMap[dateStr] || {}
    const defaultStatus = getDefaultStatus(dateStr)

    if (status === defaultStatus) {
      if (!Object.prototype.hasOwnProperty.call(dayMap, member)) return
      delete dayMap[member]
      if (Object.keys(dayMap).length) targetMap[dateStr] = dayMap
      else delete targetMap[dateStr]
      return
    }

    dayMap[member] = status
    targetMap[dateStr] = dayMap
  }

  const getFinalStatusBySource = (currentStatus, requestedStatus, dateStr, source) => {
    if (source === 'ai' && getDayType(dateStr).type === 'holiday' && currentStatus === 'off' && !isOffStatus(requestedStatus)) {
      return 'off'
    }
    return resolveNextStatus(currentStatus, requestedStatus)
  }

  const scheduleSilentRefresh = () => {
    const SILENT_REFRESH_MIN_INTERVAL = 30000
    const now = Date.now()
    if (now - lastSilentRefreshAtRef.current < SILENT_REFRESH_MIN_INTERVAL) return

    if (silentRefreshTimerRef.current) {
      clearTimeout(silentRefreshTimerRef.current)
    }

    silentRefreshTimerRef.current = setTimeout(async () => {
      lastSilentRefreshAtRef.current = Date.now()
      await fetchAndSyncOverrides()
      silentRefreshTimerRef.current = null
    }, 1500)
  }

  const updateMemberStatus = async (member, dateStr, nextStatus) => {
    try {
      const currentStatus = getStatusForDate(dateStr, member)
      const finalStatus = getFinalStatusBySource(currentStatus, nextStatus, dateStr, 'manual')

      if (finalStatus === currentStatus) {
        setAiFeedback(`${member} 在 ${dateStr} 状态无变化`)
        setEditingCell(null)
        return
      }

      await saveOneOverride(dateStr, member, finalStatus)
      setOverrides((prev) => putStatusToMap(dateStr, member, finalStatus, prev))
      scheduleSilentRefresh()
      setAiFeedback(`${member} 在 ${dateStr} 已更新为 ${getStatusMeta(finalStatus).label}`)
      setEditingCell(null)
    } catch (error) {
      console.error('Failed to update member status', error)
      await fetchAndSyncOverrides('保存失败，请稍后重试。')
    }
  }

  const resetAllData = async () => {
    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .neq('id', 0)

      if (error) throw error

      setOverrides({})
      setAiFeedback('已清空所有自定义状态，恢复默认规则。')
      setEditingCell(null)
    } catch (error) {
      console.error('Failed to reset data', error)
      setAiFeedback('清空失败，请稍后重试。')
    }
  }

  const applyAiCommand = async () => {
    const parsed = parseAiCommand(aiInput, selectedYear)
    if (!parsed.ok) {
      setAiFeedback(parsed.message)
      return
    }

    try {
      const draftOverrides = Object.fromEntries(
        Object.entries(overrides).map(([dateStr, dayMap]) => [dateStr, { ...dayMap }]),
      )
      const pendingWrites = []

      for (const action of parsed.actions) {
        for (const member of action.members) {
          const dateList = getDateStringsFromTemporalRule(action.temporalRule)
          for (const dateStr of dateList) {
            const currentStatus = getStatusFromMap(dateStr, member, draftOverrides)
            const finalStatus = getFinalStatusBySource(currentStatus, action.status, dateStr, 'ai')

            if (finalStatus === currentStatus) continue

            pendingWrites.push({ dateStr, member, status: finalStatus })
            putStatusToMutableMap(dateStr, member, finalStatus, draftOverrides)
          }
        }
      }

      if (pendingWrites.length) {
        await saveOverrides(pendingWrites)
      }

      setOverrides(draftOverrides)
      scheduleSilentRefresh()
      setAiFeedback(`已更新：${parsed.actions.map((item) => item.summary).join('；')}`)
    } catch (error) {
      console.error('Failed to apply AI command', error)
      await fetchAndSyncOverrides('AI 更新失败，请稍后重试。')
    }
  }

  const handleManualRefresh = async () => {
    setActionMenuOpen(false)
    const refreshed = await fetchAndSyncOverrides('刷新失败，请稍后重试。')
    if (refreshed) setAiFeedback('已从云端刷新最新数据。')
  }

  const goToCurrentWeek = () => {
    setSelectedYear(currentYear)
    setJumpMonth(today.getMonth() + 1)
    setJumpDay(today.getDate())
    setWeekAnchorDate(thisWeekMonday)
    setWeekOffset(0)
  }

  const openResetConfirm = () => {
    setActionMenuOpen(false)
    setShowResetConfirm(true)
  }

  const handleConfirmReset = async () => {
    await resetAllData()
    setShowResetConfirm(false)
  }

  return (
    <div className="app-shell">
      <div className="app-wrap">
        <div className="hero-card card">
          <div className="hero-title-wrap">
            <h1>WPM Calendar</h1>
          </div>
          <div className="hero-stats">
            <button
              type="button"
              className="stat-box"
              onClick={() => setYearPickerOpen((prev) => !prev)}
            >
              {yearPickerOpen ? (
                <select
                  className="year-select"
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(Number(e.target.value))
                    setWeekOffset(0)
                    setYearPickerOpen(false)
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              ) : (
                <div className="stat-value">{selectedYear}</div>
              )}
            </button>
          </div>
        </div>

        <div className="card section-card">
          <div className="ai-box">
            <div className="row gap-12 ai-inline-row">
              <h2>AI 快速录入</h2>
              <div className="menu-wrap" ref={actionMenuRef}>
                <button
                  type="button"
                  className="menu-trigger"
                  onClick={() => setActionMenuOpen((prev) => !prev)}
                  aria-label="更多操作"
                >
                  ...
                </button>
                {actionMenuOpen ? (
                  <div className="menu-dropdown">
                    <button type="button" className="menu-item" onClick={handleManualRefresh}>
                      手动刷新云端数据
                    </button>
                    <button type="button" className="menu-item" onClick={openResetConfirm}>
                      清空所有自定义状态
                    </button>
                  </div>
                ) : null}
              </div>
              <input
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="例如：Mary 4月8号HO上午"
                className="text-input"
              />
              <button onClick={applyAiCommand} className="primary-btn">更新</button>
            </div>
            {aiFeedback ? <div className="feedback">{aiFeedback}</div> : null}
          </div>
        </div>

        <section className="card weekly-card">
          <div className="row between wrap gap-12 section-head">
            <div>
              <h2>每周安排</h2>
            </div>
            <div className="week-nav-cards">
              <div className="week-jump-card">
                <select
                  className="week-jump-select"
                  value={jumpMonth}
                  onChange={(e) => setJumpMonth(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, idx) => idx + 1).map((month) => (
                    <option key={month} value={month}>{`${month}月`}</option>
                  ))}
                </select>
                <select
                  className="week-jump-select"
                  value={jumpDay}
                  onChange={(e) => setJumpDay(Number(e.target.value))}
                >
                  {dayOptions.map((day) => (
                    <option key={day} value={day}>{`${day}日`}</option>
                  ))}
                </select>
              </div>
              <button className="week-nav-card" onClick={() => setWeekOffset((prev) => prev - 1)}>{'<'}</button>
              <button className="week-nav-card week-nav-today" onClick={goToCurrentWeek}>今天</button>
              <button className="week-nav-card" onClick={() => setWeekOffset((prev) => prev + 1)}>{'>'}</button>
            </div>
          </div>

          {loading ? (
            <div className="subtle" style={{ padding: '20px 0' }}>正在读取云端数据...</div>
          ) : (
            <div className="week-table-wrap">
              <div className="weekdays-strip">
                <div className="weekday-member-placeholder" />
                {weekDates.map((date, idx) => (
                  <div key={`weekday-${formatDate(date)}`} className="weekday-label">{weekdayNames[idx]}</div>
                ))}
              </div>

              <table className="week-table">
                <thead>
                  <tr>
                    <th className="member-head">成员</th>
                    {weekDates.map((date) => {
                      const dateStr = formatDate(date)
                      const dayType = getDayType(dateStr)
                      const isToday = dateStr === todayStr

                      return (
                        <th
                          key={dateStr}
                          className={`${dayType.type === 'holiday' || dayType.type === 'weekend' ? 'table-weekend-off' : ''} ${isToday ? 'table-today-col table-today-start' : ''}`}
                        >
                          <div className="table-date">{`${date.getMonth() + 1}/${date.getDate()}`}</div>
                          <div className="table-daytype">{dayType.label}</div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {members.map((member, memberIndex) => (
                    <tr key={member}>
                      <th className="member-col">{member}</th>
                      {weekDates.map((date) => {
                        const dateStr = formatDate(date)
                        const status = getStatusForDate(dateStr, member)
                        const cellKey = `${member}-${dateStr}`
                        const isEditing = editingCell === cellKey
                        const isToday = dateStr === todayStr
                        const isLastMember = memberIndex === members.length - 1

                        return (
                          <td
                            key={cellKey}
                            className={`${isToday ? 'table-today-col' : ''} ${isToday && isLastMember ? 'table-today-end' : ''}`}
                          >
                            {isEditing ? (
                              <select
                                autoFocus
                                className="table-select"
                                value={status}
                                onChange={(e) => updateMemberStatus(member, dateStr, e.target.value)}
                                onBlur={() => setEditingCell(null)}
                              >
                                {statusOptions.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            ) : (
                              <button
                                className={`table-status ${getStatusMeta(status).className}`}
                                onClick={() => setEditingCell(cellKey)}
                              >
                                {getStatusMeta(status).shortLabel}
                              </button>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {showResetConfirm ? (
          <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="confirm-modal">
              <p>确认要清空所有自定义状态吗？</p>
              <div className="confirm-actions">
                <button type="button" className="primary-btn" onClick={handleConfirmReset}>是</button>
                <button type="button" className="ghost-btn" onClick={() => setShowResetConfirm(false)}>否</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
