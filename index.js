import { PinataSDK } from "pinata";
import { Telegraf } from "telegraf";
import dotenv from "dotenv";
dotenv.config();

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY,
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const pendingUploads = {};

bot.start((ctx) => ctx.reply("Welcome to Mamaset! Send me a photo to store it forever in your memory vault. 🌸"));

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
    const caption = ctx.message.text;
    await saveMemory(ctx, userId, caption);
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
      .name(`Memory - ${pending.timestamp}`)
      .keyvalues({
        caption: caption,
        timestamp: pending.timestamp,
        userId: String(pending.userId),
        userName: pending.userName,
      });

    delete pendingUploads[userId];

    ctx.reply(`✅ Memory saved! 🌸\n📝 Caption: ${caption}\n📅 ${pending.timestamp}`);
  } catch (error) {
    console.log(error);
    ctx.reply("❌ Something went wrong saving your memory. Please try again.");
  }
}

bot.launch();
console.log("Mamaset bot is running...");
