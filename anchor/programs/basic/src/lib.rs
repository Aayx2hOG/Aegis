use anchor_lang::prelude::*;

declare_id!("JAVuBXeBZqXNtS73azhBDAoYaaAFfo4gWXoZe2e7Jf8H");

// Max slugs per watchlist (keeps account size bounded)
const MAX_PROTOCOLS: usize = 20;
// Max bytes per slug (e.g. "raydium-amm-v4" = 14 chars, give headroom)
const MAX_SLUG_LEN: usize = 32;

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
    pub fn add_protocol(ctx: Context<ModifyWatchlist>, slug: String) -> Result<()> {
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
    pub fn remove_protocol(ctx: Context<ModifyWatchlist>, slug: String) -> Result<()> {
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
        space = Watchlist::space(),
        seeds = [b"watchlist", authority.key().as_ref()],
        bump
    )]
    pub watchlist: Account<'info, Watchlist>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ModifyWatchlist<'info> {
    #[account(
        mut,
        seeds = [b"watchlist", authority.key().as_ref()],
        bump = watchlist.bump,
        has_one = authority,  // ensures only owner can modify
        realloc = Watchlist::space(),
        realloc::payer = authority,
        realloc::zero = false,
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
    pub fn space() -> usize {
        8                                          // discriminator
        + 32                                       // authority
        + 4 + (MAX_PROTOCOLS * (4 + MAX_SLUG_LEN)) // slugs vec
        + 1 // bump
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
