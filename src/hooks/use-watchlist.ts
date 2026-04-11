'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor';
import { PublicKey, SendTransactionError, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BasicIDL } from '@project/anchor';
import { ClusterNetwork, useCluster } from '@/components/cluster/cluster-data-access';

import { useTransactionToast } from '@/components/use-transaction-toast';
import { toast } from 'sonner';

const MIN_INIT_BALANCE_SOL = 0.002;

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

function getProgramIdForCluster(clusterNetwork?: ClusterNetwork): PublicKey | null {
  if (clusterNetwork === ClusterNetwork.Devnet) {
    return getProgramIdFromEnv(process.env.NEXT_PUBLIC_WATCHLIST_PROGRAM_ID_DEVNET);
  }
  if (clusterNetwork === ClusterNetwork.Testnet) {
    return getProgramIdFromEnv(process.env.NEXT_PUBLIC_WATCHLIST_PROGRAM_ID_TESTNET);
  }
  if (clusterNetwork === ClusterNetwork.Mainnet) {
    return getProgramIdFromEnv(process.env.NEXT_PUBLIC_WATCHLIST_PROGRAM_ID_MAINNET);
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
  const programId = getProgramIdForCluster(cluster.network);
  const program = useProgram(programId);
  const qc = useQueryClient();
  const transactionToast = useTransactionToast();
  const walletAddress = wallet.publicKey?.toBase58();
  const pda = wallet.publicKey && programId ? getWatchlistPda(wallet.publicKey, programId) : null;

  const missingProgramConfig =
    !programId &&
    (cluster.network === ClusterNetwork.Devnet ||
      cluster.network === ClusterNetwork.Testnet ||
      cluster.network === ClusterNetwork.Mainnet);

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
    enabled: !!walletAddress && !!programId,
    staleTime: 10_000,
    retry: false, // Don't retry if account not found
  });

  const accountNotFound = extractErrorMessage(queryError).includes('Account does not exist');

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['watchlist', walletAddress, cluster.name] });

  // Initialize the on-chain account (call once per wallet)
  const initialize = useMutation({
    mutationFn: async () => {
      if (!wallet.publicKey) throw new Error('Wallet not connected');
      if (missingProgramConfig) {
        throw new Error(`Watchlist program ID is not configured for ${cluster.name}.`);
      }
      if (!program || !programId) throw new Error('Watchlist program unavailable on this cluster');
      if (isUnreachableLocalCluster(cluster.name)) {
        throw new Error('Local validator is not reachable from this deployment. Switch cluster to devnet or testnet.');
      }

      await assertProgramDeployed(connection, programId, cluster.name);

      const balanceLamports = await connection.getBalance(wallet.publicKey, 'confirmed');
      const minimumLamports = Math.ceil(MIN_INIT_BALANCE_SOL * LAMPORTS_PER_SOL);
      if (balanceLamports < minimumLamports) {
        const balanceSol = balanceLamports / LAMPORTS_PER_SOL;
        throw new Error(
          `Need at least ${MIN_INIT_BALANCE_SOL} SOL on ${cluster.name} (current: ${balanceSol.toFixed(6)} SOL).`
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

  const add = useMutation({
    mutationFn: async (slug: string) => {
      if (!wallet.publicKey) throw new Error('Wallet not connected');
      if (missingProgramConfig) {
        throw new Error(`Watchlist program ID is not configured for ${cluster.name}.`);
      }
      if (!program || !programId) throw new Error('Watchlist program unavailable on this cluster');
      if (isUnreachableLocalCluster(cluster.name)) {
        throw new Error('Local validator is not reachable from this deployment. Switch cluster to devnet or testnet.');
      }
      await assertProgramDeployed(connection, programId, cluster.name);
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
      toast.error(`Failed to add: ${getReadableTxError(err, cluster.name)}`);
    }
  });

  const remove = useMutation({
    mutationFn: async (slug: string) => {
      if (!wallet.publicKey) throw new Error('Wallet not connected');
      if (missingProgramConfig) {
        throw new Error(`Watchlist program ID is not configured for ${cluster.name}.`);
      }
      if (!program || !programId) throw new Error('Watchlist program unavailable on this cluster');
      if (isUnreachableLocalCluster(cluster.name)) {
        throw new Error('Local validator is not reachable from this deployment. Switch cluster to devnet or testnet.');
      }
      await assertProgramDeployed(connection, programId, cluster.name);
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
      toast.error(`Failed to remove: ${getReadableTxError(err, cluster.name)}`);
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