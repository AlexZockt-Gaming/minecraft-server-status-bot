const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const { status } = require("minecraft-server-util");
require("dotenv").config();

// === Configuration ===
const SERVER_IP = "funklore-smp.aternos.me";
const SERVER_PORT = 25565;
const CHANNEL_ID = "1389111236074930318";
const ROLE_ID = process.env.ROLE_ID;
const CHECK_INTERVAL = 1000;

// === Client Setup ===
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// === Status Tracking ===
let lastStatus = null;
let lastPlayerCount = null;
let lastMessageId = null;
let isChecking = false; // Verhindert parallele Checks

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

// === Hilfsfunktion zum Vergleich ===
function statusesEqual(oldStatus, newStatus, oldCount, newCount) {
  return oldStatus === newStatus && (oldCount === newCount || (oldCount === null && newCount === 0));
}

// === Message Management ===
async function replaceMessage(channel, embed) {
  if (lastMessageId) {
    try {
      const oldMessage = await channel.messages.fetch(lastMessageId);
      await oldMessage.delete();
    } catch (err) {
      console.warn("Could not delete old message:", err.message);
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
  } catch (err) {
    console.warn("Could not edit message:", err.message);
    await replaceMessage(channel, embed);
  }
}

// === Status Check Logic ===
async function checkServer(channel) {
  if (isChecking) return;
  isChecking = true;

  try {
    const result = await status(SERVER_IP, SERVER_PORT);
    const isOnline = true;
    const playerCount = result.players.online;

    console.log(`Checking server:
      lastStatus=${lastStatus}, lastPlayerCount=${lastPlayerCount}
      currentStatus=${isOnline}, currentPlayerCount=${playerCount}`);

    if (!statusesEqual(lastStatus, isOnline, lastPlayerCount, playerCount)) {
      console.log(`Status or player count changed, updating message.`);
      await replaceMessage(channel, createOnlineEmbed(playerCount));
      lastStatus = isOnline;
      lastPlayerCount = playerCount;
    }
  } catch (err) {
    const isOnline = false;
    console.log("Server offline or error caught.");

    if (lastStatus !== isOnline) {
      console.log(`Status changed to offline, updating message.`);
      await replaceMessage(channel, createOfflineEmbed());
      lastStatus = isOnline;
      lastPlayerCount = null;
    }
  } finally {
    isChecking = false;
  }
}

// === Bot Ready Event ===
client.once("ready", async () => {
  console.log(`✅ Bot is running as ${client.user.tag}`);
  const channel = await client.channels.fetch(CHANNEL_ID);

  // Versuche letzte Nachricht zu laden und Status wiederherzustellen
  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    const botMessage = messages.find(
      (msg) => msg.author.id === client.user.id && msg.embeds.length > 0
    );

    if (botMessage) {
      lastMessageId = botMessage.id;
      const embedTitle = botMessage.embeds[0].title || "";
      lastStatus = embedTitle.startsWith("🟢");
      lastPlayerCount = lastStatus
        ? parseInt(botMessage.embeds[0].fields.find((f) => f.name === "Players Online")?.value) || 0
        : null;

      console.log("Recovered last message status:", lastStatus, "playerCount:", lastPlayerCount);
    }
  } catch (err) {
    console.warn("Could not restore last message:", err.message);
  }

  // Starte den Intervall, der regelmäßig den Serverstatus prüft
  setInterval(() => checkServer(channel), CHECK_INTERVAL);
});

// === Bot Login ===
client.login(process.env.TOKEN);