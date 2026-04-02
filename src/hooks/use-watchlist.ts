'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import idl from '@/../anchor/target/idl/basic.json'; // generated after anchor build

const PROGRAM_ID = new PublicKey('JAVuBXeBZqXNtS73azhBDAoYaaAFfo4gWXoZe2e7Jf8H');

function useProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();
  if (!wallet.publicKey || !wallet.signTransaction) return null;

  const provider = new AnchorProvider(connection, wallet as never, {
    commitment: 'confirmed',
  });
  return new Program(idl as Idl, provider);
}

function getWatchlistPda(walletPubkey: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('watchlist'), walletPubkey.toBuffer()],
    PROGRAM_ID
  )[0];
}

export function useWatchlist() {
  const wallet = useWallet();
  const program = useProgram();
  const qc = useQueryClient();
  const pda = wallet.publicKey ? getWatchlistPda(wallet.publicKey) : null;

  // Fetch on-chain watchlist
  const { data: watchlist = [], isLoading } = useQuery<string[]>({
    queryKey: ['watchlist', wallet.publicKey?.toBase58()],
    queryFn: async () => {
      if (!program || !pda) return [];
      try {
        const account = await (program.account as any).watchlist.fetch(pda);
        return account.slugs as string[];
      } catch {
        // Account doesn't exist yet — user hasn't initialized
        return [];
      }
    },
    enabled: !!program && !!pda,
    staleTime: 10_000,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['watchlist', wallet.publicKey?.toBase58()] });

  // Initialize the on-chain account (call once per wallet)
  const initialize = useMutation({
    mutationFn: async () => {
      if (!program || !wallet.publicKey) throw new Error('Wallet not connected');
      await (program.methods as any)
        .initialize()
        .accounts({ authority: wallet.publicKey })
        .rpc();
    },
    onSuccess: invalidate,
  });

  const add = useMutation({
    mutationFn: async (slug: string) => {
      if (!program || !wallet.publicKey) throw new Error('Wallet not connected');
      await (program.methods as any)
        .addProtocol(slug)
        .accounts({ authority: wallet.publicKey })
        .rpc();
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (slug: string) => {
      if (!program || !wallet.publicKey) throw new Error('Wallet not connected');
      await (program.methods as any)
        .removeProtocol(slug)
        .accounts({ authority: wallet.publicKey })
        .rpc();
    },
    onSuccess: invalidate,
  });

  return {
    watchlist,
    isLoading,
    isWatched: (slug: string) => watchlist.includes(slug),
    initialize: () => initialize.mutate(),
    add: (slug: string) => add.mutate(slug),
    remove: (slug: string) => remove.mutate(slug),
    toggle: (slug: string) =>
      watchlist.includes(slug) ? remove.mutate(slug) : add.mutate(slug),
    needsInit: watchlist.length === 0 && !isLoading,
  };
}