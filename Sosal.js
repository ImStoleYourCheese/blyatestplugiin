import { ApplicationCommandOptionType } from "@vendetta/api";
import { GuildStore, ChannelStore, GuildMemberStore, UserStore } from "@vendetta/stores";

// Битовые маски всех прав Дискорда (BigInt, т.к. их больше 32)
const P = {
    ADMINISTRATOR: 1n << 3n,
    MANAGE_GUILD: 1n << 5n,
    MANAGE_CHANNELS: 1n << 4n,
    KICK_MEMBERS: 1n << 1n,
    BAN_MEMBERS: 1n << 2n,
    MANAGE_ROLES: 1n << 28n,
    MANAGE_WEBHOOKS: 1n << 29n,
    VIEW_AUDIT_LOG: 1n << 7n,
    VIEW_CHANNEL: 1n << 10n,
    SEND_MESSAGES: 1n << 11n,
    SEND_TTS_MESSAGES: 1n << 12n,
    MANAGE_MESSAGES: 1n << 13n,
    EMBED_LINKS: 1n << 14n,
    ATTACH_FILES: 1n << 15n,
    READ_MESSAGE_HISTORY: 1n << 16n,
    MENTION_EVERYONE: 1n << 17n,
    USE_EXTERNAL_EMOJIS: 1n << 18n,
    ADD_REACTIONS: 1n << 6n,
    CONNECT: 1n << 20n,
    SPEAK: 1n << 21n,
    MUTE_MEMBERS: 1n << 22n,
    DEAFEN_MEMBERS: 1n << 23n,
    MOVE_MEMBERS: 1n << 24n,
    PRIORITY_SPEAKER: 1n << 8n,
    STREAM: 1n << 9n,
    USE_VAD: 1n << 25n,
    MANAGE_NICKNAMES: 1n << 27n,
    CHANGE_NICKNAME: 1n << 26n,
    MANAGE_EVENTS: 1n << 33n,
    MODERATE_MEMBERS: 1n << 40n,
};

// Названия для вывода (на русском)
const P_NAMES = {
    [P.ADMINISTRATOR]: "👑 Администратор",
    [P.MANAGE_GUILD]: "⚙️ Управлять сервером",
    [P.MANAGE_CHANNELS]: "📁 Управлять каналами",
    [P.MANAGE_ROLES]: "🎭 Управлять ролями",
    [P.MANAGE_WEBHOOKS]: "🔗 Управлять вебхуками",
    [P.KICK_MEMBERS]: "🦾 Кикать",
    [P.BAN_MEMBERS]: "🔨 Банить",
    [P.MODERATE_MEMBERS]: "⏳ Тайм-ауты",
    [P.VIEW_AUDIT_LOG]: "📜 Журнал аудита",
    [P.VIEW_CHANNEL]: "👀 Видеть канал",
    [P.SEND_MESSAGES]: "💬 Писать сообщения",
    [P.SEND_MESSAGES_IN_THREADS]: "🧵 Писать в ветках",
    [P.MANAGE_MESSAGES]: "🗑️ Управлять сообщениями",
    [P.READ_MESSAGE_HISTORY]: "📖 Читать историю",
    [P.EMBED_LINKS: 1n << 14n]: "🖼️ Встраивать ссылки",
    [P.ATTACH_FILES]: "📎 Прикреплять файлы",
    [P.MENTION_EVERYONE]: "🔊 Упоминать @everyone",
    [P.USE_EXTERNAL_EMOJIS]: "🥳 Внешние эмодзи",
    [P.ADD_REACTIONS]: "🤩 Ставить реакции",
    [P.CONNECT]: "📞 Подключаться к голосовому",
    [P.SPEAK]: "🎙️ Говорить в голосовом",
    [P.STREAM: 1n << 9n]: "🖥️ Трансляции",
    [P.PRIORITY_SPEAKER]: "🔔 Приоритетный режим",
    [P.MUTE_MEMBERS]: "🔇 Мутить (в войсе)",
    [P.DEAFEN_MEMBERS]: "👂 Заглушать",
    [P.MOVE_MEMBERS]: "➡️ Перемещать",
    [P.USE_VAD]: "⚡ Активация по голосу",
    [P.MANAGE_NICKNAMES]: "✏️ Менять ники",
    [P.CHANGE_NICKNAME]: "✏️ Менять свой ник",
};

// Вычисление итоговых прав
function computePerms(guild, member, channel) {
    if (guild.ownerId === member.userId) {
        return Object.values(P).reduce((a, b) => a | b, 0n); // Все права
    }

    let perms = BigInt(guild.roles[guild.id]?.permissions || 0n); // Права @everyone
    for (const roleId of member.roles) {
        perms |= BigInt(guild.roles[roleId]?.permissions || 0n);
    }

    if (perms & P.ADMINISTRATOR) {
        return Object.values(P).reduce((a, b) => a | b, 0n); // Все права
    }

    if (channel && channel.permissionOverwrites) {
        const overwrites = channel.permissionOverwrites;
        
        // 1. Применяем @everyone
        if (overwrites[guild.id]) {
            perms &= ~BigInt(overwrites[guild.id].deny || 0n);
            perms |= BigInt(overwrites[guild.id].allow || 0n);
        }
        
        // 2. Применяем роли пользователя
        let roleAllow = 0n, roleDeny = 0n;
        for (const roleId of member.roles) {
            if (overwrites[roleId]) {
                roleAllow |= BigInt(overwrites[roleId].allow || 0n);
                roleDeny |= BigInt(overwrites[roleId].deny || 0n);
            }
        }
        perms &= ~roleDeny;
        perms |= roleAllow;
        
        // 3. Применяем персональные исключения (member overrides)
        if (overwrites[member.userId]) {
            perms &= ~BigInt(overwrites[member.userId].deny || 0n);
            perms |= BigInt(overwrites[member.userId].allow || 0n);
        }
    }

    return perms;
}

export default {
    onLoad: () => console.log("Permission Matrix loaded!"),
    commands: [
        {
            name: "perms",
            displayName: "perms",
            description: "Матрица прав: показывает реальные права юзера в текущем канале",
            type: 1,
            options: [
                {
                    name: "user",
                    displayName: "user",
                    description: "Чьи права проверяем?",
                    type: ApplicationCommandOptionType.USER,
                    required: true
                }
            ],
            execute: (args, ctx) => {
                try {
                    const userArg = args.find(a => a.name === "user");
                    if (!userArg) return { content: "Укажи пользователя." };

                    const userId = userArg.value;
                    const guildId = ctx.guild?.id;
                    const channelId = ctx.channel?.id;

                    if (!guildId) return { content: "Эту команду можно использовать только на сервере." };

                    const guild = GuildStore.getGuild(guildId);
                    const member = GuildMemberStore.getMember(guildId, userId);
                    const channel = channelId ? ChannelStore.getChannel(channelId) : null;
                    const user = UserStore.getUser(userId);

                    if (!guild || !member) return { content: "Не удалось найти данные участника." };

                    const computedPerms = computePerms(guild, member, channel);

                    let message = `### 🛡️ Матрица прав: ${user.username} (в #${channel?.name || "сервере"})\n\n`;
                    
                    // Категории
                    const categories = {
                        "🛑 Администрация": [P.ADMINISTRATOR, P.MANAGE_GUILD, P.MANAGE_CHANNELS, P.MANAGE_ROLES, P.MANAGE_WEBHOOKS, P.VIEW_AUDIT_LOG],
                        "🔨 Модерация": [P.KICK_MEMBERS, P.BAN_MEMBERS, P.MODERATE_MEMBERS, P.MANAGE_MESSAGES, P.MANAGE_NICKNAMES],
                        "💬 Текст": [P.VIEW_CHANNEL, P.SEND_MESSAGES, P.READ_MESSAGE_HISTORY, P.EMBED_LINKS, P.ATTACH_FILES, P.MENTION_EVERYONE, P.USE_EXTERNAL_EMOJIS, P.ADD_REACTIONS],
                        "🔊 Голос": [P.CONNECT, P.SPEAK, P.STREAM, P.PRIORITY_SPEAKER, P.MUTE_MEMBERS, P.DEAFEN_MEMBERS, P.MOVE_MEMBERS, P.USE_VAD],
                        "👤 Личное": [P.CHANGE_NICKNAME]
                    };

                    // Если админ — сразу выводим
                    if (computedPerms & P.ADMINISTRATOR) {
                        return { content: `### 🛡️ Матрица прав: ${user.username}\n\n👑 **У этого пользователя есть права Администратора.**\nДля него игнорируются все локальные запреты и исключения каналов.` };
                    }

                    for (const [catName, permKeys] of Object.entries(categories)) {
                        let allowed = [];
                        let denied = [];

                        permKeys.forEach(key => {
                            if (key === P.SEND_MESSAGES_IN_THREADS || key === P.STREAM) {
                                // Пропускаем дубликаты, которые не в P_NAMES
                                return;
                            }
                            const name = P_NAMES[key];
                            if (!name) return;

                            if (computedPerms & key) {
                                allowed.push(name);
                            } else {
                                denied.push(name);
                            }
                        });

                        if (allowed.length > 0 || denied.length > 0) {
                            message += `**${catName}**\n`;
                            if (allowed.length > 0) message += `✅ ${allowed.join("\n✅ ")}\n`;
                            if (denied.length > 0) message += `❌ ${denied.join("\n❌ ")}\n`;
                            message += `\n`;
                        }
                    }

                    if (message.length > 2000) {
                        message = message.substring(0, 1990) + "...";
                    }

                    return { content: message };
                } catch (e) {
                    console.error("Matrix error", e);
                    return { content: "Произошла ошибка при вычислении прав." };
                }
            }
        }
    ],
    onUnload: () => console.log("Permission Matrix unloaded.")
};
