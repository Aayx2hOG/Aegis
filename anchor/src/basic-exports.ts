// Here we export some useful types and functions for interacting with the Anchor program.
import { AnchorProvider, Program, type Idl } from '@coral-xyz/anchor'
import { Cluster, PublicKey } from '@solana/web3.js'

export type Basic = Idl & { address: string }

// Keep a source-controlled IDL snapshot so web builds do not depend on anchor/target artifacts.
export const BasicIDL: Basic = {
  address: 'GShanJRUVq5ANTvdVcy76Zd8KT2qdv7ggh1Aw5BhNsEm',
  metadata: {
    name: 'basic',
    version: '0.1.0',
    spec: '0.1.0',
    description: 'Created with Anchor',
  },
  instructions: [
    {
      name: 'add_protocol',
      docs: ["Adds a protocol slug to the caller's watchlist."],
      discriminator: [149, 0, 150, 1, 226, 204, 111, 61],
      accounts: [
        {
          name: 'watchlist',
          writable: true,
          pda: {
            seeds: [
              { kind: 'const', value: [119, 97, 116, 99, 104, 108, 105, 115, 116] },
              { kind: 'account', path: 'authority' },
            ],
          },
        },
        { name: 'authority', writable: true, signer: true, relations: ['watchlist'] },
        { name: 'system_program', address: '11111111111111111111111111111111' },
      ],
      args: [{ name: 'slug', type: 'string' }],
    },
    {
      name: 'initialize',
      docs: [
        "Creates a new Watchlist PDA for the caller's wallet.",
        'Must be called once before add/remove.',
      ],
      discriminator: [175, 175, 109, 31, 13, 152, 155, 237],
      accounts: [
        {
          name: 'watchlist',
          writable: true,
          pda: {
            seeds: [
              { kind: 'const', value: [119, 97, 116, 99, 104, 108, 105, 115, 116] },
              { kind: 'account', path: 'authority' },
            ],
          },
        },
        { name: 'authority', writable: true, signer: true },
        { name: 'system_program', address: '11111111111111111111111111111111' },
      ],
      args: [],
    },
    {
      name: 'remove_protocol',
      docs: ["Removes a protocol slug from the caller's watchlist."],
      discriminator: [16, 253, 112, 127, 145, 124, 14, 8],
      accounts: [
        {
          name: 'watchlist',
          writable: true,
          pda: {
            seeds: [
              { kind: 'const', value: [119, 97, 116, 99, 104, 108, 105, 115, 116] },
              { kind: 'account', path: 'authority' },
            ],
          },
        },
        { name: 'authority', writable: true, signer: true, relations: ['watchlist'] },
        { name: 'system_program', address: '11111111111111111111111111111111' },
      ],
      args: [{ name: 'slug', type: 'string' }],
    },
  ],
  accounts: [{ name: 'Watchlist', discriminator: [61, 163, 110, 167, 150, 97, 226, 95] }],
  errors: [
    { code: 6000, name: 'SlugTooLong', msg: 'Slug exceeds 32 characters' },
    { code: 6001, name: 'AlreadyExists', msg: 'Protocol already in watchlist' },
    { code: 6002, name: 'WatchlistFull', msg: 'Watchlist is full (max 20 protocols)' },
    { code: 6003, name: 'NotFound', msg: 'Protocol not found in watchlist' },
  ],
  types: [
    {
      name: 'Watchlist',
      type: {
        kind: 'struct',
        fields: [
          { name: 'authority', type: 'pubkey' },
          { name: 'slugs', type: { vec: 'string' } },
          { name: 'bump', type: 'u8' },
        ],
      },
    },
  ],
}

// The programId is imported from the program IDL.
export const BASIC_PROGRAM_ID = new PublicKey(BasicIDL.address)

// This is a helper function to get the Basic Anchor program.
export function getBasicProgram(provider: AnchorProvider, address?: PublicKey): Program<Basic> {
  return new Program({ ...BasicIDL, address: address ? address.toBase58() : BasicIDL.address } as Basic, provider)
}

// This is a helper function to get the program ID for the Basic program depending on the cluster.
export function getBasicProgramId(cluster: Cluster) {
  switch (cluster) {
    case 'devnet':
    case 'testnet':
      // This is the program ID for the Basic program on devnet and testnet.
      return new PublicKey('6z68wfurCMYkZG51s1Et9BJEd9nJGUusjHXNt4dGbNNF')
    case 'mainnet-beta':
    default:
      return BASIC_PROGRAM_ID
  }
}
