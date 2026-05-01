'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor';
import { PublicKey, SendTransactionError, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BasicIDL, getBasicProgramId } from '@project/anchor';
import { ClusterNetwork, useCluster } from '@/components/cluster/cluster-data-access';
import { normalizeProtocolSlug } from '@/shared/protocol/slug-resolver';

import { useTransactionToast } from '@/components/use-transaction-toast';
import { toast } from 'sonner';

// discriminator + authority + empty vec length + bump
const WATCHLIST_INITIAL_SPACE_BYTES = 8 + 32 + 4 + 1;
const TX_FEE_BUFFER_LAMPORTS = 15_000;
const GUEST_WATCHLIST_CACHE_KEY = 'watchlist-cache:guest';
const MAX_WATCHLIST_ITEMS = 20;

function getWatchlistCacheKey(walletAddress: string, clusterName: string) {
  return `watchlist-cache:${clusterName}:${walletAddress}`;
}

function getActiveWatchlistCacheKey(walletAddress: string | undefined, clusterName: string) {
  if (!walletAddress) return GUEST_WATCHLIST_CACHE_KEY;
  return getWatchlistCacheKey(walletAddress, clusterName);
}

function sanitizeWatchlist(slugs: string[]): string[] {
  const normalized = slugs.map((slug) => normalizeProtocolSlug(slug)).filter(Boolean);
  return Array.from(new Set(normalized)).slice(0, MAX_WATCHLIST_ITEMS);
}

function loadWatchlistByKey(cacheKey: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return sanitizeWatchlist(parsed.filter((v): v is string => typeof v === 'string'));
  } catch {
    return [];
  }
}

function saveWatchlistByKey(cacheKey: string, slugs: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(sanitizeWatchlist(slugs)));
  } catch {
  }
}

function saveCachedWatchlist(walletAddress: string, clusterName: string, slugs: string[]) {
  const key = getWatchlistCacheKey(walletAddress, clusterName);
  saveWatchlistByKey(key, slugs);
}

function useProgram(programId: PublicKey | null) {
  const { connection } = useConnection();
  const wallet = useWallet();
  if (!wallet.publicKey || !wallet.signTransaction || !programId) return null;

  const provider = new AnchorProvider(connection, wallet as never, {
    commitment: 'confirmed',
  });
  return new Program({ ...BasicIDL, address: programId.toBase58() } as Idl, provider);
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown error';
}

function getReadableTxError(err: unknown, clusterName: string): string {
  const message = extractErrorMessage(err);
  if (message.includes('Attempt to debit an account but found no record of a prior credit')) {
    return `Insufficient SOL on ${clusterName}. Fund this wallet on ${clusterName} and retry.`;
  }
  if (message.includes('Attempt to load a program that does not exist')) {
    return `Program is not deployed on ${clusterName}. Switch to a supported cluster or deploy this program there.`;
  }
  if (message.includes('blockhash not found')) {
    return `Network is stale on ${clusterName}. Retry in a few seconds.`;
  }
  return message;
}

function isUnreachableLocalCluster(clusterName: string): boolean {
  if (clusterName !== 'local' || typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host !== 'localhost' && host !== '127.0.0.1';
}

function getProgramIdFromEnv(value?: string): PublicKey | null {
  if (!value) return null;
  try {
    return new PublicKey(value);
  } catch {
    return null;
  }
}

function getProgramIdForCluster(clusterNetwork?: ClusterNetwork, clusterName?: string): PublicKey | null {
  const globalEnvId =
    getProgramIdFromEnv(process.env.NEXT_PUBLIC_WATCHLIST_PROGRAM_ID) ??
    getProgramIdFromEnv(process.env.NEXT_PUBLIC_PROGRAM_ID);

  const normalizedName = clusterName?.trim().toLowerCase();
  const isDevnet = clusterNetwork === ClusterNetwork.Devnet || normalizedName === 'devnet';
  const isTestnet = clusterNetwork === ClusterNetwork.Testnet || normalizedName === 'testnet';
  const isMainnet = clusterNetwork === ClusterNetwork.Mainnet || normalizedName === 'mainnet-beta';

  if (isDevnet) {
    return (
      getProgramIdFromEnv(process.env.NEXT_PUBLIC_WATCHLIST_PROGRAM_ID_DEVNET) ??
      globalEnvId ??
      getBasicProgramId('devnet')
    );
  }
  if (isTestnet) {
    return (
      getProgramIdFromEnv(process.env.NEXT_PUBLIC_WATCHLIST_PROGRAM_ID_TESTNET) ??
      globalEnvId ??
      getBasicProgramId('testnet')
    );
  }
  if (isMainnet) {
    return (
      getProgramIdFromEnv(process.env.NEXT_PUBLIC_WATCHLIST_PROGRAM_ID_MAINNET) ??
      globalEnvId ??
      new PublicKey(BasicIDL.address)
    );
  }
  return new PublicKey(BasicIDL.address);
}

async function assertProgramDeployed(connection: ReturnType<typeof useConnection>['connection'], programId: PublicKey, clusterName: string) {
  const accountInfo = await connection.getAccountInfo(programId, 'confirmed');
  if (!accountInfo || !accountInfo.executable) {
    throw new Error(`Watchlist program is not deployed on ${clusterName}.`);
  }
}

function getWatchlistPda(walletPubkey: PublicKey, programId: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('watchlist'), walletPubkey.toBuffer()],
    programId
  )[0];
}

export function useWatchlist() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { cluster } = useCluster();
  const programId = getProgramIdForCluster(cluster.network, cluster.name);
  const program = useProgram(programId);
  const qc = useQueryClient();
  const transactionToast = useTransactionToast();
  const walletAddress = wallet.publicKey?.toBase58();
  const activeCacheKey = getActiveWatchlistCacheKey(walletAddress, cluster.name);
  const pda = wallet.publicKey && programId ? getWatchlistPda(wallet.publicKey, programId) : null;

  const { data: watchlist, isLoading } = useQuery<string[]>({
    queryKey: ['watchlist', cluster.name, walletAddress ?? 'guest'],
    queryFn: async () => {
      const cached = loadWatchlistByKey(activeCacheKey);

      if (!walletAddress || !program || !pda) {
        return cached;
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const account = await (program.account as any).watchlist.fetch(pda);
        const onchain = sanitizeWatchlist((account.slugs as string[]) ?? []);

        if (onchain.length > 0 && cached.length === 0) {
          saveCachedWatchlist(walletAddress, cluster.name, onchain);
          return onchain;
        }

        return cached;
      } catch {
        // Off-chain is the default source of truth for UX; on-chain issues should not block watchlist access.
        return cached;
      }
    },
    enabled: true,
    staleTime: 10_000,
    retry: false,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['watchlist', cluster.name, walletAddress ?? 'guest'] });

  // Initialize the on-chain account (call once per wallet)
  const initialize = useMutation({
    mutationFn: async () => {
      if (!wallet.publicKey) throw new Error('Wallet not connected');
      if (!program || !programId) throw new Error('Watchlist program unavailable on this cluster');
      if (isUnreachableLocalCluster(cluster.name)) {
        throw new Error('Local validator is not reachable from this deployment. Switch cluster to devnet or testnet.');
      }

      await assertProgramDeployed(connection, programId, cluster.name);

      const balanceLamports = await connection.getBalance(wallet.publicKey, 'confirmed');
      const rentExemptLamports = await connection.getMinimumBalanceForRentExemption(
        WATCHLIST_INITIAL_SPACE_BYTES,
        'confirmed'
      );
      const minimumLamports = rentExemptLamports + TX_FEE_BUFFER_LAMPORTS;
      if (balanceLamports < minimumLamports) {
        const balanceSol = balanceLamports / LAMPORTS_PER_SOL;
        const requiredSol = minimumLamports / LAMPORTS_PER_SOL;
        throw new Error(
          `Need about ${requiredSol.toFixed(6)} SOL on ${cluster.name} for rent + fee buffer (current: ${balanceSol.toFixed(6)} SOL).`
        );
      }

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
    onError: async (err) => {
      console.error('Initialize failed:', err);

      if (err instanceof SendTransactionError) {
        try {
          // Populate detailed logs for debugging in browser devtools.
          await err.getLogs(connection);
        } catch {
          // Ignore log fetch failures and still show a readable message.
        }
      }

      toast.error(`Initialization failed: ${getReadableTxError(err, cluster.name)}`);
    }
  });

  const initializeAsync = async () => initialize.mutateAsync();

  const add = useMutation({
    mutationFn: async (slug: string) => {
      const normalizedSlug = normalizeProtocolSlug(slug);

      if (!normalizedSlug) {
        throw new Error('Protocol slug is required.');
      }

      const current = loadWatchlistByKey(activeCacheKey);
      if (current.includes(normalizedSlug)) {
        return current;
      }

      if (current.length >= MAX_WATCHLIST_ITEMS) {
        throw new Error(`Watchlist limit reached (${MAX_WATCHLIST_ITEMS} protocols). Remove one before adding another.`);
      }

      const next = [...current, normalizedSlug];
      saveWatchlistByKey(activeCacheKey, next);
      return sanitizeWatchlist(next);
    },
    onSuccess: (nextWatchlist) => {
      qc.setQueryData(['watchlist', cluster.name, walletAddress ?? 'guest'], nextWatchlist);
    },
    onError: (err) => {
      console.error('Add failed:', err);
      toast.error(`Failed to add: ${extractErrorMessage(err)}`);
    }
  });

  const addAsync = async (slug: string) => add.mutateAsync(slug);

  const remove = useMutation({
    mutationFn: async (slug: string) => {
      const normalizedSlug = normalizeProtocolSlug(slug);

      const current = loadWatchlistByKey(activeCacheKey);
      const next = current.filter((item) => item !== normalizedSlug);
      saveWatchlistByKey(activeCacheKey, next);
      return next;
    },
    onSuccess: (nextWatchlist) => {
      qc.setQueryData(['watchlist', cluster.name, walletAddress ?? 'guest'], nextWatchlist);
    },
    onError: (err) => {
      console.error('Remove failed:', err);
      toast.error(`Failed to remove: ${extractErrorMessage(err)}`);
    }
  });

  const removeAsync = async (slug: string) => remove.mutateAsync(slug);

  const initializeAndAdd = async (slug: string) => {
    await addAsync(slug);
  };

  return {
    watchlist: watchlist ?? [],
    isLoading,
    isConnected: !!wallet.publicKey,
    isWatched: (slug: string) => (watchlist ?? []).includes(normalizeProtocolSlug(slug)),
    initialize: () => initialize.mutate(),
    initializeAsync,
    initializeAndAdd,
    isInitializing: initialize.isPending,
    add: (slug: string) => add.mutate(normalizeProtocolSlug(slug)),
    addAsync,
    remove: (slug: string) => remove.mutate(normalizeProtocolSlug(slug)),
    removeAsync,
    toggle: (slug: string) => {
      const normalizedSlug = normalizeProtocolSlug(slug);
      return (watchlist ?? []).includes(normalizedSlug)
        ? remove.mutate(normalizedSlug)
        : add.mutate(normalizedSlug);
    },
    needsInit: false,
    initializeOnchain: () => initialize.mutate(),
    initializeOnchainAsync: initializeAsync,
    isOnchainInitializing: initialize.isPending,
    refresh: invalidate,
  };
}