import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createApp } from '../src/app.js'

// A chainable stand-in for the Supabase query builder: every method returns itself, and awaiting it
// (or calling single/maybeSingle) yields the canned result.
const query = (result) => {
  const q = {
    select: () => q,
    insert: () => q,
    order: () => q,
    limit: () => q,
    eq: () => q,
    ilike: () => q,
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  }
  return q
}

let results = {}
const calls = []
const fake = {
  from: (table) => {
    calls.push(['from', table])
    return query(results[table] ?? { data: [], error: null })
  },
  rpc: (fn, args) => {
    calls.push(['rpc', fn, args])
    return Promise.resolve(results[fn] ?? { data: true, error: null })
  },
}

let server
let base
before(async () => {
  server = createApp(fake).listen(0)
  base = `http://localhost:${server.address().port}`
})
after(() => server.close())

const post = (path, body) =>
  fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

test('creates a player and maps a duplicate to 409', async () => {
  results = { players: { data: { username: 'Alice' }, error: null } }
  const ok = await post('/api/players', { username: 'Alice' })
  assert.equal(ok.status, 201)
  assert.deepEqual(await ok.json(), { username: 'Alice' })

  results = { players: { data: null, error: { code: '23505' } } }
  assert.equal((await post('/api/players', { username: 'Alice' })).status, 409)
})

test('rejects invalid usernames', async () => {
  for (const username of ['ab', 'has space', 'x'.repeat(17), 'semi;colon', 5, undefined]) {
    assert.equal((await post('/api/players', { username })).status, 400, String(username))
  }
})

test('score and leaderboard posts validate input and call the matching function', async () => {
  results = {}
  calls.length = 0
  const ok = await post('/api/scores/addition', { username: 'Alice', score: 120 })
  assert.equal(ok.status, 200)
  assert.deepEqual(await ok.json(), { accepted: true })
  assert.deepEqual(calls.at(-1), ['rpc', 'submit_score', { p_mode: 'addition', p_username: 'Alice', p_score: 120 }])

  await post('/api/leaderboard/mixed', { username: 'Alice', score: 120 })
  assert.equal(calls.at(-1)[1], 'submit_leaderboard')

  for (const [path, body] of [
    ['/api/scores/nope', { username: 'Alice', score: 5 }],
    ['/api/scores/addition', { username: 'Alice', score: 0 }],
    ['/api/scores/addition', { username: 'Alice', score: 1.5 }],
    ['/api/scores/addition', { username: 'Alice', score: '9' }],
    ['/api/scores/addition', { username: 'Alice', score: 1_000_001 }],
    ['/api/scores/addition', { username: 'a', score: 5 }],
    ['/api/leaderboard/addition', {}],
  ]) {
    assert.equal((await post(path, body)).status, 400, path + JSON.stringify(body))
  }
})

test('maps database errors from the score functions', async () => {
  results = { submit_score: { data: null, error: { code: 'P0002' } } }
  assert.equal((await post('/api/scores/addition', { username: 'Ghost', score: 5 })).status, 404)
  results = { submit_leaderboard: { data: null, error: { code: '22023' } } }
  assert.equal((await post('/api/leaderboard/addition', { username: 'Alice', score: 5 })).status, 400)
  results = { submit_score: { data: null, error: { code: 'XX000', message: 'secret' } } }
  const res = await post('/api/scores/addition', { username: 'Alice', score: 5 })
  assert.equal(res.status, 500)
  assert.deepEqual(await res.json(), { error: 'Server error' })
})

test('returns the leaderboard and a player\'s scores as username/score rows', async () => {
  results = { leaderboard_challenge: { data: [{ score: 9, players: { username: 'Bob' } }], error: null } }
  const board = await fetch(`${base}/api/leaderboard/challenge`)
  assert.deepEqual(await board.json(), [{ username: 'Bob', score: 9 }])

  results = {
    players: { data: { id: 'p1' }, error: null },
    scores_mixed: { data: [{ score: 7, players: { username: 'Bob' } }], error: null },
  }
  const mine = await fetch(`${base}/api/scores/mixed/Bob`)
  assert.deepEqual(await mine.json(), [{ username: 'Bob', score: 7 }])

  results = { players: { data: null, error: null } }
  assert.equal((await fetch(`${base}/api/scores/mixed/Nobody`)).status, 404)
  assert.equal((await fetch(`${base}/api/leaderboard/bogus`)).status, 400)
})

test('health reports whether the database answers', async () => {
  results = { players: { data: [], error: null } }
  const up = await fetch(`${base}/api/health`)
  assert.equal(up.status, 200)
  assert.deepEqual(await up.json(), { ok: true })

  results = { players: { data: null, error: { code: 'XX000' } } }
  const down = await fetch(`${base}/api/health`)
  assert.equal(down.status, 503)
  assert.deepEqual(await down.json(), { ok: false })
})

test('exposes only the intended routes', async () => {
  assert.equal((await fetch(`${base}/api/scores/addition`)).status, 404)
  assert.equal((await fetch(`${base}/api/leaderboard/addition`, { method: 'DELETE' })).status, 404)
  assert.equal((await fetch(`${base}/api/players`)).status, 404)
})
