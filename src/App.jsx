import { supabase } from './lib/supabase'
import React, { useEffect, useMemo, useState } from 'react'

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

function normalizeChineseDate(month, day, year) {
  return `${year}-${pad(Number(month))}-${pad(Number(day))}`
}

function parseAiCommand(input, year) {
  const text = input.trim()
  if (!text) return { ok: false, message: '请输入一句指令。' }

  const member = members.find((name) => new RegExp(`\\b${name}\\b`, 'i').test(text))
  if (!member) {
    return { ok: false, message: '没有识别到组员名称，请输入 Doris、Mary、Mark、Jerry 或 Helen。' }
  }

  let status = null
  if (/HO半天上午/i.test(text) || text.includes('HO上午')) status = 'ho-am'
  else if (/HO半天下午/i.test(text) || text.includes('HO下午')) status = 'ho-pm'
  else if (text.includes('休假半天上午') || text.includes('休假上午')) status = 'off-am'
  else if (text.includes('休假半天下午') || text.includes('休假下午')) status = 'off-pm'
  else if (text.includes('休假')) status = 'off'
  else if (/\bHO\b/i.test(text) || text.includes('居家')) status = 'ho'
  else if (text.includes('出差')) status = 'business'
  else if (text.includes('在公司') || text.includes('到公司') || text.includes('办公室')) status = 'office'

  if (!status) {
    return { ok: false, message: '没有识别到状态，请使用 在公司 / HO / 休假 / 出差。' }
  }

  const fullRangeMatch = text.match(/(\d{1,2})月(\d{1,2})号?到(\d{1,2})月(\d{1,2})号?/)
  if (fullRangeMatch) {
    const [, startMonth, startDay, endMonth, endDay] = fullRangeMatch
    return {
      ok: true,
      member,
      status,
      startDateStr: normalizeChineseDate(startMonth, startDay, year),
      endDateStr: normalizeChineseDate(endMonth, endDay, year),
      summary: `${member} 从 ${Number(startMonth)}月${Number(startDay)}日 到 ${Number(endMonth)}月${Number(endDay)}日改为${statusMap[status].label}`,
    }
  }

  const sameMonthRangeMatch = text.match(/(\d{1,2})月(\d{1,2})号?到(\d{1,2})号?/)
  if (sameMonthRangeMatch) {
    const [, month, startDay, endDay] = sameMonthRangeMatch
    return {
      ok: true,
      member,
      status,
      startDateStr: normalizeChineseDate(month, startDay, year),
      endDateStr: normalizeChineseDate(month, endDay, year),
      summary: `${member} 从 ${Number(month)}月${Number(startDay)}日 到 ${Number(month)}月${Number(endDay)}日改为${statusMap[status].label}`,
    }
  }

  const singleMatch = text.match(/(\d{1,2})月(\d{1,2})号?/)
  if (singleMatch) {
    const [, month, day] = singleMatch
    return {
      ok: true,
      member,
      status,
      startDateStr: normalizeChineseDate(month, day, year),
      endDateStr: normalizeChineseDate(month, day, year),
      summary: `${member} 在 ${Number(month)}月${Number(day)}日 改为${statusMap[status].label}`,
    }
  }

  return { ok: false, message: '没有识别到日期，请使用例如“Doris从3月23号到3月31号休假”。' }
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

async function saveOneOverride(dateStr, member, status) {
  const defaultStatus = getDefaultStatus(dateStr)

  const { error: deleteError } = await supabase
    .from('calendar_events')
    .delete()
    .eq('event_date', dateStr)
    .eq('person_name', member)

  if (deleteError) throw deleteError

  if (status !== defaultStatus) {
    const { error: insertError } = await supabase
      .from('calendar_events')
      .insert([{ person_name: member, event_date: dateStr, status }])

    if (insertError) throw insertError
  }
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

export default function App() {
  const today = new Date()
  const currentYear = today.getFullYear()
  const todayStr = formatDate(today)

  const [overrides, setOverrides] = useState({})
  const [aiInput, setAiInput] = useState('Doris从3月23号到3月31号休假')
  const [aiFeedback, setAiFeedback] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingCell, setEditingCell] = useState(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [yearPickerOpen, setYearPickerOpen] = useState(false)

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

  const getStatusForDate = (dateStr, member) => overrides[dateStr]?.[member] || getDefaultStatus(dateStr)

  const updateMemberStatus = async (member, dateStr, nextStatus) => {
    try {
      await saveOneOverride(dateStr, member, nextStatus)
      const nextOverrides = await fetchOverridesFromSupabase()
      setOverrides(nextOverrides)
      setAiFeedback(`${member} 在 ${dateStr} 已更新为 ${statusMap[nextStatus].label}`)
      setEditingCell(null)
    } catch (error) {
      console.error('Failed to update member status', error)
      setAiFeedback('保存失败，请稍后重试。')
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
      await saveRangeOverride(parsed.member, parsed.startDateStr, parsed.endDateStr, parsed.status)
      const nextOverrides = await fetchOverridesFromSupabase()
      setOverrides(nextOverrides)
      setAiFeedback(`已更新：${parsed.summary}`)
    } catch (error) {
      console.error('Failed to apply AI command', error)
      setAiFeedback('AI 更新失败，请稍后重试。')
    }
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
            <div className="row wrap gap-12 ai-inline-row">
              <h2>AI 快速录入</h2>
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
              <p className="subtle">点击单元格即可下拉修改状态。</p>
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
                    {weekDates.map((date, idx) => {
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
                  {members.map((member) => (
                    <tr key={member}>
                      <th className="member-col">{member}</th>
                      {weekDates.map((date) => {
                        const dateStr = formatDate(date)
                        const status = getStatusForDate(dateStr, member)
                        const cellKey = `${member}-${dateStr}`
                        const isEditing = editingCell === cellKey
                        const isToday = dateStr === todayStr

                        return (
                          <td
                            key={cellKey}
                            className={`${isToday ? 'table-today-col' : ''} ${isToday && member === members[members.length - 1] ? 'table-today-end' : ''}`}
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
                              <button className={`table-status ${statusMap[status].className}`} onClick={() => setEditingCell(cellKey)}>
                                {statusMap[status].shortLabel}
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
      </div>
    </div>
  )
}
