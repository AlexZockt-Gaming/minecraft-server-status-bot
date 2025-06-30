const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const { status } = require("minecraft-server-util");
const express = require("express");
require("dotenv").config();

const app = express();
app.get("/", (req, res) => res.send("Bot is running!"));
app.listen(3000, () => console.log("Webserver running on port 3000"));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const SERVER_IP = "funklore-smp.aternos.me";
const CHANNEL_ID = "1389111236074930318";
const ROLE_ID = process.env.ROLE_ID;
let lastStatus = null;
let lastMessage = null;
let lastPlayerCount = null;

client.once("ready", async () => {
  console.log(`Bot is ready as ${client.user.tag}`);

  const channel = await client.channels.fetch(CHANNEL_ID);

  const createOnlineEmbed = (playerCount) => {
    return new EmbedBuilder()
      .setTitle("🟢 Server Online")
      .setDescription(`Hey <@&${ROLE_ID}>, the Minecraft server is **online**!`)
      .addFields(
        { name: "Players Online", value: `${playerCount}`, inline: true },
        { name: "Server IP", value: SERVER_IP, inline: true },
      )
      .setColor("Green")
      .setThumbnail("https://i.imgur.com/CwnAX6J.png")
      .setTimestamp()
      .setFooter({ text: "Minecraft Status Bot" });
  };

  const createOfflineEmbed = () => {
    return new EmbedBuilder()
      .setTitle("🔴 Server Offline")
      .setDescription(
        `Hey <@&${ROLE_ID}>, the Minecraft server is **offline**.`,
      )
      .setColor("Red")
      .setTimestamp()
      .setFooter({ text: "Minecraft Status Bot" });
  };

  const checkServer = async () => {
    try {
      const result = await status(SERVER_IP, 25565);
      const isOnline = true;
      const playerCount = result.players.online;

      if (lastStatus !== isOnline) {
        if (lastMessage) {
          try {
            await lastMessage.delete();
          } catch (e) {
            console.warn("Could not delete old message:", e.message);
          }
          lastMessage = null;
        }

        const embed = createOnlineEmbed(playerCount);
        const msg = await channel.send({
          content: `<@&${ROLE_ID}>`,
          embeds: [embed],
        });
        lastMessage = msg;
        lastStatus = isOnline;
        lastPlayerCount = playerCount;
      } else if (isOnline && playerCount !== lastPlayerCount) {
        if (lastMessage) {
          try {
            const embed = createOnlineEmbed(playerCount);
            await lastMessage.edit({
              content: `<@&${ROLE_ID}>`,
              embeds: [embed],
            });
            lastPlayerCount = playerCount;
          } catch (e) {
            console.warn("Could not edit message:", e.message);
          }
        }
      }
    } catch (error) {
      const isOnline = false;
      if (lastStatus !== isOnline) {
        if (lastMessage) {
          try {
            await lastMessage.delete();
          } catch (e) {
            console.warn("Could not delete old message:", e.message);
          }
          lastMessage = null;
        }
        const embed = createOfflineEmbed();
        const msg = await channel.send({
          content: `<@&${ROLE_ID}>`,
          embeds: [embed],
        });
        lastMessage = msg;
        lastStatus = isOnline;
        lastPlayerCount = null;
      }
    }
  };

  checkServer();
  setInterval(checkServer, 1 * 1000);
});

client.login(process.env.TOKEN);
