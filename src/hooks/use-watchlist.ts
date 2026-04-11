'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { BasicIDL } from '@project/anchor';
import { useCluster } from '@/components/cluster/cluster-data-access';

import { useTransactionToast } from '@/components/use-transaction-toast';
import { toast } from 'sonner';

const PROGRAM_ID = new PublicKey(BasicIDL.address);

function getWatchlistCacheKey(walletAddress: string, clusterName: string) {
  return `watchlist-cache:${clusterName}:${walletAddress}`;
}

function loadCachedWatchlist(walletAddress?: string, clusterName?: string): string[] {
  if (!walletAddress || !clusterName || typeof window === 'undefined') return [];
  try {
    const key = getWatchlistCacheKey(walletAddress, clusterName);
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function saveCachedWatchlist(walletAddress: string, clusterName: string, slugs: string[]) {
  if (typeof window === 'undefined') return;
  try {
    const key = getWatchlistCacheKey(walletAddress, clusterName);
    window.localStorage.setItem(key, JSON.stringify(slugs));
  } catch {
    // Ignore storage errors (quota/private mode) and keep app functional.
  }
}

function useProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();
  if (!wallet.publicKey || !wallet.signTransaction) return null;

  const provider = new AnchorProvider(connection, wallet as never, {
    commitment: 'confirmed',
  });
  return new Program(BasicIDL as Idl, provider);
}

function getWatchlistPda(walletPubkey: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('watchlist'), walletPubkey.toBuffer()],
    PROGRAM_ID
  )[0];
}

export function useWatchlist() {
  const wallet = useWallet();
  const { cluster } = useCluster();
  const program = useProgram();
  const qc = useQueryClient();
  const transactionToast = useTransactionToast();
  const walletAddress = wallet.publicKey?.toBase58();
  const pda = wallet.publicKey ? getWatchlistPda(wallet.publicKey) : null;

  const { data: watchlist, isLoading, error: queryError } = useQuery<string[]>({
    queryKey: ['watchlist', walletAddress, cluster.name],
    queryFn: async () => {
      const cached = loadCachedWatchlist(walletAddress, cluster.name);
      if (!program || !pda || !walletAddress) return cached;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const account = await (program.account as any).watchlist.fetch(pda);
        const onchain = (account.slugs as string[]) ?? [];
        saveCachedWatchlist(walletAddress, cluster.name, onchain);
        return onchain;
      } catch (err) {
        // If on-chain fetch fails (RPC down or local validator reset), keep UX stable via cached snapshot.
        if (cached.length > 0) return cached;
        throw err;
      }
    },
    enabled: !!walletAddress,
    staleTime: 10_000,
    retry: false, // Don't retry if account not found
  });

  const accountNotFound = !!queryError && queryError.message.includes('Account does not exist');

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['watchlist', walletAddress, cluster.name] });

  // Initialize the on-chain account (call once per wallet)
  const initialize = useMutation({
    mutationFn: async () => {
      if (!program || !wallet.publicKey) throw new Error('Wallet not connected');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (program.methods as any)
        .initialize()
        .accounts({ authority: wallet.publicKey })
        .rpc();
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      invalidate();
      if (walletAddress) saveCachedWatchlist(walletAddress, cluster.name, []);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (program.methods as any)
        .addProtocol(slug)
        .accounts({ authority: wallet.publicKey })
        .rpc();
    },
    onSuccess: (signature, slug) => {
      transactionToast(signature);
      if (walletAddress) {
        const next = Array.from(new Set([...(watchlist ?? []), slug]));
        saveCachedWatchlist(walletAddress, cluster.name, next);
      }
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (program.methods as any)
        .removeProtocol(slug)
        .accounts({ authority: wallet.publicKey })
        .rpc();
    },
    onSuccess: (signature, slug) => {
      transactionToast(signature);
      if (walletAddress) {
        const next = (watchlist ?? []).filter((item) => item !== slug);
        saveCachedWatchlist(walletAddress, cluster.name, next);
      }
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