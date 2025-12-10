// Точка входа для вашего телеграм-бота
require('dotenv').config();
process.env.NTBA_FIX_350 = "1";
const TelegramBot = require('node-telegram-bot-api');
const { handleStartCommand } = require('./bot/commands');
const { setupHandlers } = require('./bot/handlers');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
    console.error('Ошибка: TELEGRAM_BOT_TOKEN не найден. Пожалуйста, добавьте его в ваш .env файл.');
    process.exit(1);
}

// Инициализация бота в режиме опроса (polling)
const bot = new TelegramBot(token, { polling: true });

// Хранилище состояний разговоров для каждого чата
const conversationState = new Map();

// Настройка обработчиков команд
handleStartCommand(bot);

// Настройка обработчиков сообщений и колбэков
setupHandlers(bot, conversationState);


console.log('Бот успешно запущен в режиме опроса...');