import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAiCommand } from '../src/lib/aiCommandParser.js'

const members = ['Doris', 'Mary', 'Mark', 'Jerry', 'Helen']
const statusMap = {
  office: { label: '在公司' },
  ho: { label: 'HO' },
  'ho-am': { label: 'HO上午' },
  'ho-pm': { label: 'HO下午' },
  off: { label: '休假' },
  'off-am': { label: '休假上午' },
  'off-pm': { label: '休假下午' },
  business: { label: '出差' },
}
const options = {
  members,
  statusMap,
  baseDate: new Date('2026-03-11T00:00:00'),
  defaultYear: 2026,
}

function parse(input) {
  const out = parseAiCommand(input, options)
  assert.equal(out.ok, true, input)
  return out.operations
}

test('1. Mary下周一HO', () => {
  const ops = parse('Mary下周一HO')
  assert.deepEqual(ops, [{ member: 'Mary', dateStr: '2026-03-16', status: 'ho' }])
})

test('2. Mary和Jerry下周一HO', () => {
  const ops = parse('Mary和Jerry下周一HO')
  assert.equal(ops.length, 2)
  assert.deepEqual(new Set(ops.map((x) => x.member)), new Set(['Mary', 'Jerry']))
})

test('3. Mary & Jerry 下周一HO', () => {
  const ops = parse('Mary & Jerry 下周一HO')
  assert.equal(ops.length, 2)
})

test('4. Jerry下周三和下周五出差', () => {
  const ops = parse('Jerry下周三和下周五出差')
  assert.deepEqual(ops, [
    { member: 'Jerry', dateStr: '2026-03-18', status: 'business' },
    { member: 'Jerry', dateStr: '2026-03-20', status: 'business' },
  ])
})

test('5. Doris第一季度每周三HO', () => {
  const ops = parse('Doris第一季度每周三HO')
  assert.equal(ops.length > 10, true)
  assert.equal(ops.every((x) => x.member === 'Doris' && x.status === 'ho'), true)
})

test('6. Doris4月和6月每周三HO', () => {
  const ops = parse('Doris4月和6月每周三HO')
  assert.equal(ops.length, 9)
  assert.equal(ops[0].dateStr, '2026-04-01')
  assert.equal(ops.at(-1).dateStr, '2026-06-24')
})

test('7. Mary下周一HO，Jerry下周三和下周五出差', () => {
  const ops = parse('Mary下周一HO，Jerry下周三和下周五出差')
  assert.equal(ops.length, 3)
})

test('8. 三月九号Mary HO', () => {
  const ops = parse('三月九号Mary HO')
  assert.deepEqual(ops, [{ member: 'Mary', dateStr: '2026-03-09', status: 'ho' }])
})

test('9. Mary 3.9 HO', () => {
  const ops = parse('Mary 3.9 HO')
  assert.deepEqual(ops, [{ member: 'Mary', dateStr: '2026-03-09', status: 'ho' }])
})

test('10. Mary 0309 HO', () => {
  const ops = parse('Mary 0309 HO')
  assert.deepEqual(ops, [{ member: 'Mary', dateStr: '2026-03-09', status: 'ho' }])
})

test('11. Jerry明天下午HO', () => {
  const ops = parse('Jerry明天下午HO')
  assert.deepEqual(ops, [{ member: 'Jerry', dateStr: '2026-03-12', status: 'ho-pm' }])
})

test('backward compatibility: range command still expands daily', () => {
  const ops = parse('Doris从3月23号到3月25号休假')
  assert.deepEqual(ops, [
    { member: 'Doris', dateStr: '2026-03-23', status: 'off' },
    { member: 'Doris', dateStr: '2026-03-24', status: 'off' },
    { member: 'Doris', dateStr: '2026-03-25', status: 'off' },
  ])
})


test('single month recurring weekday: Doris4月每周三HO', () => {
  const ops = parse('Doris4月每周三HO')
  assert.equal(ops.length, 5)
  assert.equal(ops[0].dateStr, '2026-04-01')
  assert.equal(ops.at(-1).dateStr, '2026-04-29')
})

test('relative date respects provided baseDate', () => {
  const out = parseAiCommand('Jerry明天下午HO', {
    ...options,
    baseDate: new Date('2026-04-10T00:00:00'),
  })
  assert.equal(out.ok, true)
  assert.deepEqual(out.operations, [{ member: 'Jerry', dateStr: '2026-04-11', status: 'ho-pm' }])
})
