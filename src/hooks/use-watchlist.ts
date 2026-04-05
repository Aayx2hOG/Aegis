'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import idl from '@/../anchor/target/idl/basic.json'; // generated after anchor build

import { useTransactionToast } from '@/components/use-transaction-toast';
import { toast } from 'sonner';

const PROGRAM_ID = new PublicKey('GShanJRUVq5ANTvdVcy76Zd8KT2qdv7ggh1Aw5BhNsEm');

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
  const transactionToast = useTransactionToast();
  const pda = wallet.publicKey ? getWatchlistPda(wallet.publicKey) : null;

  const { data: watchlist, isLoading, error: queryError } = useQuery<string[]>({
    queryKey: ['watchlist', wallet.publicKey?.toBase58()],
    queryFn: async () => {
      if (!program || !pda) return [];
      const account = await (program.account as any).watchlist.fetch(pda);
      return account.slugs as string[];
    },
    enabled: !!program && !!pda,
    staleTime: 10_000,
    retry: false, // Don't retry if account not found
  });

  const accountNotFound = !!queryError && queryError.message.includes('Account does not exist');

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['watchlist', wallet.publicKey?.toBase58()] });

  // Initialize the on-chain account (call once per wallet)
  const initialize = useMutation({
    mutationFn: async () => {
      if (!program || !wallet.publicKey) throw new Error('Wallet not connected');
      return (program.methods as any)
        .initialize()
        .accounts({ authority: wallet.publicKey })
        .rpc();
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      invalidate();
    },
    onError: (err) => {
      console.error('Initialize failed:', err);
      toast.error(`Initialization failed: ${err.message}`);
    }
  });

  const add = useMutation({
    mutationFn: async (slug: string) => {
      if (!program || !wallet.publicKey) throw new Error('Wallet not connected');
      console.log('Adding protocol to watchlist:', slug);
      return (program.methods as any)
        .addProtocol(slug)
        .accounts({ authority: wallet.publicKey })
        .rpc();
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      invalidate();
    },
    onError: (err) => {
      console.error('Add failed:', err);
      toast.error(`Failed to add: ${err.message}`);
    }
  });

  const remove = useMutation({
    mutationFn: async (slug: string) => {
      if (!program || !wallet.publicKey) throw new Error('Wallet not connected');
      console.log('Removing protocol from watchlist:', slug);
      return (program.methods as any)
        .removeProtocol(slug)
        .accounts({ authority: wallet.publicKey })
        .rpc();
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      invalidate();
    },
    onError: (err) => {
      console.error('Remove failed:', err);
      toast.error(`Failed to remove: ${err.message}`);
    }
  });

  return {
    watchlist: watchlist ?? [],
    isLoading,
    isConnected: !!wallet.publicKey,
    isWatched: (slug: string) => (watchlist ?? []).includes(slug),
    initialize: () => initialize.mutate(),
    isInitializing: initialize.isPending,
    add: (slug: string) => add.mutate(slug),
    remove: (slug: string) => remove.mutate(slug),
    toggle: (slug: string) =>
      (watchlist ?? []).includes(slug) ? remove.mutate(slug) : add.mutate(slug),
    needsInit: !!wallet.publicKey && accountNotFound,
  };
}