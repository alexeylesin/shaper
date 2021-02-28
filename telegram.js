const fetch = require('node-fetch');
const http = require('http');

function makeid(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(process.env.TG_TOKEN, { polling: true });

bot.on('message', (message) => {
    const chatId = message.chat.id;
    if(!message.text.startsWith(process.env.TG_PREFIX) || message.from.is_bot) return;
    if(!process.env.TG_ALLOWED_USERS.includes(message.from.id)) return;
    
    const args = message.text.slice(process.env.TG_PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    if(command == "help") {
        let text = [
            `Ой, п-привет, ${message.from.first_name}! Вот что я умею:`,
            `• ${process.env.TG_PREFIX + "links"} | ${process.env.SHAPER_URL}/auth`,
            `• ${process.env.TG_PREFIX + "short"} <код/"random"> <ссылка> | Сократить обычную дырнет-ссылку [без кода/с кодом]`,
            `• ${process.env.TG_PREFIX + "code"} <код> | Просмотр информации о коде сокращённой ссылки`,
            `• ${process.env.TG_PREFIX + "delete"} <код> | Удалить ссылку из базы`,
            ``,
            `Linkshaper API URI: ${process.env.SHAPER_URL}`
        ];

        return bot.sendMessage(chatId, text.join("\n"));
    }

    if(command == "links") return bot.sendMessage(chatId, `Все ссылки находятся тут: ${process.env.SHAPER_URL}/auth`);
    if(command == "short") {
        let code = args[0];
        if(!code) return bot.sendMessage(chatId, `❌ Не указан код короткой ссылки`);
        if(code == "random") code = makeid(6);

        let link = args.slice(1).join(" ");
        if(!link) return bot.sendMessage(chatId, `❌ Не указана ссылка`);

        return fetch( encodeURI(`${process.env.SHAPER_URL}/api/create?code=${code}&link=${link}&access_token=${process.env.SHAPER_TOKEN}`) )
            .then(r => r.json())
            .then(r => bot.sendMessage(chatId, (r.created && r.created == true) ? `✅ Ссылка создана!\n${process.env.SHAPER_URL}/${code}` : `❌ Неизвестная ошибка\n${JSON.stringify(r)}`))
            .catch(e => {
                console.error(e.stack);
                return bot.sendMessage(chatId, `❌ Ошибка ${e.code}`);
            });
    }

    if(command == "code") {
        let code = args[0];
        if(!code) return bot.sendMessage(chatId, `❌ Не указан код короткой ссылки`);
        
        return fetch( encodeURI(`${process.env.SHAPER_URL}/api/code?code=${code}&access_token=${process.env.SHAPER_TOKEN}`) )
            .then(r => r.json())
            .then(r => bot.sendMessage(chatId, (!r.error) ? [
                `ID в базе: ${r.id}`,
                `Код: ${r.code} | ${process.env.SHAPER_URL}/${r.code}`,
                `Оригинальная ссылка: ${r.link}`,
                `Дата создания: ${r.createdAt}`,
                `Кликов: ${r.clicks}`,
                `Владелец ссылки: [Discord ID] ${r.owner}`,
                `Возможно удаление?: ${(r.isDeletable == true) ? `✅` : `❌`}`
            ].join("\n") : `❌ Неизвестная ошибка\n${JSON.stringify(r)}`))
            .catch(e => {
                console.error(e.stack);
                return bot.sendMessage(chatId, `❌ Ошибка ${e.code}`);
            });
    }

    if(command == "delete") {
        let code = args[0];
        if(!code) return bot.sendMessage(chatId, `❌ Не указан код короткой ссылки`);
        
        return fetch( encodeURI(`${process.env.SHAPER_URL}/api/delete?code=${code}&access_token=${process.env.SHAPER_TOKEN}`) )
            .then(r => r.json())
            .then(r => bot.sendMessage(chatId, (!r.error) ? `✅ Ссылка удалена.` : `❌ Неизвестная ошибка\n${JSON.stringify(r)}`))
            .catch(e => {
                console.error(e.stack);
                return bot.sendMessage(chatId, `❌ Ошибка ${e.code}`);
            });
    }
});