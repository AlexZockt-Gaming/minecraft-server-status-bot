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

let lastStatus = null;
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

async function replaceMessage(channel, embed) {
  if (lastMessageId) {
    try {
      const oldMessage = await channel.messages.fetch(lastMessageId);
      await oldMessage.delete();
    } catch {}
    lastMessageId = null;
  }
  const msg = await channel.send({ content: `<@&${ROLE_ID}>`, embeds: [embed] });
  lastMessageId = msg.id;
}

async function updateMessage(channel, embed) {
  if (!lastMessageId) return;
  try {
    const msg = await channel.messages.fetch(lastMessageId);
    // Inhalt wird aktualisiert, aber ohne Rolle zu pingen (content=null)
    await msg.edit({ content: null, embeds: [embed] });
  } catch (e) {
    // Falls edit fehlschlägt, ersetzen wir die Nachricht komplett
    await replaceMessage(channel, embed);
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
      // Status hat sich geändert (offline → online oder umgekehrt)
      await replaceMessage(channel, createOnlineEmbed(playerCount));
      lastStatus = isOnline;
      lastPlayerCount = playerCount;
    } else if (isOnline && playerCount !== lastPlayerCount) {
      // Nur Spielerzahl hat sich geändert → Nachricht updaten (ohne ping)
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
  } finally {
    isChecking = false;
  }
}

client.once("ready", async () => {
  console.log(`Bot läuft als ${client.user.tag}`);
  const channel = await client.channels.fetch(CHANNEL_ID);

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
      console.log("Letzten Status wiederhergestellt:", lastStatus, lastPlayerCount);
    }
  } catch {}

  setInterval(() => checkServer(channel), CHECK_INTERVAL);
});

client.login(process.env.TOKEN);