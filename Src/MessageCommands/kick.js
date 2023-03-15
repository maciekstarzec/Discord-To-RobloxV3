const { Collection, EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { universeID, datastoreApiKey, logChannelID } = require('../Credentials/Config.json');
const axios = require('axios').default;
const crypto = require('crypto');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a specified user from in game')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Kick user by Username or User ID')
                .setRequired(true)
                .addChoices(
                    { name: 'Username', value: 'username' },
                    { name: 'User ID', value: 'userid'},
                ))

        .addStringOption(option =>
            option.setName('input')
                .setDescription('Username/ID to kick')
                .setRequired(true))

        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        const logChan = await interaction.client.channels.fetch(logChannelID);
        const userOrID = interaction.options.getString('category');
        const userToKick = interaction.options.getString('input');
        let baseURL = "";

        if (userOrID === 'username') {
            baseURL = `https://api.roblox.com/users/get-by-username?username=${encodeURIComponent(userToKick)}`;
        } else {
            baseURL = `https://api.roblox.com/users/${userToKick}`;
        }

        try {
            const robloxResponse = await axios.get(baseURL);
            const robloxData = robloxResponse.data;

            if (robloxData.Id) {
                const userId = robloxData.Id;
                const thumbnailResponse = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`);
                const avatarUrl = thumbnailResponse.data.data[0].imageUrl;

                const confirmEmbed = new EmbedBuilder()
                    .setColor('#eb4034')
                    .setTitle('Confirm Kick')
                    .setThumbnail(avatarUrl)
                    .setDescription(`Are you sure you want to kick **${userToKick}**?`)
                    .setTimestamp();

                const message = await interaction.reply({ embeds: [confirmEmbed], fetchReply: true });

                await message.react('👍');
                await message.react('👎');

                const filter = (reaction, user) => {
                    return ['👍', '👎'].includes(reaction.emoji.name) && user.id === interaction.user.id;
                };

                message.awaitReactions({ filter, max: 1, time: 60000, errors: ['time'] })
                    .then(async collected => {
                        const reaction = collected.first();

                        if (reaction.emoji.name === '👍') {
                            const method = "Kick";
                            const entryKey = `user_${robloxData.Id}`;
                            const JSONValue = await JSON.stringify({ method });
                            const ConvertAdd = await crypto.createHash("md5").update(JSONValue).digest("base64");

                            try {
                                const response = await axios.post(
                                    `https://apis.roblox.com/datastores/v1/universes/${universeID}/standard-datastores/datastore/entries/entry`, JSONValue, {
                                        params: {
                                            'datastoreName': 'DTRD',
                                            'entryKey': entryKey
                                        },
                                        headers: {
                                            'x-api-key': datastoreApiKey,
                                            'content-md5': ConvertAdd,
                                            'content-type': 'application/json',
                                        },
                                    }
                                );
                        
                                const color = response && response.status >= 200 && response.status <= 299 ?
                                    '#00ff44' :
                                    '#eb4034';
                        
                                const embed = new EmbedBuilder()
                                    .setColor(color)
                                    .setTitle(`${method} ${response ? 'Successful' : 'Failed'}`)
                                    .setThumbnail(avatarUrl)
                                    .addFields({ name: 'Username', value: `${robloxData.Username}` })
                                    .addFields({ name: 'User ID', value: `${robloxData.Id}` })
                                    .setTimestamp();

                                const logEmbed = new EmbedBuilder()
                                    .setColor('#eb4034')
                                    .setTitle('Command Executed')
                                    .addFields({ name: 'Administrator', value: `${interaction.user}` })
                                    .addFields({ name: 'Action', value: `${method} ${userToKick}` })
                                    .setThumbnail(interaction.user.displayAvatarURL())
                                    .setTimestamp();
                        
                                if (message) {
                                    message.edit({ embeds: [embed] });
                                    if (logChan) {
                                        logChan.send({ embeds: [logEmbed] });
                                    } else {
                                        console.log("Make sure to set a log channel!");
                                    }
                                } else {
                                    return console.error("No message detected");
                                }
                            } catch (error) {
                                return console.error(`Datastore API | ${error}`);
                            }
                        } else {
                            return interaction.followUp('Cancelled');
                        }
                    })
                    .catch(error => {
                        if (error instanceof Collection) {
                            interaction.followUp('Timed out.');
                        } else {
                            console.error(`Error awaiting reactions: ${error}`);
                            interaction.followUp('An error occurred while awaiting reactions.');
                        }
                    });
            } else {
                await interaction.reply('Unable to find that user on Roblox.');
            }
        } catch (error) {
            await interaction.reply('An error occurred while trying to fetch data from the Roblox API.');
        }
    }
};