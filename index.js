const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const { status } = require("minecraft-server-util");
require("dotenv").config();

const SERVER_IP = "funklore-smp.aternos.me";
const SERVER_PORT = 25565;
const CHANNEL_ID = "1389111236074930318";
const ROLE_ID = process.env.ROLE_ID;
const CHECK_INTERVAL = 5000; // 5 seconds

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

async function sendTemporaryPing(channel, statusText) {
  const message = await channel.send({
    content: `<@&${ROLE_ID}> The server is now **${statusText}**.`,
  });

  setTimeout(() => {
    message.delete().catch(() => {});
  }, 5000); // delete after 5 seconds
}

async function updateStatusMessage(channel, isOnline, playerCount) {
  const embed = createStatusEmbed(isOnline, playerCount);

  if (statusMessageId) {
    try {
      const msg = await channel.messages.fetch(statusMessageId);
      await msg.edit({ embeds: [embed] });
      return;
    } catch {
      statusMessageId = null;
    }
  }

  const msg = await channel.send({ embeds: [embed] });
  statusMessageId = msg.id;
}

async function checkServer(channel) {
  try {
    const result = await status(SERVER_IP, SERVER_PORT);
    const isOnline = true;
    const playerCount = result.players.online;

    if (lastStatus !== isOnline) {
      await sendTemporaryPing(channel, "online");
    }

    const statusChanged = lastStatus !== isOnline;
    const playersChanged = lastPlayerCount !== playerCount;

    if (statusChanged || playersChanged) {
      await updateStatusMessage(channel, isOnline, playerCount);
    }

    lastStatus = isOnline;
    lastPlayerCount = playerCount;
  } catch {
    const isOnline = false;

    if (lastStatus !== isOnline) {
      await sendTemporaryPing(channel, "offline");
      await updateStatusMessage(channel, false);
      lastStatus = isOnline;
      lastPlayerCount = null;
    }
  }
}

client.once("ready", async () => {
  console.log(`✅ Bot is running as ${client.user.tag}`);
  const channel = await client.channels.fetch(CHANNEL_ID);

  try {
    const messages = await channel.messages.fetch({ limit: 10 });
    const statusMsg = messages.find(
      (msg) => msg.author.id === client.user.id && msg.embeds.length > 0
    );

    if (statusMsg) {
      statusMessageId = statusMsg.id;
    }
  } catch {}

  await checkServer(channel);
  setInterval(() => checkServer(channel), CHECK_INTERVAL);
});

client.login(process.env.TOKEN);

require("http")
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot is alive!");
  })
  .listen(process.env.PORT || 3000);