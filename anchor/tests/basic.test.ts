import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Basic } from '../target/types/basic';
import { expect } from '@jest/globals';

describe('Watchlist Program', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Basic as Program<Basic>;
  const authority = provider.wallet as anchor.Wallet;

  // Derive the Watchlist PDA
  const [watchlistPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('watchlist'), authority.publicKey.toBuffer()],
    program.programId
  );

  it('initializes a watchlist', async () => {
    await program.methods
      .initialize()
      .accounts({ authority: authority.publicKey })
      .rpc();

    const account = await program.account.watchlist.fetch(watchlistPda);
    expect(account.authority.toBase58()).toBe(authority.publicKey.toBase58());
    expect(account.slugs).toHaveLength(0);
  });

  it('adds a protocol', async () => {
    await program.methods
      .addProtocol('raydium')
      .accounts({ authority: authority.publicKey })
      .rpc();

    const account = await program.account.watchlist.fetch(watchlistPda);
    expect(account.slugs).toContain('raydium');
  });

  it('rejects duplicates', async () => {
    await expect(
      program.methods
        .addProtocol('raydium')
        .accounts({ authority: authority.publicKey })
        .rpc()
    ).rejects.toThrow(/AlreadyExists/);
  });

  it('adds a second protocol', async () => {
    await program.methods
      .addProtocol('orca')
      .accounts({ authority: authority.publicKey })
      .rpc();

    const account = await program.account.watchlist.fetch(watchlistPda);
    expect(account.slugs).toEqual(['raydium', 'orca']);
  });

  it('removes a protocol', async () => {
    await program.methods
      .removeProtocol('raydium')
      .accounts({ authority: authority.publicKey })
      .rpc();

    const account = await program.account.watchlist.fetch(watchlistPda);
    expect(account.slugs).toEqual(['orca']);
  });

  it('rejects removing non-existent protocol', async () => {
    await expect(
      program.methods
        .removeProtocol('does-not-exist')
        .accounts({ authority: authority.publicKey })
        .rpc()
    ).rejects.toThrow(/NotFound/);
  });
});