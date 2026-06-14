import crypto from 'node:crypto'
import {
  buildWalletAuthMessage,
  createWalletChallenge,
  verifyWalletSignature,
} from '@/server/auth/wallet-auth'

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
  beforeEach(() => {
    process.env.AEGIS_AUTH_SECRET = 'test-auth-secret'
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
})
