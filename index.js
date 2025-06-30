const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const { status } = require("minecraft-server-util");
require("dotenv").config();

// === Configuration ===
const SERVER_IP = "funklore-smp.aternos.me";
const SERVER_PORT = 25565;
const CHANNEL_ID = "1389111236074930318";
const ROLE_ID = process.env.ROLE_ID;
const CHECK_INTERVAL = 1000; // 1 second

// === Client Setup ===
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// === Status Tracking ===
let lastStatus = null;
let lastPlayerCount = null;
let lastMessageId = null;
let isChecking = false; // Prevent overlapping executions

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
    .setDescription(`Hey <@&${ROLE_ID}>, the Minecraft server ist **offline**.`)
    .setColor("Red")
    .setTimestamp()
    .setFooter({ text: "Minecraft Status Bot" });
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

    console.log("checkServer:", {
      lastStatus,
      isOnline,
      lastPlayerCount,
      playerCount,
    });

    if (lastStatus !== isOnline) {
      console.log(`Status changed: ${lastStatus} -> ${isOnline}. Sending new message.`);
      await replaceMessage(channel, createOnlineEmbed(playerCount));
      lastStatus = isOnline;
      lastPlayerCount = playerCount;
    } else if (isOnline && playerCount !== lastPlayerCount) {
      console.log(`Player count changed: ${lastPlayerCount} -> ${playerCount}. Updating message.`);
      await updateMessage(channel, createOnlineEmbed(playerCount));
      lastPlayerCount = playerCount;
    }
  } catch (err) {
    const isOnline = false;
    console.log("checkServer: Caught error, setting offline.");

    if (lastStatus !== isOnline) {
      console.log(`Status changed: ${lastStatus} -> offline. Sending offline message.`);
      await replaceMessage(channel, createOfflineEmbed());
      lastStatus = isOnline;
      lastPlayerCount = null;
    }
  } finally {
    isChecking = false;
  }
}

// === Bot Ready ===
client.once("ready", async () => {
  console.log(`✅ Bot is running as ${client.user.tag}`);
  const channel = await client.channels.fetch(CHANNEL_ID);

  // Try to recover last message after restart
  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    const botMessage = messages.find(
      (msg) => msg.author.id === client.user.id && msg.embeds.length > 0
    );

    if (botMessage) {
      lastMessageId = botMessage.id;
      lastStatus = botMessage.embeds[0].title.includes("Online");
      lastPlayerCount = lastStatus
        ? parseInt(
            botMessage.embeds[0].fields.find((f) => f.name === "Players Online")?.value
          ) || null
        : null;

      console.log("Recovered last message status:", lastStatus, "playerCount:", lastPlayerCount);
    }
  } catch (err) {
    console.warn("Could not restore last message:", err.message);
  }

  // Wenn lastStatus bereits bekannt, dann erst INTERVALL starten
  if (lastStatus !== null) {
    setInterval(() => checkServer(channel), CHECK_INTERVAL);
    // Optional: nicht direkt nochmal prüfen, da wir Status aus embed kennen
  } else {
    // Falls keine Nachricht gefunden, direkt prüfen und dann INTERVALL starten
    await checkServer(channel);
    setInterval(() => checkServer(channel), CHECK_INTERVAL);
  }
});

// === Login ===
client.login(process.env.TOKEN);