# Mamaset — Claude Context

## Project
Telegram bot for parents to preserve memories privately on-chain.

## Stack
- Node.js (ESM, "type": "module")
- Telegraf (Telegram bot)
- Pinata SDK (IPFS uploads)
- Ethers.js (Monad blockchain)
- @unlink-xyz/node@canary (private minting)

## Contract
- Address: 0x92ecAc1323b97aC2D596A468050275f983C29cF9
- Network: Monad testnet (RPC: https://testnet-rpc.monad.xyz)
- ABI: ./artifacts/contracts/MamasetMemory.sol/MamasetMemory.json

## Bot Flow
1. Parent sends photo → bot asks for caption
2. Photo uploaded to IPFS via Pinata
3. NFT minted on Monad (privately via Unlink burner account)
4. /memories command → opens Telegram Web App gallery (memories.html)

## Files
- index.js — main bot + HTTP server (port 3456)
- memories.html — Telegram Web App photo gallery
- data/unlink-wallet.db — Unlink SQLite wallet

## .env vars
TELEGRAM_BOT_TOKEN, PINATA_JWT, PINATA_GATEWAY, MONAD_PRIVATE_KEY, MONAD_CONTRACT_ADDRESS, MINI_APP_URL

## Known Issues
- Parenting advice feature not yet implemented
- Unlink burner native token address needs verification

## Terminal Tips
- Always use MAMAEOF (not EOF) as the heredoc delimiter when writing index.js
- Never use nano to edit index.js — it breaks the file
- To update index.js always rewrite the whole file with cat > using MAMAEOF
