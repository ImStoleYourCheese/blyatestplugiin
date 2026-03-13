/**
 * @name PplSearch
 * @description Поиск участников с двумя ролями
 * @version 1.1
 * @author You
 * @updateUrl https://raw.githubusercontent.com/ImStoleYourCheese/blyatestplugiin/main/pplsearch.plugin.js
 */

module.exports = class PplSearch {
    getName() { return "PplSearch"; }
    getDescription() { return "/pplsearch <role1_id> <role2_id>"; }
    getVersion() { return "1.0"; }
    getAuthor() { return "You"; }

    start() {
        if (window.BdApi?.Commands?.registerCommand) {
            window.BdApi.Commands.registerCommand({
                command: "pplsearch",
                description: "Найти участников с двумя ролями",
                usage: "/pplsearch <ID_роли_1> <ID_роли_2>",
                executor: this.run.bind(this)
            });
        }
    }

    stop() {
        if (window.BdApi?.Commands?.unregisterCommand) {
            window.BdApi.Commands.unregisterCommand("pplsearch");
        }
    }

    async run(args, msg) {
        const [role1Id, role2Id] = args;
        const guildId = msg.guild_id;
        const channelId = msg.channel_id;

        if (!guildId) {
            this.send(channelId, "Только для серверов");
            return;
        }

        // Получаем модули через BdApi
        const Modules = BdApi.Webpack.getModule(m => m.RoleStore && m.GuildMemberStore, { searchExports: true });
        if (!Modules) {
            this.send(channelId, "Не удалось загрузить модули");
            return;
        }

        const { RoleStore, GuildMemberStore, UserStore } = Modules;
        const MessageActions = BdApi.Webpack.getModule(m => m.sendMessage, { searchExports: true });

        const role1 = RoleStore?.getRole?.(role1Id);
        const role2 = RoleStore?.getRole?.(role2Id);

        if (!role1 || !role2) {
            this.send(channelId, "Роль не найдена");
            return;
        }

        const result = await this.send(channelId, "Поиск...");
        if (!result) return;

        const members = GuildMemberStore?.getMembers?.(guildId);
        if (!members || typeof members !== "object") {
            this.edit(channelId, result.id, "Не удалось получить участников");
            return;
        }

        const found = [];
        const ids = Object.keys(members);

        for (let i = 0; i < ids.length; i++) {
            const m = members[ids[i]];
            if (Array.isArray(m?.roles) && m.roles.includes(role1Id) && m.roles.includes(role2Id)) {
                found.push(m);
            }
            if (found.length % 10 === 0 && found.length > 0) {
                this.edit(channelId, result.id, `Найдено: ${found.length}`);
            }
            await new Promise(r => setTimeout(r, 5));
        }

        if (found.length === 0) {
            this.edit(channelId, result.id, "Никого не найдено");
            return;
        }

        let text = `Найдено: ${found.length}\n\n`;
        for (let i = 0; i < found.length; i++) {
            const m = found[i];
            const u = UserStore?.getUser?.(m.user_id);
            const name = u?.username || u?.global_name || m.nick || "Unknown";
            text += `${i + 1}. <@${m.user_id}> (${name})\n`;
            if ((i + 1) % 5 === 0) {
                this.edit(channelId, result.id, text + "\nЗагрузка...");
                await new Promise(r => setTimeout(r, 30));
            }
        }
        this.edit(channelId, result.id, text);
    }

    async send(channelId, content) {
        const MessageActions = BdApi.Webpack.getModule(m => m.sendMessage, { searchExports: true });
        const ChannelStore = BdApi.Webpack.getModule(m => m.getChannel, { searchExports: true });
        if (!MessageActions || !ChannelStore) return null;
        const res = await MessageActions.sendMessage({
            channelId,
            content,
            tts: false,
            invalidEmotes: []
        });
        return res?.message || res;
    }

    async edit(channelId, messageId, content) {
        const MessageActions = BdApi.Webpack.getModule(m => m.editMessage, { searchExports: true });
        if (!MessageActions) return;
        await MessageActions.editMessage(channelId, messageId, {
            content,
            invalidEmotes: []
        });
    }
};
