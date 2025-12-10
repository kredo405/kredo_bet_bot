require('dotenv').config();
const { OpenRouter } = require('@openrouter/sdk');

const apiKey = process.env.OPENROUTER_API_KEY;

// Проверка наличия ключа API
if (!apiKey) {
    console.error('Ошибка: OPENROUTER_API_KEY не найден. Пожалуйста, добавьте его в ваш .env файл.');
    process.exit(1);
}

const openRouter = new OpenRouter({
  apiKey: apiKey,
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/gemini-cli-agent/kredo-bet-bot',
    'X-Title': 'Kredo Bet Bot',
  },
});

/**
 * Отправляет промт в OpenRouter и получает ответ
 * @param {string} prompt - Промт для модели
 * @returns {Promise<string>} - Ответ от модели
 */
async function getPrediction(prompt) {
    const model = "google/gemini-2.5-flash-lite"; // Corrected model ID

    try {
        const completion = await openRouter.chat.send({
            model: model,
            messages: [
                { role: 'user', content: prompt }
            ],
            stream: false,
        });

        if (completion && completion.choices && completion.choices.length > 0) {
            const modelResponse = completion.choices[0].message.content;
            console.log("Ответ от модели:", modelResponse);
            return modelResponse;
        } else {
            console.error("Ответ от OpenRouter API не содержит ожидаемых данных:", completion);
            throw new Error("Не удалось получить корректный ответ от OpenRouter.");
        }
    } catch (error) {
        console.error("Ошибка при запросе к OpenRouter API:", error);
        throw new Error("Не удалось получить ответ от OpenRouter.");
    }
}

module.exports = { getPrediction };
