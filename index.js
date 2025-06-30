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

let lastStatus = null;       // true = online, false = offline
let lastPlayerCount = null;
let lastMessageId = null;
let isChecking = false;

function createOnlineEmbed(playerCount) {
  return new EmbedBuilder()
    .setTitle("🟢 Server Online")
    .setDescription(`Hey <@&${ROLE_ID}>, der Minecraft Server ist **online**!`)
    .addFields(
      { name: "Spieler Online", value: `${playerCount}`, inline: true },
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
    .setDescription(`Hey <@&${ROLE_ID}>, der Minecraft Server ist **offline**.`)
    .setColor("Red")
    .setTimestamp()
    .setFooter({ text: "Minecraft Status Bot" });
}

async function deleteOldMessage(channel) {
  if (!lastMessageId) return;
  try {
    const oldMessage = await channel.messages.fetch(lastMessageId);
    await oldMessage.delete();
    console.log("Alte Nachricht gelöscht.");
  } catch (err) {
    console.warn("Alte Nachricht konnte nicht gelöscht werden:", err.message);
  }
  lastMessageId = null;
}

async function sendNewMessage(channel, embed, mentionRole = false) {
  const content = mentionRole ? `<@&${ROLE_ID}>` : null;
  const msg = await channel.send({ content, embeds: [embed] });
  lastMessageId = msg.id;
  console.log("Neue Nachricht gesendet mit ID:", lastMessageId);
}

async function updateMessage(channel, embed) {
  if (!lastMessageId) {
    await sendNewMessage(channel, embed, false);
    return;
  }
  try {
    const message = await channel.messages.fetch(lastMessageId);
    await message.edit({ content: null, embeds: [embed] });
    console.log("Nachricht aktualisiert.");
  } catch (err) {
    console.warn("Nachricht konnte nicht editiert werden, sende neue Nachricht:", err.message);
    await sendNewMessage(channel, embed, false);
  }
}

async function checkServer(channel) {
  if (isChecking) return;
  isChecking = true;

  try {
    const result = await status(SERVER_IP, SERVER_PORT);
    const isOnline = true;
    const playerCount = result.players.online;

    if (lastStatus !== isOnline) {
      // Status hat sich geändert → Nachricht löschen und neue mit Ping senden
      await deleteOldMessage(channel);
      await sendNewMessage(channel, createOnlineEmbed(playerCount), true);
      lastStatus = isOnline;
      lastPlayerCount = playerCount;
    } else if (isOnline && playerCount !== lastPlayerCount) {
      // Spielerzahl hat sich geändert → Nachricht nur editieren, kein Ping
      await updateMessage(channel, createOnlineEmbed(playerCount));
      lastPlayerCount = playerCount;
    }
  } catch (err) {
    const isOnline = false;
    if (lastStatus !== isOnline) {
      // Server offline → alte Nachricht löschen, neue mit Ping senden
      await deleteOldMessage(channel);
      await sendNewMessage(channel, createOfflineEmbed(), true);
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

  // Versuche alte Nachricht zu laden und Status wiederherzustellen
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
        ? parseInt(botMessage.embeds[0].fields.find(f => f.name === "Spieler Online")?.value) || 0
        : null;
      console.log("Status wiederhergestellt:", lastStatus, lastPlayerCount);
    }
  } catch (err) {
    console.warn("Konnte alte Nachricht nicht wiederherstellen:", err.message);
  }

  setInterval(() => checkServer(channel), CHECK_INTERVAL);
});

client.login(process.env.TOKEN);