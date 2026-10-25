import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createApp } from '../src/app.js'
import { hashPassword } from '../src/password.js'

// A chainable stand-in for the Supabase query builder: every method returns itself, and awaiting it
// (or calling single/maybeSingle) yields the canned result.
const query = (result) => {
  const q = {
    select: () => q,
    insert: (row) => {
      inserted = row
      return q
    },
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
let inserted
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
let storedHash
before(async () => {
  server = createApp(fake).listen(0)
  base = `http://localhost:${server.address().port}`
  storedHash = await hashPassword('correct:horse')
})
after(() => server.close())

const post = (path, body, headers = {}) =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
const basic = (username, password) => ({
  authorization: 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
})
// The player Alice exists with the password `correct:horse` (note the colon).
const aliceExists = () => {
  results = { players: { data: { username: 'Alice', password_hash: storedHash }, error: null } }
}

test('signs up with a hashed password and maps a duplicate to 409', async () => {
  results = { players: { data: { username: 'Alice' }, error: null } }
  const ok = await post('/api/players', { username: 'Alice', password: 'longenough' })
  assert.equal(ok.status, 201)
  assert.deepEqual(await ok.json(), { username: 'Alice' })
  assert.match(inserted.password_hash, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/)
  assert.notEqual(inserted.password_hash, 'longenough')

  results = { players: { data: null, error: { code: '23505' } } }
  assert.equal((await post('/api/players', { username: 'Alice', password: 'longenough' })).status, 409)
})

test('rejects invalid usernames and passwords on sign up', async () => {
  for (const username of ['ab', 'has space', 'x'.repeat(17), 'semi;colon', 5, undefined]) {
    assert.equal((await post('/api/players', { username, password: 'longenough' })).status, 400, String(username))
  }
  for (const password of ['short', 'x'.repeat(73), 12345678, undefined]) {
    const res = await post('/api/players', { username: 'Alice', password })
    assert.equal(res.status, 400, String(password))
    assert.deepEqual(await res.json(), { error: 'Password must be 8-72 characters' })
  }
})

test('logs in with the right password, including one with a colon', async () => {
  aliceExists()
  const res = await post('/api/login', { username: 'alice', password: 'correct:horse' })
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { username: 'Alice' })
})

test('a wrong password and an unknown user get the same 401', async () => {
  aliceExists()
  const wrong = await post('/api/login', { username: 'Alice', password: 'wrong-password' })
  results = { players: { data: null, error: null } }
  const unknown = await post('/api/login', { username: 'Nobody', password: 'wrong-password' })
  assert.equal(wrong.status, 401)
  assert.equal(unknown.status, 401)
  assert.deepEqual(await wrong.json(), { error: 'Invalid username or password' })
  assert.deepEqual(await unknown.json(), { error: 'Invalid username or password' })
  assert.equal((await post('/api/login', { username: 'Alice' })).status, 401)
})

test('score and leaderboard posts need valid Basic auth and use the authenticated name', async () => {
  aliceExists()
  calls.length = 0
  // A username in the body must be ignored in favor of the one the header proves.
  const ok = await post('/api/scores/addition', { username: 'Mallory', score: 120 }, basic('Alice', 'correct:horse'))
  assert.equal(ok.status, 200)
  assert.deepEqual(await ok.json(), { accepted: true })
  assert.deepEqual(calls.at(-1), ['rpc', 'submit_score', { p_mode: 'addition', p_username: 'Alice', p_score: 120 }])

  await post('/api/leaderboard/mixed', { score: 120 }, basic('Alice', 'correct:horse'))
  assert.equal(calls.at(-1)[1], 'submit_leaderboard')

  for (const headers of [
    {},
    { authorization: 'Bearer abc' },
    { authorization: 'Basic' },
    { authorization: 'Basic !!!not-base64' },
    { authorization: 'Basic ' + Buffer.from('no-colon-here').toString('base64') },
    basic('Alice', 'wrong-password'),
    basic('Alice', ''),
  ]) {
    calls.length = 0
    const res = await post('/api/scores/addition', { score: 5 }, headers)
    assert.equal(res.status, 401, JSON.stringify(headers))
    assert.equal(calls.filter((c) => c[0] === 'rpc').length, 0)
  }
})

test('score posts validate mode and score', async () => {
  aliceExists()
  for (const [path, body] of [
    ['/api/scores/nope', { score: 5 }],
    ['/api/scores/addition', { score: 0 }],
    ['/api/scores/addition', { score: 1.5 }],
    ['/api/scores/addition', { score: '9' }],
    ['/api/scores/addition', { score: 1_000_001 }],
    ['/api/leaderboard/addition', {}],
  ]) {
    assert.equal((await post(path, body, basic('Alice', 'correct:horse'))).status, 400, path + JSON.stringify(body))
  }
})

test('maps database errors from the score functions', async () => {
  aliceExists()
  results.submit_score = { data: null, error: { code: 'P0002' } }
  assert.equal((await post('/api/scores/addition', { score: 5 }, basic('Alice', 'correct:horse'))).status, 404)
  results.submit_leaderboard = { data: null, error: { code: '22023' } }
  assert.equal((await post('/api/leaderboard/addition', { score: 5 }, basic('Alice', 'correct:horse'))).status, 400)
  results.submit_score = { data: null, error: { code: 'XX000', message: 'secret' } }
  const res = await post('/api/scores/addition', { score: 5 }, basic('Alice', 'correct:horse'))
  assert.equal(res.status, 500)
  assert.deepEqual(await res.json(), { error: 'Server error' })
})

test('a database failure while checking a password is a 500, not a login success', async () => {
  results = { players: { data: null, error: { code: 'XX000' } } }
  const res = await post('/api/login', { username: 'Alice', password: 'correct:horse' })
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

test('no response ever contains the password hash', async () => {
  const bodies = []
  aliceExists()
  bodies.push(await (await post('/api/login', { username: 'Alice', password: 'correct:horse' })).text())
  bodies.push(await (await post('/api/login', { username: 'Alice', password: 'nope-nope-nope' })).text())
  bodies.push(await (await post('/api/scores/addition', { score: 5 }, basic('Alice', 'correct:horse'))).text())
  results = { players: { data: { username: 'Alice', password_hash: storedHash }, error: null } }
  bodies.push(await (await post('/api/players', { username: 'Alice', password: 'longenough' })).text())
  for (const body of bodies) {
    assert.ok(!body.includes('scrypt'), body)
    assert.ok(!body.includes('password_hash'), body)
  }
})

test('malformed JSON is a 400', async () => {
  const res = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not json',
  })
  assert.equal(res.status, 400)
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
  assert.equal((await fetch(`${base}/api/login`)).status, 404)
})
