const Discord = require('discord.js')
const google = require('googleapis')
const ytdl = require('ytdl-core')
const configs = require('./config.json')
const fs = require('fs')

const prefix = '-'

const YTDL = {
    filter: 'audioonly'
}

const youtube = new google.youtube_v3.Youtube({
    version: 'v3',
    auth: configs.GOOGLE_KEY
})
const client = new Discord.Client()

const servers = []

client.on('guildCreate', (guild) => {

    console.log(`Id of the guild i joined: ${guild.id}`)
    console.log(`Name of the guild i joined: ${guild.name}`)

    servers[guild.id] = {
        connection: null,
        dispatcher: null,
        queue: [],
        imPlaying: false
    }

    saveServer(guild.id)
})

client.on('ready', () => {
    loadServer()
    console.log('i am online!')
})

client.on('message', async (msg) => {

    //filters

    if (!msg.guild) return

    if (!msg.content.startsWith(prefix)) return

    if (!msg.member.voice.channel) {
        msg.channel.send(`Hey you are not in a voice channel!`)
        return
    }

    //commands 

    if (msg.content === prefix + 'join') {
        try {
            servers[msg.guild.id].connection = await msg.member.voice.channel.join()
        }
        catch (err) {
            console.log(err)
        }
    }

    if (msg.content === prefix + 'leave') {
        msg.member.voice.channel.leave()
        servers[msg.guild.id].connection = null
        servers[msg.guild.id].dispatcher = null
        servers[msg.guild.id].imPlaying = false
        servers[msg.guild.id].queue = []
        msg.channel.send(`Ok men... got it😰`)
    }

    if (msg.content.startsWith(prefix + 'play')) {
        let whatToPlay = msg.content.slice(6)

        if (whatToPlay.lenth === 0) {
            msg.channel.send(`I need something to play!`)
            return
        }

        if (servers[msg.guild.id].connection === null) {
            try {
                servers[msg.guild.id].connection = await msg.member.voice.channel.join()
            }
            catch (err) {
                console.log(err)
            }
        }

        if (ytdl.validateURL(whatToPlay)) {
            servers[msg.guild.id].queue.push(whatToPlay)
            console.log(`added to ${whatToPlay}`)
            playMusic(msg)
        } else {
            youtube.search.list({
                q: whatToPlay,
                part: 'snippet',
                fields: 'items(id(videoId), snippet(title,channelTitle))',
                type: 'video'
            }, function (err, result) {
                if (err) {
                    console.log(err)
                }
                if (result) {
                    const listResults = []
                    for (let i in result.data.items) {
                        const assembleItem = {
                            'videoTitle': result.data.items[i].snippet.title,
                            'channelName': result.data.items[i].snippet.channelTitle,
                            'id': 'https://www.youtube.com/watch?v=' + result.data.items[i].id.videoId
                        }

                        listResults.push(assembleItem)
                    }

                    const embed = new Discord.MessageEmbed()
                        .setColor(255, 76, 37)
                        .setAuthor('BaioTheDJ🐴😎')
                        .setDescription('Pick your music of 1-5!')

                    //#################################

                    for (let i in listResults) {
                        embed.addField(
                            `${parseInt(i) + 1}: ${listResults[i].videoTitle}`,
                            listResults[i].channelName
                        )
                    }

                    msg.channel.send(embed)
                        .then((embedMessage) => {
                            const possibelReaction = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣']

                            for (let i = 0; i < possibelReaction.length; i++) {
                                embedMessage.react(possibelReaction[i])
                            }

                            const filter = (reaction, user) => {
                                return possibelReaction.includes(reaction.emoji.name)
                                    && user.id === msg.author.id
                            }

                            embedMessage.awaitReactions(filter, { max: 1, time: 20000, errors: ['time'] })
                                .then((collected) => {
                                    const reaction = collected.first()
                                    const idOptionSelected = possibelReaction.indexOf(reaction.emoji.name)

                                    msg.channel.send(`you choose ${listResults[idOptionSelected].videoTitle} of ${listResults[idOptionSelected].channelName} (I am back and good music bro 😉)`)

                                    servers[msg.guild.id].queue.push(listResults[idOptionSelected].id)
                                    playMusic(msg)
                                }).catch((error) => {
                                    msg.reply(`Are you kidding me ? choose faster dude 🙁 `)
                                })

                        })
                }
            })
        }
    }

    if (msg.content === prefix + 'pause') {
        servers[msg.guild.id].dispatcher.pause()
        msg.channel.send(`Now is paused bro, relax😌`)
    }

    if (msg.content === prefix + 'resume') {
        servers[msg.guild.id].dispatcher.resume()
        msg.channel.send(`Keep going music🐴`)
    } 

     if (msg.content === prefix + 'clean') {
        if (servers[msg.guild.id].dispatcher) {
            servers[msg.guild.id].dispatcher.end()
            while (servers[msg.guild.id].queue.length > 0) {
                servers[msg.guild.id].queue.shift()
                msg.channel.send(`All clean boss!😉`)
            }
        } else {
            msg.channel.send(`I am not playing any music bro!`)
        }
    }

    if (msg.content === prefix + 'skip') {
        if (servers[msg.guild.id].dispatcher) {
            if (servers[msg.guild.id].queue.length > 1) {
                servers[msg.guild.id].dispatcher.end()
            } else {
                msg.channel.send(`Bro... don't exist more musics to play`)
            }
        }
    }

    if (msg.content === 'qual a boa?') {
        msg.reply(`Bro... shut up, and choose a music😡`)
    }
})

const playMusic = (msg) => {
    if (servers[msg.guild.id].imPlaying === false) {

        const playing = servers[msg.guild.id].queue[0]
        servers[msg.guild.id].imPlaying = true

        servers[msg.guild.id].dispatcher = servers[msg.guild.id].connection.play(ytdl(playing, YTDL))

        servers[msg.guild.id].dispatcher.on('finish', () => {
            servers[msg.guild.id].queue.shift()

            servers[msg.guild.id].imPlaying = false

            if (servers[msg.guild.id].queue.length > 0) {
                playMusic(msg)
            }
            else {
                servers[msg.guild.id].dispatcher = null
            }
        })
    }
}

const loadServer = () => {
    fs.readFile('serverList.json', 'utf8', (err, data) => {
        if (err) {
            console.log('Error reading server list')
            console.log(err)
        } else {
            const objRead = JSON.parse(data)
            for (let i in objRead.servers) {
                servers[objRead.servers[i]] = {
                    connection: null,
                    dispatcher: null,
                    queue: [],
                    imPlaying: false
                }
            }
        }
    })
}

const saveServer = (idNewServer) => {
    fs.readFile('serverList.json', 'utf8', (err, data) => {
        if (err) {
            console.log('There was an error reading the file')
            console.log(err)
        } else {
            const objRead = JSON.parse(data)
            objRead.servers.push(idNewServer)
            const objWrite = JSON.stringify(objRead)

            fs.writeFile('serverList.Json', objWrite, 'utf8', () => { })
        }
    })
}
client.login(configs.TOKEN_DISCORD)