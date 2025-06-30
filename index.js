const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const { status } = require("minecraft-server-util");
require("dotenv").config();

const SERVER_IP = "funklore-smp.aternos.me";
const SERVER_PORT = 25565;
const CHANNEL_ID = "1389111236074930318";
const ROLE_ID = process.env.ROLE_ID;
const CHECK_INTERVAL = 10_000; // Check every 10 seconds

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

let lastStatus = null;
let lastPlayerCount = null;
let statusMessageId = null;

function createStatusEmbed(isOnline, playerCount = 0) {
  const embed = new EmbedBuilder()
    .setTitle(isOnline ? "🟢 Funklore SMP is Online!" : "🔴 Funklore SMP is Offline")
    .setDescription(
      isOnline
        ? "✨ The Minecraft server is **online** and ready to play!"
        : "💤 The Minecraft server is currently **offline**.\nCheck back later!"
    )
    .setColor(isOnline ? "Green" : "Red")
    .setThumbnail("https://i.imgur.com/UiqNzRI.png")
    .setFooter({ text: "Funklore SMP • Status Monitor" })
    .setTimestamp();

  if (isOnline) {
    embed.addFields(
      { name: "👥 Players Online", value: `\`${playerCount}\``, inline: true },
      { name: "🌐 IP Address", value: `\`${SERVER_IP}\``, inline: true }
    );
  }

  return embed;
}

async function updateStatusMessage(channel, embed) {
  try {
    if (statusMessageId) {
      const message = await channel.messages.fetch(statusMessageId);
      await message.edit({ embeds: [embed] });
    } else {
      const message = await channel.send({ embeds: [embed] });
      statusMessageId = message.id;
    }
  } catch (err) {
    console.warn("Could not update status message:", err.message);
    const message = await channel.send({ embeds: [embed] });
    statusMessageId = message.id;
  }
}

async function sendPingNotification(channel, isOnline) {
  await channel.send({
    content: `<@&${ROLE_ID}>`,
    embeds: [
      new EmbedBuilder()
        .setTitle(isOnline ? "✅ Server is now Online!" : "⚠️ Server went Offline!")
        .setDescription(
          isOnline
            ? "The Minecraft server just went **online** — join now!"
            : "The Minecraft server just went **offline**."
        )
        .setColor(isOnline ? "Green" : "Red")
        .setTimestamp()
        .setFooter({ text: "Status Change Notification" }),
    ],
  });
}

async function checkServerStatus(channel) {
  try {
    const result = await status(SERVER_IP, SERVER_PORT);
    const isOnline = true;
    const playerCount = result.players.online;

    if (lastStatus !== isOnline) {
      await sendPingNotification(channel, isOnline);
    }

    if (lastStatus !== isOnline || lastPlayerCount !== playerCount) {
      const embed = createStatusEmbed(isOnline, playerCount);
      await updateStatusMessage(channel, embed);
    }

    lastStatus = isOnline;
    lastPlayerCount = playerCount;
  } catch (err) {
    const isOnline = false;

    if (lastStatus !== isOnline) {
      await sendPingNotification(channel, isOnline);
    }

    if (lastStatus !== isOnline) {
      const embed = createStatusEmbed(isOnline);
      await updateStatusMessage(channel, embed);
    }

    lastStatus = isOnline;
    lastPlayerCount = null;
  }
}

client.once("ready", async () => {
  console.log(`✅ Bot is running as ${client.user.tag}`);
  const channel = await client.channels.fetch(CHANNEL_ID);

  // Restore last status message
  try {
    const messages = await channel.messages.fetch({ limit: 20 });
    const botMessage = messages.find(
      (msg) => msg.author.id === client.user.id && msg.embeds.length > 0
    );
    if (botMessage) statusMessageId = botMessage.id;
  } catch (err) {
    console.warn("Could not restore last message:", err.message);
  }

  // Start monitoring
  checkServerStatus(channel);
  setInterval(() => checkServerStatus(channel), CHECK_INTERVAL);
});

client.login(process.env.TOKEN);