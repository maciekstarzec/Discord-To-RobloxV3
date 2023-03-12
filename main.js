const crypto = require('crypto');
const axios = require('axios');
const https = require('https');

const { Client, EmbedBuilder, GatewayIntentBits, Guild } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.MessageContent] });
const { universeID, adminRole, botPrefix, datastoreApiKey, botToken, loggingChannel } = require('./Credentials/Config.json');

let numbers = ["0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣"];
var toBan = [];

async function startApp() {
    var promise = client.login(botToken)
    console.log("Starting...");
    promise.catch(function(error) {
        console.error("Discord bot login | " + error);
        process.exit(1);
    });
}

startApp();

client.on("ready", () => {
    console.log(`Successfully logged in ${client.user.tag}`);
});

const Invalid = new EmbedBuilder()
    .setColor('#eb4034')
    .setDescription("Invalid user or time specified")

function byUID(method, usr, message) {
    const Emb = new EmbedBuilder()
        .setDescription("Attempting to " + method + " UserID " + usr + "...")
        .setTimestamp()

    message.edit({ embeds: [Emb] });
    https.get("https://api.roblox.com/users/" + usr, (res) => {
        let data = '';
        res.on('data', d => {
            data += d
        })
        res.on('end', () => {
            if (res.statusCode == 200) {
                toBan.push({ method: method, username: JSON.parse(data).Username, value: usr, cid: message.channel.id, mid: message.id });
                handleDataResponse(JSON.parse(data).Id, method, message, JSON.parse(data).Username);
                toBan.shift();
            } else {
                message.edit({ embeds: [Invalid] });
            }
        });
    }).on('error', error => {
        console.error("RBLX API (UID) | " + error);
    });
}

async function handleDataResponse(userID, method, msg, username) {
    const entryKey = `user_${userID}`;
    const JSONValue = await JSON.stringify({ method });
    const ConvertAdd = await crypto.createHash("md5").update(JSONValue).digest("base64");

    const response = await axios.post(
        `https://apis.roblox.com/datastores/v1/universes/${universeID}/standard-datastores/datastore/entries/entry`
        , JSONValue, {
            params: {
                'datastoreName': 'DTRD'
                , 'entryKey': entryKey
            }
            , headers: {
                'x-api-key': datastoreApiKey
                , 'content-md5': ConvertAdd
                , 'content-type': 'application/json'
            , }
        , }
    ).catch((err) => {
        console.log(err.response.data);
        console.log(err.message);
    });

    const color = response && response.status >= 200 && response.status <= 299 ?
        '#00ff44' :
        '#eb4034';

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${method} ${response ? 'Successful' : 'Failed'}`)
        .addFields({ name: 'Username', value: `${username}` })
        .addFields({ name: 'UserID', value: `${userID}` })
        .setTimestamp();

    const channel = await client.channels.cache.get(msg.channel.id);
    const msgObj = await channel.messages.fetch(msg.id);

    if (msgObj !== undefined) {
        msgObj.edit({ embeds: [embed] });
    } else {
        msgObj.send({ embeds: [embed] });
    }
}

// updated byUser function
async function byUser(method, usr, message, banTime) {
    const tempTime = banTime ? banTime : "permanent";
    const Emb = new EmbedBuilder()
        .setDescription(`Attempting to ${method} ${usr} for ${tempTime}...`)
        .setTimestamp();
    message.edit({ embeds: [Emb] });

    https.get("https://api.roblox.com/users/get-by-username?username=" + usr, (res) => {
        let data = '';

        res.on('data', d => {
            data += d;
        });

        res.on('end', () => {
            if (res.statusCode === 200) {
                toBan.push({ method, username: usr, value: JSON.parse(data).Id, cid: message.channel.id, mid: message.id, time: tempTime });
                handleDataResponse(JSON.parse(data).Id, method, message, usr);
                toBan.shift();
            } else {
                message.edit({ embeds: [Invalid] });
            }
        });
    }).on('error', error => {
        console.error("RBLX API (Username) | " + error);
    });
}

function isCommand(command, message) {
    return message.content.toLowerCase().startsWith(botPrefix + command.toLowerCase());
}

const TookTooLong = new EmbedBuilder()
    .setColor('#eb4034')
    .setDescription("You took too long to respond!")

async function determineType(method, msg, BotMsg, args, banTime) {
    if (isNaN(Number(args[1]))) {
        byUser(method, args[1], BotMsg, banTime);
    } else {
        const Emb = new EmbedBuilder()
            .setColor('#ea00ff')
            .setTitle("Is this a UserID or a Username?")
            .setDescription("Please react with the number that matches the answer.")
            .addFields({ name: numbers[0] + ": Username", value: "This is a player's username in game" })
            .addFields({ name: numbers[1] + ": UserID", value: "This is the player's UserID connected with the account" })
            .setTimestamp()
        BotMsg.edit({ embeds: [Emb] });
        await Promise.all(numbers.map(async (n) => { await BotMsg.react(n) }));

        try {
            const filter = (reaction, user) => numbers.includes(reaction?.emoji?.name) && user.id === msg.author.id;
            const collected = await BotMsg.awaitReactions({ filter, max: 1, time: 30000, errors: ['time'] });
            const reaction = collected.first();
            const ind = numbers.findIndex(function(n) { return n == reaction.emoji.name; });
            BotMsg.reactions.removeAll().catch(error => console.error('Failed to clear reactions: ', error));

            if (ind == 0) {
                byUser(method, args[1], BotMsg, banTime);
            } else if (ind == 1) {
                byUID(method, args[1], BotMsg, banTime);
            } else {
                BotMsg.edit({ embeds: [Invalid] });
            }
        } catch (error) {
            if (error instanceof CollectionError) BotMsg.edit({ embeds: [TookTooLong] });
            BotMsg.reactions.removeAll().catch(error => console.error('Failed to clear reactions: ', error));
        }
    }
}

function timeCheck(time) {
    let regex = /^(\d+)(s|m|h|d|y)?$/;
    let matches = regex.exec(time);

    if (matches) {
        let duration = parseInt(matches[1]);
        let unit = matches[2];
        switch (unit) {
            case "s":
                duration = duration * 1000;
                break;
            case "m":
                duration = duration * 60 * 1000;
                break;
            case "h":
                duration = duration * 60 * 60 * 1000;
                break;
            case "d":
                duration = duration * 24 * 60 * 60 * 1000;
                break;
            case "y":
                duration = duration * 365 * 24 * 60 * 60 * 1000;
                break;
            default:
                duration = duration * 1;
        }
        return new Date(Date.now() + duration);
    }
}

async function executeCommand(command, args, message) {
    let time;
    var BotMsg = await message.channel.send({ embeds: [Emb] });

    switch (command.toLowerCase()) {
        case "ban":
            logMessage("Ban", message.author.username);
            if (!args[1]) {
                determineType("Ban", message, BotMsg, args);
            } else {
                time = timeCheck(args[2]);
                if (!time) {
                    BotMsg.edit({ embeds: [Invalid] });
                    return;
                }
                determineType("Ban", message, BotMsg, args, time);
            }
            break;

        case "unban":
            logMessage("Unban", message.author.username);
            determineType("Unban", message, BotMsg, args);
            break;

        case "kick":
            logMessage("Kick", message.author.username);
            determineType("Kick", message, BotMsg, args);
            break;

        default:
            BotMsg.edit({ content: 'Sorry, I don\'t recognize that command.' });
            break;
    }
}

const Emb = new EmbedBuilder()
    .setColor('#eb4034')
    .setDescription("Working...")

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.member.roles.cache.some(role => role.name === adminRole)) {
        const [command, ...args] = message.content.slice(botPrefix.length).split(' ');
        executeCommand(command, args, message);
    }
});

client.on('error', console.error);