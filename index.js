const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const { status } = require("minecraft-server-util");
require("dotenv").config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const SERVER_IP = "funklore-smp.aternos.me";
const CHANNEL_ID = "1389111236074930318";
const ROLE_ID = process.env.ROLE_ID;

let lastStatus = null;
let lastMessageId = null;
let lastPlayerCount = null;

client.once("ready", async () => {
  console.log(`Bot is ready as ${client.user.tag}`);
  const channel = await client.channels.fetch(CHANNEL_ID);

  // Optional: Versuche letzte Bot-Nachricht zu laden, falls Bot neu startet
  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    const botMessage = messages.find(
      (m) => m.author.id === client.user.id && (m.embeds.length > 0)
    );
    if (botMessage) {
      lastMessageId = botMessage.id;
      lastStatus = botMessage.embeds[0].title.includes("🟢 Server Online");
      lastPlayerCount = lastStatus
        ? parseInt(
            botMessage.embeds[0].fields.find((f) => f.name === "Players Online")
              ?.value
          ) || null
        : null;
    }
  } catch (e) {
    console.warn("Konnte letzte Nachricht nicht laden:", e.message);
  }

  const createOnlineEmbed = (playerCount) =>
    new EmbedBuilder()
      .setTitle("🟢 Server Online")
      .setDescription(`Hey <@&${ROLE_ID}>, der Minecraft Server ist **online**!`)
      .addFields(
        { name: "Spieler online", value: `${playerCount}`, inline: true },
        { name: "Server IP", value: SERVER_IP, inline: true }
      )
      .setColor("Green")
      .setThumbnail("https://i.imgur.com/CwnAX6J.png")
      .setTimestamp()
      .setFooter({ text: "Minecraft Status Bot" });

  const createOfflineEmbed = () =>
    new EmbedBuilder()
      .setTitle("🔴 Server Offline")
      .setDescription(`Hey <@&${ROLE_ID}>, der Minecraft Server ist **offline**.`)
      .setColor("Red")
      .setTimestamp()
      .setFooter({ text: "Minecraft Status Bot" });

  const checkServer = async () => {
    try {
      const result = await status(SERVER_IP, 25565);
      const isOnline = true;
      const playerCount = result.players.online;

      if (lastStatus !== isOnline) {
        // Status hat sich geändert
        if (lastMessageId) {
          try {
            const oldMsg = await channel.messages.fetch(lastMessageId);
            await oldMsg.delete();
          } catch {
            // Nachricht schon gelöscht oder nicht gefunden
          }
          lastMessageId = null;
        }

        const embed = createOnlineEmbed(playerCount);
        const msg = await channel.send({
          content: `<@&${ROLE_ID}>`,
          embeds: [embed],
        });
        lastMessageId = msg.id;
        lastStatus = isOnline;
        lastPlayerCount = playerCount;
      } else if (isOnline && playerCount !== lastPlayerCount) {
        // Nur Spieleranzahl hat sich geändert
        if (lastMessageId) {
          try {
            const oldMsg = await channel.messages.fetch(lastMessageId);
            const embed = createOnlineEmbed(playerCount);
            await oldMsg.edit({ content: null, embeds: [embed] }); // Ping nur beim neuen Posten
            lastPlayerCount = playerCount;
          } catch {
            // Falls Nachricht nicht gefunden -> neu senden
            const embed = createOnlineEmbed(playerCount);
            const msg = await channel.send({
              content: `<@&${ROLE_ID}>`,
              embeds: [embed],
            });
            lastMessageId = msg.id;
            lastPlayerCount = playerCount;
          }
        }
      }
    } catch (error) {
      const isOnline = false;
      if (lastStatus !== isOnline) {
        if (lastMessageId) {
          try {
            const oldMsg = await channel.messages.fetch(lastMessageId);
            await oldMsg.delete();
          } catch {}
          lastMessageId = null;
        }
        const embed = createOfflineEmbed();
        const msg = await channel.send({
          content: `<@&${ROLE_ID}>`,
          embeds: [embed],
        });
        lastMessageId = msg.id;
        lastStatus = isOnline;
        lastPlayerCount = null;
      }
    }
  };

  // Direkt checken und dann alle 30 Sekunden
  await checkServer();
  setInterval(checkServer, 30 * 1000);
});

client.login(process.env.TOKEN);