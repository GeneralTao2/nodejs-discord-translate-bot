// ================= Google ================
const {Translate} = require('@google-cloud/translate').v2;
const translate = new Translate();

// ================= DISCORD ===============
const configs = require('./configs')
const { Client, MessageEmbed, MessageAttachment, Util, Intents } = require('discord.js');
const client = new Client({ intents: Intents.ALL });

const guildInfo = {
    guildId: '448934652992946176', 
    channelIdPairs: [
       {
        en: '808427868106784788',
        ru: '808427934284644382'
       },
       {
        en: '812331010213150724',
        ru: '726026506869932043'
       }
    ]
}

let target;
client.on('ready', async () => {
    target = new TranslateGuildTarget(guildInfo);
    await target.fetch();
    console.log('Yes!')
})

client.on('guildCreate', async (guild) => {
	console.log(guild.id)
});

client.on('message', async (message) => {
    if(message.author.bot) {
        return;
    }
    //console.log(message.channel.id)
    target.onMessage(message)
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
    target.onMessageUpdate(newMessage);
});


class TranslateGuildTarget {
    constructor(guildInfo) {
        this.currentGuild = client.guilds.cache.get(guildInfo.guildId);
        this.guildId = guildInfo.guildId;
        this.channelIdPairs = guildInfo.channelIdPairs;
        this.channelPairs = [];
        this.messageIdPairs = [];
        this.messageIdPairsPointer = 0;
        this.lastEditTime = [];
}

    async fetch() {
        await this.currentGuild.members.fetch()
        await this.currentGuild.roles.fetch()
        for(let i=0; i<guildInfo.channelIdPairs.length; i++) {
            this.channelPairs[i] = {
                en: client.channels.cache.get(guildInfo.channelIdPairs[i].en),
                ru: client.channels.cache.get(guildInfo.channelIdPairs[i].ru),
            }
        }
    }
    onMessage(message) {
        for(let i=0; i<this.channelIdPairs.length; i++) {
            if(message.channel.id === this.channelIdPairs[i].en) {
                this.translateMeesage(this.channelPairs[i].ru, 'ru', message)
            }
            if(message.channel.id === this.channelIdPairs[i].ru) {
                this.translateMeesage(this.channelPairs[i].en, 'en', message)
            }
        }
    }

    onMessageUpdate(newMessage) {
        for(let i=0; i<this.channelIdPairs.length; i++) {
            if(this.lastEditTime[i]) {
                if(newMessage.editedAt.getTime() - this.lastEditTime[i].getTime() < 700) {
                    console.log('E3')
                    return;
                }
            }
            this.lastEditTime[i] = newMessage.editedAt;
            try {
                if(newMessage.channel.id === this.channelIdPairs[i].en) {
                    this.editMessage(this.channelPairs[i].ru, 'ru', newMessage)
                }
                if(newMessage.channel.id === this.channelIdPairs[i].ru) {
                    this.editMessage(this.channelPairs[i].en, 'en', newMessage)
                }
            } catch (error) {
                console.log("Error! ", this.lastEditTime[i] ? newMessage.editedAt.getTime() - this.lastEditTime[i].getTime() : "null");
            }
        }
    }

    async translateMeesage(channel, target, message) {
        const embed = await this.getEmbed(target, message);
        //console.log(message.content)
        //console.log(embed)
        let cloneMessage;
        if(message.referencedMessage) {
            let refId;
            const refCloneId = this.getClone(message.referencedMessage.id);
            const refOriginalId = this.getOriginal(message.referencedMessage.id);
            if(refCloneId) {
                refId = refCloneId;
            } else if(refOriginalId) {
                refId = refOriginalId;
            } else {
                console.log('E1')
                return;
            }
            if(refId) {
                const refCloneMessage = await channel.messages.fetch(refId);
                if(!refCloneMessage) {
                    console.log('E2')
                    return
                }
                cloneMessage = await refCloneMessage.reply({ embed: embed })
            } else {
                cloneMessage = await channel.send({ embed: embed });
            }
        } else {
            cloneMessage = await channel.send({ embed: embed });
        }
        this.messageIdPairsPush({
            original: message.id,
            clone: cloneMessage.id
        })
    }

    async editMessage(channel, target, message) {
        const cloneMessageId = this.getClone(message.id);
        if(!cloneMessageId) {
            return
        }
        const embed = await this.getEmbed(target, message);
        const cloneMessage = await channel.messages.fetch(cloneMessageId)
        cloneMessage.edit({ embed: embed }) 
    }

    async getEmbed(target, message) {
        const [translation] = await translate.translate(message.content, target);
        let fix = translation.replace(/<@! /g, "<@!")
        fix = translation.replace(/``/g, "```")
        return {
            color: 0x265400,
            author: {
                name: message.author.tag,
                icon_url: message.author.avatarURL(),
                url: message.url,
            },
            files: message.attachments.array(),
            description: fix,
            timestamp: new Date(),
        };
    }

    messageIdPairsPush(pair) {
        this.messageIdPairs[this.messageIdPairsPointer] = pair;
        if(this.messageIdPairsPointer < 512) {
            this.messageIdPairsPointer++;
        } else {
            this.messageIdPairsPointer = 0;
        }
    }
    getClone(original) {
        const tmp = this.messageIdPairs.filter(pair => pair.original === original)[0];
        if(tmp) {
            return tmp.clone;
        } else {
            return null;
        }
    }
    
    getOriginal(clone) {
        const tmp = this.messageIdPairs.filter(pair => pair.clone === clone)[0];
        if(tmp) {
            return tmp.original;
        } else {
            return null;
        }
    }
}

client.login(configs.token);

