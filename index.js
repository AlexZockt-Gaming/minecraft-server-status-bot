const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const { status } = require("minecraft-server-util");
require("dotenv").config();

// === Configuration ===
const SERVER_IP = "funklore-smp.aternos.me";
const SERVER_PORT = 25565;
const CHANNEL_ID = "1389111236074930318";
const ROLE_ID = process.env.ROLE_ID;
const CHECK_INTERVAL = 1 * 1000;

// === Client Setup ===
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// === Status Tracking ===
let lastStatus = null;
let lastPlayerCount = null;
let lastMessageId = null;

// === Embed Templates ===
function createOnlineEmbed(playerCount) {
  return new EmbedBuilder()
    .setTitle("🟢 Server Online")
    .setDescription(`Hey <@&${ROLE_ID}>, the Minecraft server is **online**!`)
    .addFields(
      { name: "Players Online", value: `${playerCount}`, inline: true },
      { name: "Server IP", value: SERVER_IP, inline: true }
    )
    .setColor("Green")
    .setThumbnail("https://i.imgur.com/CwnAX6J.png")
    .setTimestamp()
    .setFooter({ text: "Minecraft Status Bot" });
}

function createOfflineEmbed() {
  return new EmbedBuilder()
    .setTitle("🔴 Server Offline")
    .setDescription(`Hey <@&${ROLE_ID}>, the Minecraft server is **offline**.`)
    .setColor("Red")
    .setTimestamp()
    .setFooter({ text: "Minecraft Status Bot" });
}

// === Status Check Logic ===
async function checkServer(channel) {
  try {
    const result = await status(SERVER_IP, SERVER_PORT);
    const isOnline = true;
    const playerCount = result.players.online;

    if (lastStatus !== isOnline) {
      await replaceMessage(channel, createOnlineEmbed(playerCount));
      lastStatus = isOnline;
      lastPlayerCount = playerCount;
    } else if (isOnline && playerCount !== lastPlayerCount) {
      await updateMessage(channel, createOnlineEmbed(playerCount));
      lastPlayerCount = playerCount;
    }
  } catch {
    const isOnline = false;
    if (lastStatus !== isOnline) {
      await replaceMessage(channel, createOfflineEmbed());
      lastStatus = isOnline;
      lastPlayerCount = null;
    }
  }
}

// === Message Management ===
async function replaceMessage(channel, embed) {
  if (lastMessageId) {
    try {
      const oldMessage = await channel.messages.fetch(lastMessageId);
      await oldMessage.delete();
    } catch (e) {
      console.warn("Failed to delete previous message:", e.message);
    }
    lastMessageId = null;
  }

  const msg = await channel.send({ content: `<@&${ROLE_ID}>`, embeds: [embed] });
  lastMessageId = msg.id;
}

async function updateMessage(channel, embed) {
  if (!lastMessageId) return;

  try {
    const message = await channel.messages.fetch(lastMessageId);
    await message.edit({ content: null, embeds: [embed] });
  } catch (e) {
    console.warn("⚠️ Could not edit message:", e.message);
    // Wenn Nachricht nicht existiert (z. B. manuell gelöscht), dann:
    try {
      const msg = await channel.send({ content: `<@&${ROLE_ID}>`, embeds: [embed] });
      lastMessageId = msg.id;
    } catch (sendErr) {
      console.error("❌ Failed to send fallback message:", sendErr.message);
    }
  }
}

// === Bot Ready Event ===
client.once("ready", async () => {
  console.log(`✅ Bot is running as ${client.user.tag}`);
  const channel = await client.channels.fetch(CHANNEL_ID);

  // Try to recover last message after restart
  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    const botMsg = messages.find(
      (msg) => msg.author.id === client.user.id && msg.embeds.length > 0
    );
    if (botMsg) {
      lastMessageId = botMsg.id;
      lastStatus = botMsg.embeds[0].title.includes("Online");
      lastPlayerCount = lastStatus
        ? parseInt(
            botMsg.embeds[0].fields.find((f) => f.name === "Players Online")?.value
          ) || null
        : null;
    }
  } catch (e) {
    console.warn("Could not load last message:", e.message);
  }

  // Start monitoring loop
  await checkServer(channel);
  setInterval(() => checkServer(channel), CHECK_INTERVAL);
});

// === Start Bot ===
client.login(process.env.TOKEN);