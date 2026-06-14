import crypto from 'node:crypto'
import { NextRequest } from 'next/server'

const SESSION_COOKIE = 'aegis_wallet_session'
const CHALLENGE_TTL_MS = 5 * 60 * 1000
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

type TokenPayload = {
  walletAddress: string
  nonce?: string
  issuedAt: number
  expiresAt: number
  kind: 'challenge' | 'session'
}

export type AuthResult =
  | { ok: true; walletAddress: string; enforced: boolean }
  | { ok: false; response: Response; enforced: boolean }

function authSecret() {
  return process.env.AEGIS_AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.GROQ_API_KEY || 'aegis-dev-secret'
}

export function isWalletAuthEnforced() {
  return process.env.AEGIS_REQUIRE_WALLET_AUTH === 'true' || process.env.NODE_ENV === 'production'
}

function base64UrlEncode(input: Buffer | string) {
  return Buffer.from(input).toString('base64url')
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, 'base64url')
}

function signPayload(encodedPayload: string) {
  return crypto.createHmac('sha256', authSecret()).update(encodedPayload).digest('base64url')
}

function createToken(payload: TokenPayload) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  return `${encodedPayload}.${signPayload(encodedPayload)}`
}

function parseToken(token: string, kind: TokenPayload['kind']): TokenPayload | null {
  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) return null

  const expected = signPayload(encodedPayload)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8')) as TokenPayload
    if (payload.kind !== kind || Date.now() > payload.expiresAt) return null
    return payload
  } catch {
    return null
  }
}

function parseCookies(header: string | null) {
  const cookies = new Map<string, string>()
  if (!header) return cookies

  for (const part of header.split(';')) {
    const [rawKey, ...rawValue] = part.trim().split('=')
    if (!rawKey) continue
    cookies.set(rawKey, decodeURIComponent(rawValue.join('=')))
  }

  return cookies
}

function base58Decode(value: string) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  const bytes = [0]

  for (const char of value) {
    const carryStart = alphabet.indexOf(char)
    if (carryStart < 0) throw new Error('Invalid base58 value')
    let carry = carryStart

    for (let index = 0; index < bytes.length; index++) {
      carry += bytes[index] * 58
      bytes[index] = carry & 0xff
      carry >>= 8
    }

    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }

  for (const char of value) {
    if (char !== '1') break
    bytes.push(0)
  }

  return Buffer.from(bytes.reverse())
}

function decodeSignature(signature: string | number[]) {
  if (Array.isArray(signature)) return Buffer.from(signature)
  try {
    return Buffer.from(signature, 'base64')
  } catch {
    return base58Decode(signature)
  }
}

export function buildWalletAuthMessage(walletAddress: string, nonce: string) {
  return [
    'Aegis wallet authentication',
    '',
    `Wallet: ${walletAddress}`,
    `Nonce: ${nonce}`,
    '',
    'Sign this message to prove wallet ownership. This does not authorize a transaction.',
  ].join('\n')
}

export function createWalletChallenge(walletAddress: string) {
  const nonce = crypto.randomBytes(16).toString('hex')
  const now = Date.now()
  const token = createToken({
    walletAddress,
    nonce,
    issuedAt: now,
    expiresAt: now + CHALLENGE_TTL_MS,
    kind: 'challenge',
  })

  return {
    walletAddress,
    nonce,
    message: buildWalletAuthMessage(walletAddress, nonce),
    token,
    expiresAt: new Date(now + CHALLENGE_TTL_MS).toISOString(),
  }
}

export function verifyWalletSignature(input: {
  walletAddress: string
  message: string
  signature: string | number[]
  challengeToken: string
}) {
  const challenge = parseToken(input.challengeToken, 'challenge')
  if (!challenge || challenge.walletAddress !== input.walletAddress || !challenge.nonce) return null

  const expectedMessage = buildWalletAuthMessage(challenge.walletAddress, challenge.nonce)
  if (input.message !== expectedMessage) return null

  const publicKey = base58Decode(input.walletAddress)
  if (publicKey.length !== 32) return null

  const keyObject = crypto.createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, publicKey]),
    format: 'der',
    type: 'spki',
  })

  const valid = crypto.verify(null, Buffer.from(input.message), keyObject, decodeSignature(input.signature))
  if (!valid) return null

  const now = Date.now()
  return createToken({
    walletAddress: input.walletAddress,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
    kind: 'session',
  })
}

export function getSessionCookieHeader(sessionToken: string) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000)
  return `${SESSION_COOKIE}=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Secure`
}

export function getAuthenticatedWallet(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const bearer = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : null
  const cookieToken = parseCookies(req.headers.get('cookie')).get(SESSION_COOKIE)
  const payload = parseToken(bearer || cookieToken || '', 'session')
  return payload?.walletAddress ?? null
}

export function requireWalletOwner(req: NextRequest, claimedWalletAddress?: string | null): AuthResult {
  const claimed = claimedWalletAddress?.trim()
  const enforced = isWalletAuthEnforced()
  const authenticated = getAuthenticatedWallet(req)

  if (!claimed) {
    return { ok: false, enforced, response: Response.json({ error: 'walletAddress is required' }, { status: 400 }) }
  }

  if (!enforced) {
    return { ok: true, walletAddress: claimed, enforced }
  }

  if (!authenticated || authenticated !== claimed) {
    return {
      ok: false,
      enforced,
      response: Response.json({ error: 'Wallet authentication required' }, { status: 401 }),
    }
  }

  return { ok: true, walletAddress: authenticated, enforced }
}
