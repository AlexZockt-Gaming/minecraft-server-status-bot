const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const { status } = require("minecraft-server-util");
require("dotenv").config();

const SERVER_IP = "funklore-smp.aternos.me";
const SERVER_PORT = 25565;
const CHANNEL_ID = "1389111236074930318";
const ROLE_ID = process.env.ROLE_ID;
const CHECK_INTERVAL = 5000; // 5 Sekunden

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

let lastStatus = null;      // true = online, false = offline
let lastPlayerCount = null;
let lastMessageId = null;
let isChecking = false;

function createOnlineEmbed(playerCount) {
  return new EmbedBuilder()
    .setTitle("🟢 Server Online")
    .setDescription(`Hey <@&${ROLE_ID}>, der Minecraft Server ist **online**!`)
    .addFields(
      { name: "Players Online", value: `${playerCount}`, inline: true },
      { name: "Server IP", value: SERVER_IP, inline: true }
    )
    .setColor("Green")
    .setTimestamp()
    .setFooter({ text: "Minecraft Status Bot" });
}

function createOfflineEmbed() {
  return new EmbedBuilder()
    .setTitle("🔴 Server Offline")
    .setDescription(`Hey <@&${ROLE_ID}>, der Minecraft Server ist **offline**.`)
    .setColor("Red")
    .setTimestamp()
    .setFooter({ text: "Minecraft Status Bot" });
}

async function sendOrUpdateMessage(channel, embed, mentionRole) {
  if (!lastMessageId) {
    // Nachricht senden mit Ping (nur einmal)
    const msg = await channel.send({ content: mentionRole ? `<@&${ROLE_ID}>` : null, embeds: [embed] });
    lastMessageId = msg.id;
  } else {
    // Nachricht updaten ohne Ping
    try {
      const msg = await channel.messages.fetch(lastMessageId);
      await msg.edit({ content: null, embeds: [embed] });
    } catch {
      // Falls die Nachricht gelöscht wurde, neu senden mit Ping (nur wenn Statuswechsel)
      const msg = await channel.send({ content: mentionRole ? `<@&${ROLE_ID}>` : null, embeds: [embed] });
      lastMessageId = msg.id;
    }
  }
}

async function checkServer(channel) {
  if (isChecking) return;
  isChecking = true;

  try {
    const result = await status(SERVER_IP, SERVER_PORT);
    const isOnline = true;
    const playerCount = result.players.online;

    if (lastStatus === null) {
      // Erster Lauf: Nachricht mit Ping senden
      await sendOrUpdateMessage(channel, createOnlineEmbed(playerCount), true);
      lastStatus = isOnline;
      lastPlayerCount = playerCount;
    } else if (lastStatus !== isOnline) {
      // Status hat sich geändert → Nachricht mit Ping ersetzen
      await sendOrUpdateMessage(channel, createOnlineEmbed(playerCount), true);
      lastStatus = isOnline;
      lastPlayerCount = playerCount;
    } else if (isOnline && lastPlayerCount !== playerCount) {
      // Nur Spieleranzahl geändert → Nachricht updaten ohne Ping
      await sendOrUpdateMessage(channel, createOnlineEmbed(playerCount), false);
      lastPlayerCount = playerCount;
    }
  } catch {
    const isOnline = false;

    if (lastStatus === null || lastStatus !== isOnline) {
      // Status offline neu setzen mit Ping
      await sendOrUpdateMessage(channel, createOfflineEmbed(), true);
      lastStatus = isOnline;
      lastPlayerCount = null;
    }
  } finally {
    isChecking = false;
  }
}

client.once("ready", async () => {
  console.log(`Bot läuft als ${client.user.tag}`);
  const channel = await client.channels.fetch(CHANNEL_ID);

  // Versuche alte Bot-Nachricht zu finden
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
        ? parseInt(botMessage.embeds[0].fields.find(f => f.name === "Players Online")?.value) || 0
        : null;
      console.log("Letzten Status wiederhergestellt:", lastStatus, lastPlayerCount);
    }
  } catch (err) {
    console.warn("Konnte letzte Nachricht nicht wiederherstellen:", err.message);
  }

  // Starte Status-Check Intervall
  setInterval(() => checkServer(channel), CHECK_INTERVAL);
});

client.login(process.env.TOKEN);