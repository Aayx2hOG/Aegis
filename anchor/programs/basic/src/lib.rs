#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;

declare_id!("GShanJRUVq5ANTvdVcy76Zd8KT2qdv7ggh1Aw5BhNsEm");

// Max slugs per watchlist (keeps account size bounded)
const MAX_PROTOCOLS: usize = 20;
// Max bytes per slug (e.g. "raydium-amm-v4" = 14 chars, give headroom)
const MAX_SLUG_LEN: usize = 32;
const DISCRIMINATOR_BYTES: usize = 8;
const PUBKEY_BYTES: usize = 32;
const VEC_LEN_BYTES: usize = 4;
const STRING_LEN_PREFIX_BYTES: usize = 4;
const BUMP_BYTES: usize = 1;

#[program]
pub mod basic {
    use super::*;

    /// Creates a new Watchlist PDA for the caller's wallet.
    /// Must be called once before add/remove.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let watchlist = &mut ctx.accounts.watchlist;
        watchlist.authority = ctx.accounts.authority.key();
        watchlist.slugs = Vec::new();
        watchlist.bump = ctx.bumps.watchlist;
        msg!("Watchlist initialized for {}", watchlist.authority);
        Ok(())
    }

    /// Adds a protocol slug to the caller's watchlist.
    pub fn add_protocol(ctx: Context<AddProtocol>, slug: String) -> Result<()> {
        require!(slug.len() <= MAX_SLUG_LEN, WatchlistError::SlugTooLong);

        let watchlist = &mut ctx.accounts.watchlist;
        require!(
            !watchlist.slugs.contains(&slug),
            WatchlistError::AlreadyExists
        );
        require!(
            watchlist.slugs.len() < MAX_PROTOCOLS,
            WatchlistError::WatchlistFull
        );

        watchlist.slugs.push(slug.clone());
        msg!("Added {} to watchlist", slug);
        Ok(())
    }

    /// Removes a protocol slug from the caller's watchlist.
    pub fn remove_protocol(ctx: Context<RemoveProtocol>, slug: String) -> Result<()> {
        let watchlist = &mut ctx.accounts.watchlist;
        let before = watchlist.slugs.len();
        watchlist.slugs.retain(|s| s != &slug);
        require!(watchlist.slugs.len() < before, WatchlistError::NotFound);
        msg!("Removed {} from watchlist", slug);
        Ok(())
    }
}

// Accounts

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        // Start with only fixed fields + empty vec header; grow lazily on add_protocol.
        space = Watchlist::initial_space(),
        seeds = [b"watchlist", authority.key().as_ref()],
        bump
    )]
    pub watchlist: Account<'info, Watchlist>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(slug: String)]
pub struct AddProtocol<'info> {
    #[account(
        mut,
        seeds = [b"watchlist", authority.key().as_ref()],
        bump = watchlist.bump,
        has_one = authority,  // ensures only owner can modify
        realloc = Watchlist::space_after_add(&watchlist.slugs, &slug),
        realloc::payer = authority,
        realloc::zero = false,
    )]
    pub watchlist: Account<'info, Watchlist>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RemoveProtocol<'info> {
    #[account(
        mut,
        seeds = [b"watchlist", authority.key().as_ref()],
        bump = watchlist.bump,
        has_one = authority,
    )]
    pub watchlist: Account<'info, Watchlist>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

//  State

#[account]
pub struct Watchlist {
    pub authority: Pubkey,  // 32
    pub slugs: Vec<String>, // 4 (vec len) + MAX_PROTOCOLS * (4 + MAX_SLUG_LEN)
    pub bump: u8,           // 1
}

impl Watchlist {
    pub fn initial_space() -> usize {
        DISCRIMINATOR_BYTES + PUBKEY_BYTES + VEC_LEN_BYTES + BUMP_BYTES
    }

    pub fn max_space() -> usize {
        DISCRIMINATOR_BYTES
            + PUBKEY_BYTES
            + VEC_LEN_BYTES
            + (MAX_PROTOCOLS * (STRING_LEN_PREFIX_BYTES + MAX_SLUG_LEN))
            + BUMP_BYTES
    }

    pub fn space_after_add(existing: &[String], new_slug: &str) -> usize {
        let bounded_len = std::cmp::min(new_slug.len(), MAX_SLUG_LEN);
        let existing_bytes: usize = existing
            .iter()
            .map(|s| STRING_LEN_PREFIX_BYTES + s.len())
            .sum();

        let target = DISCRIMINATOR_BYTES
            + PUBKEY_BYTES
            + VEC_LEN_BYTES
            + existing_bytes
            + (STRING_LEN_PREFIX_BYTES + bounded_len)
            + BUMP_BYTES;

        std::cmp::min(target, Self::max_space())
    }
}

//  Errors

#[error_code]
pub enum WatchlistError {
    #[msg("Slug exceeds 32 characters")]
    SlugTooLong,
    #[msg("Protocol already in watchlist")]
    AlreadyExists,
    #[msg("Watchlist is full (max 20 protocols)")]
    WatchlistFull,
    #[msg("Protocol not found in watchlist")]
    NotFound,
}
