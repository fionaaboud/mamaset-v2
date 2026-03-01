import { PinataSDK } from "pinata";
import { Telegraf } from "telegraf";
import { ethers } from "ethers";
import { createRequire } from "module";
import { initUnlink, createSqliteStorage, waitForConfirmation } from "@unlink-xyz/node";
import dotenv from "dotenv";
dotenv.config();
const require = createRequire(import.meta.url);
const contractABI = require("./artifacts/contracts/MamasetMemory.sol/MamasetMemory.json").abi;
const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY,
});
const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz");
const wallet = new ethers.Wallet(process.env.MONAD_PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.MONAD_CONTRACT_ADDRESS, contractABI, wallet);
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const pendingUploads = {};

let unlink = null;

async function initUnlinkWallet() {
  try {
    unlink = await initUnlink({
      chain: "monad-testnet",
      storage: createSqliteStorage({ path: "./data/unlink-wallet.db" }),
    });
    const account = await unlink.accounts.getActive();
    console.log("🔒 Unlink private wallet ready:", account.address);
  } catch (err) {
    console.warn("⚠️  Unlink init failed — minting will proceed publicly:", err.message);
    unlink = null;
  }
}

async function getParentingAdvice(userMessage, userName) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are Mama, a warm and knowledgeable parenting companion inside the Mamaset app. You are talking to ${userName}. When giving parenting advice, always respond with 4-5 specific, actionable tips as a numbered list. Be warm, encouraging, and practical. Never give medical diagnoses — always suggest consulting a doctor for health concerns.`,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "OpenRouter error");
  return data.choices[0].message.content;
}

async function mintPrivately(tokenURI) {
  const { address: burnerAddress } = await unlink.burner.addressOf(0);
  const GAS_AMOUNT = 1_000_000_000_000_000n;
  const NATIVE = "0x0000000000000000000000000000000000000000";
  const fundResult = await unlink.burner.fund(0, { token: NATIVE, amount: GAS_AMOUNT });
  await waitForConfirmation(unlink, fundResult.relayId);
  const iface = new ethers.Interface(contractABI);
  const calldata = iface.encodeFunctionData("mintMemory", [burnerAddress, tokenURI]);
  await unlink.burner.send(0, { to: process.env.MONAD_CONTRACT_ADDRESS, data: calldata });
  try {
    await unlink.burner.sweepToPool(0, { token: NATIVE });
  } catch {
    // ignore if balance too low
  }
}

bot.start((ctx) => ctx.reply("Welcome to Mamaset! 🌸\n\nSend me a photo to store it forever in your memory vault, or just type any parenting question and I will help!"));

bot.on("photo", async (ctx) => {
  try {
    const userId = ctx.from.id;
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileLink = await ctx.telegram.getFileLink(photo.file_id);
    pendingUploads[userId] = {
      fileLink: fileLink.href,
      timestamp: new Date().toISOString(),
      userName: ctx.from.first_name,
      userId: userId,
    };
    ctx.reply("📸 Got it! Add a caption to this memory? Or type /skip to save without one.");
  } catch (error) {
    console.log(error);
    ctx.reply("❌ Something went wrong. Please try again.");
  }
});

bot.command("skip", async (ctx) => {
  const userId = ctx.from.id;
  if (pendingUploads[userId]) {
    await saveMemory(ctx, userId, "No caption");
  }
});

bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  if (pendingUploads[userId]) {
    await saveMemory(ctx, userId, ctx.message.text);
    return;
  }
  try {
    await ctx.sendChatAction("typing");
    const advice = await getParentingAdvice(ctx.message.text, ctx.from.first_name);
    ctx.reply(advice);
  } catch (error) {
    console.error("OpenRouter error:", error.message);
    ctx.reply("💛 I am having trouble connecting right now. Please try again in a moment!");
  }
});

async function saveMemory(ctx, userId, caption) {
  try {
    ctx.reply("💾 Saving your memory...");
    const pending = pendingUploads[userId];
    const response = await fetch(pending.fileLink);
    const buffer = await response.arrayBuffer();
    const file = new File([buffer], "memory.jpg", { type: "image/jpeg" });
    const upload = await pinata.upload.public
      .file(file)
      .name("Memory - " + pending.timestamp)
      .keyvalues({
        caption: caption,
        timestamp: pending.timestamp,
        userId: String(pending.userId),
        userName: pending.userName,
      });
    ctx.reply("✨ Preserving your memory privately on Monad...");
    const tokenURI = "https://" + process.env.PINATA_GATEWAY + "/ipfs/" + upload.cid;
    if (unlink) {
      await mintPrivately(tokenURI);
    } else {
      const tx = await contract.mintMemory(wallet.address, tokenURI);
      await tx.wait();
    }
    delete pendingUploads[userId];
    ctx.reply("✅ Memory saved! 🌸\n📝 Caption: " + caption + "\n💛 Your memory is now permanent!\n🖼 View your memory: https://" + process.env.PINATA_GATEWAY + "/ipfs/" + upload.cid);
  } catch (error) {
    console.log(error);
    ctx.reply("❌ Something went wrong. Please try again.");
  }
}

await initUnlinkWallet();
bot.launch();
console.log("🌸 Mamaset bot is running...");

