import crypto from 'node:crypto'
import {
  buildWalletAuthMessage,
  createWalletChallenge,
  getOptionalWalletOwner,
  verifyWalletSignature,
} from '@/server/auth/wallet-auth'
import { NextRequest } from 'next/server'

function base58Encode(buffer: Buffer) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  const digits = [0]

  for (const byte of buffer) {
    let carry = byte
    for (let index = 0; index < digits.length; index++) {
      carry += digits[index] << 8
      digits[index] = carry % 58
      carry = Math.floor(carry / 58)
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = Math.floor(carry / 58)
    }
  }

  for (const byte of buffer) {
    if (byte !== 0) break
    digits.push(0)
  }

  return digits
    .reverse()
    .map((digit) => alphabet[digit])
    .join('')
}

describe('wallet auth', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalAuthSecret = process.env.AEGIS_AUTH_SECRET
  const originalNextAuthSecret = process.env.NEXTAUTH_SECRET
  const originalGroqApiKey = process.env.GROQ_API_KEY

  beforeEach(() => {
    process.env.AEGIS_AUTH_SECRET = 'test-auth-secret'
    process.env.AEGIS_REQUIRE_WALLET_AUTH = ''
  })

  afterEach(() => {
    delete process.env.AEGIS_REQUIRE_WALLET_AUTH
    process.env.NODE_ENV = originalNodeEnv
    if (originalAuthSecret == null) {
      delete process.env.AEGIS_AUTH_SECRET
    } else {
      process.env.AEGIS_AUTH_SECRET = originalAuthSecret
    }
    if (originalNextAuthSecret == null) {
      delete process.env.NEXTAUTH_SECRET
    } else {
      process.env.NEXTAUTH_SECRET = originalNextAuthSecret
    }
    if (originalGroqApiKey == null) {
      delete process.env.GROQ_API_KEY
    } else {
      process.env.GROQ_API_KEY = originalGroqApiKey
    }
  })

  it('verifies a signed challenge and returns a session token', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
    const der = publicKey.export({ format: 'der', type: 'spki' })
    const walletAddress = base58Encode(Buffer.from(der).subarray(-32))
    const challenge = createWalletChallenge(walletAddress)
    const signature = crypto.sign(null, Buffer.from(challenge.message), privateKey).toString('base64')

    const token = verifyWalletSignature({
      walletAddress,
      message: challenge.message,
      signature,
      challengeToken: challenge.token,
    })

    expect(token).toEqual(expect.any(String))
  })

  it('rejects a modified challenge message', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
    const der = publicKey.export({ format: 'der', type: 'spki' })
    const walletAddress = base58Encode(Buffer.from(der).subarray(-32))
    const challenge = createWalletChallenge(walletAddress)
    const tampered = buildWalletAuthMessage(walletAddress, 'wrong-nonce')
    const signature = crypto.sign(null, Buffer.from(tampered), privateKey).toString('base64')

    const token = verifyWalletSignature({
      walletAddress,
      message: tampered,
      signature,
      challengeToken: challenge.token,
    })

    expect(token).toBeNull()
  })

  it('does not attach an unsigned claimed wallet when auth is enforced', () => {
    process.env.AEGIS_REQUIRE_WALLET_AUTH = 'true'
    const req = new NextRequest('http://localhost/api/research')

    expect(getOptionalWalletOwner(req, 'UnsignedWallet111111111111111111111111111111')).toBeNull()
  })

  it('attaches a signed wallet session when auth is enforced', () => {
    process.env.AEGIS_REQUIRE_WALLET_AUTH = 'true'
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
    const der = publicKey.export({ format: 'der', type: 'spki' })
    const walletAddress = base58Encode(Buffer.from(der).subarray(-32))
    const challenge = createWalletChallenge(walletAddress)
    const signature = crypto.sign(null, Buffer.from(challenge.message), privateKey).toString('base64')
    const token = verifyWalletSignature({
      walletAddress,
      message: challenge.message,
      signature,
      challengeToken: challenge.token,
    })

    const req = new NextRequest('http://localhost/api/research', {
      headers: { authorization: `Bearer ${token}` },
    })

    expect(getOptionalWalletOwner(req, walletAddress)).toBe(walletAddress)
  })

  it('fails closed when the production auth secret is missing', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.AEGIS_AUTH_SECRET
    process.env.NEXTAUTH_SECRET = 'fallback-nextauth-secret'
    process.env.GROQ_API_KEY = 'fallback-groq-secret'

    expect(() => createWalletChallenge('Wallet111111111111111111111111111111111')).toThrow(
      'AEGIS_AUTH_SECRET is required in production.',
    )
  })
})
