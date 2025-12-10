const handleStartCommand = (bot) => {
    bot.onText(/^\/start$/, (msg) => {
        const opts = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Сегодня', callback_data: 'date_0' },
                        { text: 'Завтра', callback_data: 'date_1' }
                    ]
                ]
            }
        };
        bot.sendMessage(msg.chat.id, "Добро пожаловать! Выберите дату для получения списка матчей:", opts);
    });
};

module.exports = {
    handleStartCommand,
};