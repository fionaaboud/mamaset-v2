import { PinataSDK } from "pinata";
import { Telegraf } from "telegraf";
import dotenv from "dotenv";
dotenv.config();

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY,
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.start((ctx) => ctx.reply("Welcome to Mamaset! Send me a photo to store it forever on IPFS."));

bot.on("photo", async (ctx) => {
  ctx.reply("📸 Received your photo! Uploading to IPFS...");
  // Pinata upload will go here
});

bot.launch();
console.log("Mamaset bot is running...");
