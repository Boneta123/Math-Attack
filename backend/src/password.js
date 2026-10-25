import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)
const KEY_LENGTH = 64

// Stored as `scrypt$<salt hex>$<hash hex>`, with a fresh random salt for every password.
export async function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, KEY_LENGTH)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

// A throwaway hash, so checking an unknown username costs as much as checking a real one.
let dummyHash
const getDummyHash = () => (dummyHash ??= hashPassword('not-a-real-password'))

// Compares in constant time. Pass `null` for an unknown user: it still does the work, then fails.
export async function verifyPassword(stored, password) {
  const [scheme, saltHex, hashHex] = (stored ?? (await getDummyHash())).split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length)
  return stored !== null && timingSafeEqual(actual, expected)
}
