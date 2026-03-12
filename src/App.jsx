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
const summaryStatuses = ['office', 'ho', 'off', 'business']
const statusMap = Object.fromEntries(statusOptions.map((s) => [s.value, s]))
const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const weekdayNames = ['日', '一', '二', '三', '四', '五', '六']
const aiRecentExamples = [
  'Doris从3月23号到3月31号休假',
  'Mary 4月8号HO上午',
  'Mark 5月1号到5月5号出差',
]

const holidayMap2026 = {
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
}

const makeupWorkdays2026 = new Set([
  '2026-02-14',
  '2026-02-28',
  '2026-04-04',
  '2026-05-30',
  '2026-09-27',
  '2026-10-10',
])

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
  const holidayName = holidayMap2026[dateStr]
  if (holidayName) return { type: 'holiday', label: holidayName }
  if (makeupWorkdays2026.has(dateStr)) return { type: 'workday', label: '调休上班' }
  if (isWeekend(dt)) return { type: 'weekend', label: '周末' }
  return { type: 'workday', label: '工作日' }
}

function getDefaultStatus(dateStr) {
  const dayType = getDayType(dateStr).type
  return dayType === 'holiday' || dayType === 'weekend' ? 'off' : 'office'
}

function buildMonth(year, monthIndex) {
  const first = new Date(year, monthIndex, 1)
  const last = new Date(year, monthIndex + 1, 0)
  const leading = first.getDay()
  const days = []

  for (let i = 0; i < leading; i += 1) days.push(null)
  for (let day = 1; day <= last.getDate(); day += 1) {
    days.push(new Date(year, monthIndex, day))
  }
  while (days.length % 7 !== 0) days.push(null)
  return days
}

function normalizeChineseDate(month, day) {
  return `2026-${pad(Number(month))}-${pad(Number(day))}`
}

function collapseStatusForSummary(status) {
  if (status.startsWith('ho')) return 'ho'
  if (status.startsWith('off')) return 'off'
  return status
}

function parseAiCommand(input) {
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
      startDateStr: normalizeChineseDate(startMonth, startDay),
      endDateStr: normalizeChineseDate(endMonth, endDay),
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
      startDateStr: normalizeChineseDate(month, startDay),
      endDateStr: normalizeChineseDate(month, endDay),
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
      startDateStr: normalizeChineseDate(month, day),
      endDateStr: normalizeChineseDate(month, day),
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
  const todayStr = formatDate(new Date())
  const initialMonth = todayStr.startsWith('2026-') ? Number(todayStr.slice(5, 7)) - 1 : 2
  const initialDate = todayStr.startsWith('2026-') ? todayStr : '2026-03-11'

  const [selectedMonth, setSelectedMonth] = useState(initialMonth)
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [overrides, setOverrides] = useState({})
  const [selectedMember, setSelectedMember] = useState(members[0])
  const [aiInput, setAiInput] = useState('Doris从3月23号到3月31号休假')
  const [aiFeedback, setAiFeedback] = useState('')
  const [loading, setLoading] = useState(true)

  const buildAiFailureFeedback = (message) => `${message} 最近可用示例：${aiRecentExamples.join('；')}`

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

  const monthDays = useMemo(() => buildMonth(2026, selectedMonth), [selectedMonth])
  const selectedDayType = getDayType(selectedDate)

  const selectedStatuses = useMemo(() => {
    const dayOverrides = overrides[selectedDate] || {}
    return Object.fromEntries(
      members.map((member) => [member, dayOverrides[member] || getDefaultStatus(selectedDate)])
    )
  }, [overrides, selectedDate])

  const summary = useMemo(() => {
    const counts = { office: 0, ho: 0, off: 0, business: 0 }
    members.forEach((m) => {
      counts[collapseStatusForSummary(selectedStatuses[m])] += 1
    })
    return counts
  }, [selectedStatuses])

  const getStatusForDate = (dateStr, member) => overrides[dateStr]?.[member] || getDefaultStatus(dateStr)

  const updateMemberStatus = async (member, nextStatus) => {
    try {
      await saveOneOverride(selectedDate, member, nextStatus)
      const nextOverrides = await fetchOverridesFromSupabase()
      setOverrides(nextOverrides)
      setAiFeedback(`${member} 在 ${selectedDate} 已更新为 ${statusMap[nextStatus].label}`)
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
    } catch (error) {
      console.error('Failed to reset data', error)
      setAiFeedback('清空失败，请稍后重试。')
    }
  }

  const applyAiCommand = async () => {
    const parsed = parseAiCommand(aiInput)
    if (!parsed.ok) {
      setAiFeedback(buildAiFailureFeedback(parsed.message))
      return
    }

    try {
      await saveRangeOverride(parsed.member, parsed.startDateStr, parsed.endDateStr, parsed.status)
      const nextOverrides = await fetchOverridesFromSupabase()
      setOverrides(nextOverrides)
      setSelectedDate(parsed.startDateStr)
      setSelectedMember(parsed.member)
      setSelectedMonth(Number(parsed.startDateStr.slice(5, 7)) - 1)
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
          <div>
            <div className="eyebrow">MVP Preview</div>
            <h1>Team Status Calendar 2026</h1>
            <p className="subtle">
              组员：Doris、Mary、Mark、Jerry、Helen。默认按 2026 年中国工作日 / 周末 / 公共假期自动填充，支持手动改单人状态、半天 HO/休假，以及一句话 AI 录入。
            </p>
          </div>
          <div className="hero-stats">
            <div className="stat-box">
              <div className="stat-label">年份</div>
              <div className="stat-value">2026</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">成员数</div>
              <div className="stat-value">5</div>
            </div>
          </div>
        </div>

        <div className="card section-card">
          <div className="ai-box">
            <div className="row between wrap gap-12">
              <div>
                <h2>AI 快速录入</h2>
                <p className="subtle">输入一句话，自动识别人员、日期和状态并更新日历。</p>
                <div className="notes">
                  <p>• 人员：支持单人 / 多人（当前会优先识别到的第一位成员）</p>
                  <p>• 时间：支持日期区间、月份、季度、年份表达</p>
                  <p>• 规则：支持每周几（如每周一、每周三）</p>
                  <p>• 状态：支持 HO / 休假 / 出差 / 在公司（含半天）</p>
                </div>
              </div>
              <div className="mini-tip">示例：Doris从3月23号到3月31号休假</div>
            </div>

            <div className="row wrap gap-12 top-gap">
              <input
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="例如：Mary 4月8号HO上午"
                className="text-input"
              />
              <button onClick={applyAiCommand} className="primary-btn">AI 更新日历</button>
              <button onClick={resetAllData} className="ghost-btn">清空自定义数据</button>
            </div>
            {aiFeedback ? <div className="feedback">{aiFeedback}</div> : null}
          </div>

          <div className="row between wrap gap-12">
            <div>
              <h2>当日摘要</h2>
              <p className="subtle">{selectedDate} · {selectedDayType.label}</p>
            </div>
            <div className={`pill ${selectedDayType.type === 'holiday' ? 'pill-holiday' : selectedDayType.type === 'weekend' ? 'pill-weekend' : 'pill-workday'}`}>
              默认：{getDefaultStatus(selectedDate) === 'off' ? '休假' : '在公司'}
            </div>
          </div>

          <div className="summary-grid">
            {summaryStatuses.map((key) => (
              <div key={key} className="summary-card">
                <div className="stat-label">{statusMap[key].label}</div>
                <div className="summary-value">{summary[key]}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="main-grid">
          <section className="card">
            <div className="row between wrap gap-12 section-head">
              <div>
                <h2>年度日历</h2>
                <p className="subtle">当前显示 {selectedMember} 在这个月每天的状态，状态会直接标在日历格里。</p>
              </div>
              <div className="row wrap gap-12">
                <div className="member-pill">当前成员：{selectedMember}</div>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="select-input">
                  {monthNames.map((month, idx) => (
                    <option key={month} value={idx}>{month}</option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="subtle" style={{ padding: '20px 0' }}>正在读取云端数据...</div>
            ) : (
              <>
                <div className="weekday-grid">
                  {weekdayNames.map((name) => <div key={name}>{name}</div>)}
                </div>

                <div className="calendar-grid">
                  {monthDays.map((date, idx) => {
                    if (!date) return <div key={`empty-${idx}`} className="calendar-empty" />
                    const dateStr = formatDate(date)
                    const dayType = getDayType(dateStr)
                    const isSelected = dateStr === selectedDate
                    const isToday = dateStr === todayStr
                    const status = getStatusForDate(dateStr, selectedMember)

                    let className = 'calendar-cell'
                    if (dayType.type === 'holiday') className += ' calendar-holiday'
                    else if (dayType.type === 'weekend') className += ' calendar-weekend'
                    if (isSelected) className += ' calendar-selected'
                    if (isToday) className += ' calendar-today'

                    return (
                      <button key={dateStr} className={className} onClick={() => setSelectedDate(dateStr)}>
                        <div className="cell-top">
                          <div className="row gap-8 align-center">
                            <span className="date-number">{date.getDate()}</span>
                            {isToday ? <span className="today-tag">今天</span> : null}
                          </div>
                        </div>
                        <div className="cell-bottom">
                          <div className="daytype-text">{dayType.label}</div>
                          <div className={`status-badge ${statusMap[status].className}`}>{statusMap[status].shortLabel}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </section>

          <aside className="side-stack">
            <section className="card">
              <div className="row between wrap gap-12">
                <div>
                  <h2>状态编辑</h2>
                  <p className="subtle">{selectedDate} · {selectedDayType.label}</p>
                </div>
                <div className="pill">可手动改单人状态</div>
              </div>

              <div className="editor-stack">
                {members.map((member) => {
                  const current = selectedStatuses[member]
                  const isActive = selectedMember === member
                  return (
                    <div key={member} className={`member-card ${isActive ? 'member-card-active' : ''}`}>
                      <div className="row between gap-12">
                        <button className={`member-name ${isActive ? 'member-name-active' : ''}`} onClick={() => setSelectedMember(member)}>
                          {member}
                        </button>
                        <div className={`status-badge ${statusMap[current].className}`}>{statusMap[current].label}</div>
                      </div>

                      <div className="status-grid">
                        {statusOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => updateMemberStatus(member, option.value)}
                            className={`status-option ${option.className} ${current === option.value ? 'status-option-active' : ''}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="card">
              <h2>半天状态展示说明</h2>
              <div className="notes">
                <p>• HO 上午：显示为「HO上」</p>
                <p>• HO 下午：显示为「HO下」</p>
                <p>• 休假上午：显示为「休上」</p>
                <p>• 休假下午：显示为「休下」</p>
                <p>• 日历格中直接显示状态文字，比小圆点更容易看清。</p>
                <p>• 当前版本已接 Supabase，跨设备可共享修改结果。</p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
