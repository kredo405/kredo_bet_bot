const fs = require('fs/promises');
const path = require('path');

const { getPrediction } = require('../services/llm');
const { getMatchesFromApi, getOddsHistoryFromApi, getEventPageData, getSofascoreMatches, getSofascoreLineups, getSofascorePregameForm, getStatshubEvents, getStatshubTeamPerformance, getTeamTournaments, getStatshubPlayerPerformance } = require('../services/api');
const { launchBrowser, closeBrowser } = require('../services/browser');
const { getTimestampForDate, getFbrefDateString, getStartOfDayTimestampSeconds, getEndOfDayTimestampSeconds } = require('../utils/dates');
const { generateFinalPrompt } = require('./prompt');
const { calculateOutcomeProbabilities } = require('../utils/poisson');
const { oddsData } = require('../services/database');
const { scrapeMatchesByDate, scrapeH2H, scrapeWebsite } = require('../services/parser');


const setupHandlers = (bot, conversationState) => {
    // This helper function contains the logic that runs after tournament selection is complete.
    const continueFetchingData = async (chatId, state) => {
        try {
            await bot.sendMessage(chatId, "▶️ Запрос статистики производительности команд с Statshub...");
            const { homeTeam, awayTeam } = state.statshubMatchInfo;
            const homeTournamentId = state.selectedHomeTournamentId;
            const awayTournamentId = state.selectedAwayTournamentId;

            const processPerformanceData = (performanceData) => {
                if (!performanceData || !performanceData.data) return [];
                return performanceData.data.slice(0, 7).map(el => ({
                    eventId: el.event.id, // Save the eventId
                    homeTeam: el.homeTeam.name, awayTeam: el.awayTeam.name, scoreHome: el.event.score.home, scoreAway: el.event.score.away,
                    statistics: {
                        expectedGoals: el.statistics.expectedGoals, bigChanceCreated: el.statistics.bigChanceCreated, bigChanceMissed: el.statistics.bigChanceMissed,
                        bigChanceScored: el.statistics.bigChanceScored, totalShotsInsideBox: el.statistics.totalShotsInsideBox, totalShotsOutsideBox: el.statistics.totalShotsOutsideBox,
                        touchesInOppBox: el.statistics.touchesInOppBox, finalThirdEntries: el.statistics.finalThirdEntries, goalsPrevented: el.statistics.goalsPrevented,
                        ballPossession: el.statistics.ballPossession, aerialDuelsPercentage: el.statistics.aerialDuelsPercentage, duelWonPercent: el.statistics.duelWonPercent,
                        interceptionWon: el.statistics.interceptionWon, totalTackle: el.statistics.totalTackle, wonTacklePercent: el.statistics.wonTacklePercent,
                        pass_accuracy: el.statistics.pass_accuracy, accuratePasses: el.statistics.accuratePasses, errorsLeadToGoal: el.statistics.errorsLeadToGoal
                    },
                    opponentStatistics: {
                        expectedGoals: el.opponentStatistics.expectedGoals, bigChanceCreated: el.statistics.bigChanceCreated, bigChanceMissed: el.statistics.bigChanceMissed,
                        bigChanceScored: el.statistics.bigChanceScored, totalShotsInsideBox: el.statistics.totalShotsInsideBox, totalShotsOutsideBox: el.statistics.totalShotsOutsideBox,
                        touchesInOppBox: el.statistics.touchesInOppBox, finalThirdEntries: el.statistics.finalThirdEntries, goalsPrevented: el.statistics.goalsPrevented,
                        ballPossession: el.statistics.ballPossession, aerialDuelsPercentage: el.statistics.aerialDuelsPercentage, duelWonPercent: el.statistics.duelWonPercent,
                        interceptionWon: el.statistics.interceptionWon, totalTackle: el.statistics.totalTackle, wonTacklePercent: el.statistics.wonTacklePercent,
                        pass_accuracy: el.statistics.pass_accuracy, errorsLeadToGoal: el.opponentStatistics.errorsLeadToGoal
                    }
                }));
            };

            const homePerformanceData = await getStatshubTeamPerformance(homeTeam.id, homeTournamentId);
            const awayPerformanceData = await getStatshubTeamPerformance(awayTeam.id, awayTournamentId);
            state.statshubHomePerformance = processPerformanceData(homePerformanceData);
            state.statshubAwayPerformance = processPerformanceData(awayPerformanceData);
            await bot.sendMessage(chatId, "✅ Успешно! Статистика производительности команд получена.");

            // --- NEW: AI-POWERED PERFORMANCE ANALYSIS ---
            const getPerformanceAnalysis = async (teamName, performanceData) => {
                if (!performanceData || performanceData.length === 0) {
                    return "Нет данных для анализа.";
                }

                const analysisPrompt = `
Ты — элитный футбольный аналитик. Тебе предоставлены данные о последних матчах команды "${teamName}".
Каждый матч содержит счет, ключевую статистику команды и статистику ее соперника.

Данные:
json
${JSON.stringify(performanceData, null, 2)}


Твоя задача — написать подробное, но структурированное резюме (4-5 предложений) об игровой форме и стиле команды.

Проанализируй следующие аспекты:
1.  **Результаты и стабильность:** Как команда выступала? Были ли это победы над сильными соперниками или поражения от аутсайдеров? Укажи, с кем играли.
2.  **Атакующий стиль:** На чем строится атака? Создают ли много моментов (высокий xG)? Как обстоят дела с реализацией (сравни голы и xG)? Есть ли зависимость от определенного типа атак (например, через фланги, если много касаний в штрафной)?
3.  **Оборонительная надежность:** Насколько надежна оборона? Много ли допускают моментов у своих ворот (xG соперника)? Какие слабые места были заметны в прошлых играх (например, "проблемы при стандартах", "уязвимость к контратакам")?
4.  **Общий вывод:** Сформулируй итоговый вывод о текущем состоянии команды. Какие у нее сильные стороны, а какие проблемы могут проявиться в следующей игре?

Стиль ответа должен быть профессиональным, аналитическим, без "воды".
Не просто перечисляй цифры, а интерпретируй их, чтобы дать глубокое понимание игры команды.
`;
                try {
                    const analysis = await getPrediction(analysisPrompt);
                    return analysis;
                } catch (e) {
                    console.error(`Ошибка при генерации AI-анализа для ${teamName}:`, e);
                    return `Не удалось сгенерировать анализ для ${teamName}.`;
                }
            };

            await bot.sendMessage(chatId, "▶️ ИИ анализирует игровую форму команд...");
            state.homePerformanceAnalysis = await getPerformanceAnalysis(homeTeam.name, state.statshubHomePerformance);
            state.awayPerformanceAnalysis = await getPerformanceAnalysis(awayTeam.name, state.statshubAwayPerformance);
            await bot.sendMessage(chatId, "✅ Успешно! Анализ игровой формы завершен.");


            // --- POISSON PROBABILITY CALCULATION ---
            await bot.sendMessage(chatId, "▶️ Расчет вероятностей исходов по модели Пуассона...");
            try {
                const homePerf = state.statshubHomePerformance;
                const awayPerf = state.statshubAwayPerformance;

                if (!homePerf || homePerf.length === 0 || !awayPerf || awayPerf.length === 0) {
                    throw new Error("Недостаточно данных о производительности команд для расчета Пуассона.");
                }

                const homeTeamStats = {
                    home_xg_for: homePerf.reduce((sum, game) => sum + (parseFloat(game.statistics.expectedGoals) || 0), 0),
                    home_xg_against: homePerf.reduce((sum, game) => sum + (parseFloat(game.opponentStatistics.expectedGoals) || 0), 0),
                    home_games: homePerf.length
                };

                const awayTeamStats = {
                    away_xg_for: awayPerf.reduce((sum, game) => sum + (parseFloat(game.statistics.expectedGoals) || 0), 0),
                    away_xg_against: awayPerf.reduce((sum, game) => sum + (parseFloat(game.opponentStatistics.expectedGoals) || 0), 0),
                    away_games: awayPerf.length
                };

                const { marketProbabilities, scoreProbabilities } = calculateOutcomeProbabilities(homeTeamStats, awayTeamStats, oddsData);

                state.poissonProbabilities = marketProbabilities;
                state.poissonScoreProbabilities = scoreProbabilities; // Store score probabilities
                await bot.sendMessage(chatId, "✅ Успешно! Вероятности по Пуассону рассчитаны.");

            } catch (e) {
                console.error("Ошибка при расчете вероятностей по Пуассону:", e);
                await bot.sendMessage(chatId, `⚠️ Произошла ошибка при расчете вероятностей по Пуассону: ${e.message}`);
                state.poissonProbabilities = {}; // Ensure it's an empty object on failure
                state.poissonScoreProbabilities = {}; // Also initialize this
            }
            // --- END POISSON CALCULATION ---


            // --- NEW PLAYER PERFORMANCE LOGIC ---
            try {
                await bot.sendMessage(chatId, "▶️ Запрос детальной статистики игроков с Statshub...");
                const fixtureId = state.selectedMatch.eventId;

                const [homePlayerPerf, awayPlayerPerf] = await Promise.all([
                    getStatshubPlayerPerformance(homeTeam.id, homeTournamentId, fixtureId),
                    getStatshubPlayerPerformance(awayTeam.id, awayTournamentId, fixtureId)
                ]);

                const processPlayerData = (playerData) => {
                    if (!playerData || !playerData.data || !playerData.events || playerData.events.length === 0) {
                        return [];
                    }

                    const recentMatchIds = playerData.events
                        .filter(event => event.events && event.events.id && event.events.timeStartTimestamp)
                        .map(event => ({ id: event.events.id, timestamp: event.events.timeStartTimestamp }))
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .slice(0, 5)
                        .map(event => String(event.id));

                    const recentMatchIdsSet = new Set(recentMatchIds);

                    return playerData.data.map(player => {
                        const playerStatsByFixture = player.stats || {};

                        const summedStats = {};
                        let gamesPlayed = 0;

                        const forwardStats = ["expectedGoals", "npExpectedGoals", "expectedAssists", "keyPass", "shots", "onTargetScoringAttempt", "accuratePass", "totalPass", "touches", "possessionLostCtrl", "dispossessed", "xGxA", "rating", "minutesPlayed"];
                        const defenderStats = ["accurateLongBalls", "keyPass", "accuratePass", "possessionLostCtrl", "dispossessed", "totalTackle", "interceptionWon", "totalClearance", "blockedScoringAttempt", "aerialWon", "duelWon", "xGxA", "rating", "minutesPlayed"];
                        const goalieStats = ["rating", "minutesPlayed", "saves", "accurateLongBalls"];

                        let statsToProcess = [];
                        if (player.position === 'M' || player.position === 'F') {
                            statsToProcess = forwardStats;
                        } else if (player.position === 'D') {
                            statsToProcess = defenderStats;
                        } else if (player.position === 'G') {
                            statsToProcess = goalieStats;
                        }

                        recentMatchIdsSet.forEach(matchId => {
                            if (playerStatsByFixture[matchId]) {
                                gamesPlayed++;
                                const matchStats = playerStatsByFixture[matchId];

                                statsToProcess.forEach(statName => {
                                    if (matchStats[statName] !== undefined && matchStats[statName] !== null) {
                                        if (!summedStats[statName]) {
                                            summedStats[statName] = 0;
                                        }
                                        summedStats[statName] += parseFloat(matchStats[statName]);
                                    }
                                });
                            }
                        });

                        const averagedStats = {};
                        if (gamesPlayed > 0) {
                            for (const statName in summedStats) {
                                averagedStats[statName] = (summedStats[statName] / gamesPlayed).toFixed(2);
                            }
                        }

                        return {
                            name: player.name,
                            position: player.position,
                            gamesPlayedInLast5: gamesPlayed,
                            statistics: averagedStats,
                        };
                    });
                };

                const processedHomePlayers = processPlayerData(homePlayerPerf);
                const processedAwayPlayers = processPlayerData(awayPlayerPerf);

                // Save processed player data to state
                state.processedHomePlayers = processedHomePlayers;
                state.processedAwayPlayers = processedAwayPlayers;

                await bot.sendMessage(chatId, "✅ Успешно! Детальная статистика игроков посчитана и выведена в консоль.");

            } catch (e) {
                console.error("Ошибка при запросе или обработке детальной статистики игроков:", e);
                await bot.sendMessage(chatId, "⚠️ Произошла ошибка при получении детальной статистики игроков.");
            }
            // --- END NEW PLAYER PERFORMANCE LOGIC ---

            const { dayOffset, match: matchTitle } = state;
            const apiTimestamp = getTimestampForDate(dayOffset);
            await bot.sendMessage(chatId, "▶️ Запрос матчей из API nb-bet...");
            const apiMatches = await getMatchesFromApi(apiTimestamp);

            if (!apiMatches || !apiMatches.data || !apiMatches.data.leagues) {
                throw new Error("Не удалось получить данные о матчах из API nb-bet или структура данных неверна.");
            }
            await bot.sendMessage(chatId, "✅ Матчи из API nb-bet получены.");

            const transformedLeagues = apiMatches.data.leagues.map(el => ({
                league: el['3'], country: el["1"], matches: el["4"].map(item => ({ link: item["3"], homeTeam: item["7"], awayTeam: item["15"] }))
            }));
            const allowedLeagues = new Set(['Лига Чемпионов', 'Чемпионшип', 'Премьер-Лига', 'Бундеслига', 'Примера', 'Серия А', 'Эредивизи', 'Примейра', 'Лига 1', 'Лига Европы', 'Лига Конференций']);
            const filteredLeagues = transformedLeagues.filter(l => allowedLeagues.has(l.league));

            const prompt = `
    Вот JSON с футбольными матчами. Поле 'link' содержит готовый для URL путь.
    json
    ${JSON.stringify(filteredLeagues, null, 2)}
    


    Тебе нужно найти один матч из JSON, который семантически соответствует английскому названию: "${matchTitle}".
    В JSON предоставлены матчи с русскими названиями команд. Тебе нужно сопоставить английские и русские названия. Например, "FC Bayern München" из 'matchTitle' соответствует "Бавария Мюнхен" в JSON.
    
    Твоя задача — вернуть **точное, неизменённое** значение из поля 'link' найденного матча.
    **КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА:**
    1. Твой ответ ДОЛЖЕН быть ТОЛЬКО значением из поля 'link', начиная с '/'.
    2. **ЗАПРЕЩЕНО** добавлять любые объяснения или форматирование.
    Если матч не найден, твой ответ должен быть ТОЧНО таким: матч_не_найден`;

            await bot.sendMessage(chatId, "▶️ ИИ ищет ссылку на матч в nb-bet.com...");
            const link = await getPrediction(prompt); const cleanedLink = link.replace(/```/g, '').trim();

            let finalLink = cleanedLink;
            if (!finalLink.startsWith('/') && /^[0-9]/.test(finalLink)) {
                finalLink = `/LiveEvents/${finalLink}`;
            }

            if (finalLink !== 'матч_не_найден' && finalLink.startsWith('/')) {
                await bot.sendMessage(chatId, `✅ ИИ успешно нашел ссылку на матч в nb-bet.com.`);
                await bot.sendMessage(chatId, `✅ Шаг 2/4: Ссылка на nb-bet найдена: https://nb-bet.com${finalLink}`);
                const matchId = finalLink.replace('/LiveEvents/', '');

                await bot.sendMessage(chatId, "▶️ Запрос истории коэффициентов из nb-bet...");
                const oddsHistoryData = await getOddsHistoryFromApi(matchId);
                if (oddsHistoryData && oddsHistoryData.data) {
                    state.rawOddsHistory = oddsHistoryData.data;
                    await bot.sendMessage(chatId, `✅ Успешно! История коэффициентов получена.`);
                } else {
                    await bot.sendMessage(chatId, `⚠️ Не удалось получить историю коэффициентов из nb-bet.`);
                }

                await bot.sendMessage(chatId, "▶️ Запрос дополнительных данных (погода, факты) из nb-bet...");
                const eventPageData = await getEventPageData(matchId);
                if (eventPageData && eventPageData.data && eventPageData.data.match) {
                    const matchData = eventPageData.data.match;
                    if (matchData["18"]) state.weather = { temp: matchData["18"]["3"], condition: matchData["18"]["4"] };
                    const factsRaw = matchData["27"] ? matchData["27"]["3"] : [];
                    if (factsRaw.length > 0) {
                        const cleanedFacts = factsRaw.map(factObj => factObj["1"].replace(/<strong>/g, '').replace(/<\/strong>/g, ''));

                        await bot.sendMessage(chatId, "▶️ ИИ анализирует и обрабатывает факты...");

                        const factsProcessingPrompt = `
Ты — опытный спортивный аналитик. Твоя задача — проанализировать сырые факты о предстоящем футбольном матче, выбрать **только самые основные и важные**, и изложить их максимально кратко и емко. Сосредоточься на информации, которая критически важна для принятия решения о ставке. Убери "воду", перефразируй для максимальной полезности. Сохраняй нейтральный и объективный тон. Каждый факт должен быть представлен как элемент маркированного списка, Удалите сухую статистику из фактов, оставьте только психологические/серийные факты.

Вот сырые факты:
"""
${cleanedFacts.join('\n')}
"""

Твой результат должен быть единым текстом, где каждый обработанный факт начинается с "- ". Ответ должен содержать только обработанные факты и ничего больше.
`;

                        const processedFactsText = await getPrediction(factsProcessingPrompt);
                        state.processedFacts = processedFactsText.trim();

                        await bot.sendMessage(chatId, "✅ Факты успешно обработаны ИИ.");
                    }
                    const h2hRaw = matchData["27"] && matchData["27"]["7"] ? matchData["27"]["7"] : [];
                    if (h2hRaw.length > 0) {
                        state.h2hData = h2hRaw.map(el => ({ homeTeam: el["7"], homeGoals: el["10"], awayTeam: el["15"], awayGoals: el["18"] }));
                    }
                    await bot.sendMessage(chatId, `✅ Успешно! Доп. данные (погода, факты, H2H) получены.`);
                } else {
                    await bot.sendMessage(chatId, `⚠️ Не удалось получить дополнительные данные из nb-bet.`);
                }
            } else {
                let errorMessage = `⚠️ ИИ не смог найти ссылку на матч в nb-bet.com.`;
                if (finalLink === 'матч_не_найден') errorMessage += ` Модель вернула: "матч_не_найден".`;
                else if (!finalLink.startsWith('/')) errorMessage += ` Модель вернула неформатированную ссылку: "${finalLink}".`;
                await bot.sendMessage(chatId, errorMessage);
            }

            const sofascoreDateString = getFbrefDateString(dayOffset);
            await bot.sendMessage(chatId, "▶️ Запрос матчей с Sofascore...");
            const sofascoreMatches = await getSofascoreMatches(sofascoreDateString);
            if (sofascoreMatches && sofascoreMatches.length > 0) {
                await bot.sendMessage(chatId, "▶️ ИИ ищет ID матча в Sofascore...");
                const idPrompt =
                    `Вот JSON массив футбольных матчей из Sofascore:
   
    ${JSON.stringify(sofascoreMatches, null, 2)}
   
    Мне нужно, чтобы ты нашел матч, который соответствует этому названию: "${matchTitle}".
    Твоя задача — вернуть ТОЛЬКО значение поля 'id' для наиболее вероятного совпадения. Без объяснений и форматирования.
    Если не можешь найти совпадение, верни строку "id_not_found".`;
                const id = (await getPrediction(idPrompt)).trim();
                if (id && id !== 'id_not_found') {
                    await bot.sendMessage(chatId, `✅ ИИ успешно нашел ID матча в Sofascore: ${id}`);
                    state.sofascoreId = id;
                    await bot.sendMessage(chatId, "▶️ Запрос данных о составах с Sofascore...");
                    const lineupsData = await getSofascoreLineups(id);
                    if (lineupsData) {
                        const processMissing = p => ({
                            type: p.type,
                            description: p.description,
                            player: p.player.name,
                            expectedEndDate: p.expectedEndDate,
                            marketValue: p.player.proposedMarketValueRaw?.value,
                            marketValueCurrency: p.player.proposedMarketValueRaw?.currency
                        });
                        const processSquad = p => ({
                            avgRating: p.avgRating,
                            position: p.position,
                            player: p.player.name,
                            marketValue: p.player.proposedMarketValueRaw?.value,
                            marketValueCurrency: p.player.proposedMarketValueRaw?.currency
                        });
                        state.sofascoreLineups = {
                            home: { formation: lineupsData.home?.formation, missingPlayers: (lineupsData.home?.missingPlayers || []).map(processMissing), squad: (lineupsData.home?.players || []).map(processSquad) },
                            away: { formation: lineupsData.away?.formation, missingPlayers: (lineupsData.away?.missingPlayers || []).map(processMissing), squad: (lineupsData.away?.players || []).map(processSquad) }
                        };
                        await bot.sendMessage(chatId, "✅ Успешно! Данные о составах Sofascore получены.");

                        // Fetch pregame form data
                        await bot.sendMessage(chatId, "▶️ Запрос данных о форме команд с Sofascore...");
                        const pregameFormData = await getSofascorePregameForm(id);
                        if (pregameFormData) {
                            state.sofascorePregameForm = pregameFormData;
                            await bot.sendMessage(chatId, "✅ Успешно! Данные о форме команд получены.");
                        } else {
                            await bot.sendMessage(chatId, "⚠️ Не удалось получить данные о форме команд с Sofascore.");
                        }
                    } else {
                        await bot.sendMessage(chatId, `⚠️ Не удалось получить данные о составах с Sofascore.`);
                    }
                } else {
                    await bot.sendMessage(chatId, `⚠️ ИИ не смог найти ID для матча на Sofascore.`);
                }
            } else {
                await bot.sendMessage(chatId, `⚠️ Не удалось получить список матчей с Sofascore для поиска ID.`);
            }

            state.homeData = {}; state.awayData = {};

            await bot.sendMessage(chatId, `✅ Шаг 4/4: Сбор данных завершен.`);
            state.state = 'awaiting_prompt_type';
            conversationState.set(chatId, state);

            bot.sendMessage(chatId, "Выберите тип промпта для генерации:", { reply_markup: { inline_keyboard: [[{ text: 'Ординар', callback_data: 'prompt_single' }, { text: 'Экспресс', callback_data: 'prompt_express' }]] } });

        } catch (error) {
            console.error('Произошла ошибка в процессе сбора данных:', error);
            await closeBrowser(); // Close browser on error
            bot.sendMessage(chatId, `❌ К сожалению, произошла ошибка: ${error.message}.`);
            conversationState.delete(chatId);
        }
    };


    bot.on('callback_query', async (callbackQuery) => {
        const msg = callbackQuery.message;
        const chatId = msg.chat.id;
        const data = callbackQuery.data;
        const state = conversationState.get(chatId) || {};

        if (data.startsWith('date_')) {
            const dayOffset = parseInt(data.split('_')[1], 10);
            const dayName = ['сегодня', 'завтра', 'послезавтра'][dayOffset] || `дату со смещением ${dayOffset} дней`;

            await bot.answerCallbackQuery(callbackQuery.id);
            await bot.sendMessage(chatId, `Идет поиск матчей на ${dayName}...`);

            try {
                await launchBrowser(); // Launch the browser for this session
                const fbrefDate = getFbrefDateString(dayOffset);
                await bot.sendMessage(chatId, `▶️ Запускаю парсинг матчей с Fbref.com на ${fbrefDate}...`);
                const fbrefMatches = await scrapeMatchesByDate(fbrefDate);
                state.fbrefMatches = fbrefMatches;
                await bot.sendMessage(chatId, `✅ Успешно! ${fbrefMatches.length} лиг с матчами получены с Fbref.com.`);

                const events = await getStatshubEvents(getStartOfDayTimestampSeconds(dayOffset), getEndOfDayTimestampSeconds(dayOffset));
                if (!events || !events.data || events.data.length === 0) return bot.sendMessage(chatId, `На ${dayName} матчей не найдено.`);

                const matches = events.data.map(el => ({ homeTeam: el.homeTeam.name, homeTeamId: el.homeTeam.id, awayTeam: el.awayTeam.name, awayTeamId: el.awayTeam.id, tournament: el.unique_tournaments.name, tournamentId: el.unique_tournaments.id, eventId: el.events.id, refereeId: el.events.refereeId, status: el.events.status }));
                const matchesByTournament = matches.reduce((acc, match) => { (acc[match.tournament] = acc[match.tournament] || []).push(match); return acc; }, {});
                const tournaments = Object.entries(matchesByTournament).map(([name, matches]) => ({ tournamentName: name, matches }));

                state.tournaments = tournaments;
                state.dayOffset = dayOffset;
                conversationState.set(chatId, state);

                if (tournaments.length === 0) return bot.sendMessage(chatId, `На ${dayName} матчей не найдено.`);
                await bot.sendMessage(chatId, `Отлично! Вот матчи на ${dayName}. Выберите один для анализа:`);
                for (const [i, t] of tournaments.entries()) {
                    await bot.sendMessage(chatId, `⚽️ ${t.tournamentName} ⚽️`);
                    await bot.sendMessage(chatId, 'Выберите матч:', { reply_markup: { inline_keyboard: t.matches.map((m, mi) => ([{ text: `${m.homeTeam} - ${m.awayTeam}`, callback_data: `match_select_${i}_${mi}` }])) } });
                }
            } catch (error) {
                console.error(`Произошла ошибка при получении матчей для смещения ${dayOffset}:`, error);
                await closeBrowser(); // Close browser on error
                bot.sendMessage(chatId, "К сожалению, произошла ошибка при получении матчей. Пожалуйста, попробуйте позже.");
            }

        } else if (data.startsWith('match_select_')) {
            if (!state.tournaments) return bot.answerCallbackQuery(callbackQuery.id, { text: "Произошла ошибка, данные о матчах устарели. Начните заново.", show_alert: true });

            await bot.answerCallbackQuery(callbackQuery.id);
            await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: msg.chat.id, message_id: msg.message_id }).catch(() => { });

            const [, , tournamentIndex, matchIndex] = data.split('_').map(Number);
            const selectedMatch = state.tournaments[tournamentIndex]?.matches[matchIndex];

            if (!selectedMatch) return bot.sendMessage(chatId, "Не удалось найти выбранный матч. Пожалуйста, начните заново.");

            state.selectedMatch = selectedMatch;
            state.match = `${selectedMatch.homeTeam} vs ${selectedMatch.awayTeam} (${selectedMatch.tournament})`;
            state.statshubMatchInfo = { homeTeam: { id: selectedMatch.homeTeamId, name: selectedMatch.homeTeam }, awayTeam: { id: selectedMatch.awayTeamId, name: selectedMatch.awayTeam } };

            await bot.sendMessage(chatId, `Вы выбрали матч: ${state.match}.`);

            // Find the corresponding match from fbref.com data using AI
            if (state.fbrefMatches && state.fbrefMatches.length > 0) {
                await bot.sendMessage(chatId, "▶️ ИИ ищет соответствующий матч в данных с Fbref.com...");
                const fbrefPrompt = `
    Ты - умный ассистент по обработке данных. Тебе предоставлен JSON массив с данными о футбольных матчах, полученными с сайта fbref.com.
    Вот эти данные:    
    ${JSON.stringify(state.fbrefMatches, null, 2)}

    Также тебе дано название матча, выбранного пользователем: "${state.match}". Названия команд в этом названии могут немного отличаться от тех, что в JSON.
    
    Твоя задача - найти в JSON массиве ОДИН объект, который наиболее точно соответствует выбранному матчу. Сравнивай названия команд ("homeTeam", "awayTeam") из JSON с названиями из "${state.match}".
    
    КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА:
    1.  Твой ответ должен быть ТОЛЬКО JSON объектом найденного матча.
    2.  **ЗАПРЕЩЕНО** добавлять любые объяснения, комментарии или форматирование вроде json. Просто верни чистый JSON.
    3.  Если матч не найден, верни пустой JSON объект: {}.
    `;
                try {
                    const aiResponse = await getPrediction(fbrefPrompt);
                    // Clean the response from the AI
                    const cleanedResponse = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
                    const fbrefMatchObject = JSON.parse(cleanedResponse);

                    if (Object.keys(fbrefMatchObject).length > 0) {
                        console.log('Найденный ИИ объект матча с Fbref:', fbrefMatchObject);
                        await bot.sendMessage(chatId, "✅ ИИ успешно нашел матч! Результат выведен в консоль.");

                        // Now, scrape H2H data
                        const matchData = fbrefMatchObject.matches && fbrefMatchObject.matches[0] ? fbrefMatchObject.matches[0] : fbrefMatchObject;
                        if (matchData && matchData.h2hUrl) {

                            await bot.sendMessage(chatId, "▶️ Запускаю парсинг истории личных встреч (H2H)...");

                            const fullH2hUrl = `https://fbref.com${matchData.h2hUrl}`;

                            try {

                                const h2hHistory = await scrapeH2H(fullH2hUrl);

                                state.fbrefH2hData = h2hHistory; // Store in state

                                console.log('Результат парсинга H2H:', h2hHistory);

                                await bot.sendMessage(chatId, "✅ Успешно! Данные H2H выведены в консоль.");

                            } catch (h2hError) {

                                console.error("Ошибка при парсинге H2H:", h2hError);

                                await bot.sendMessage(chatId, "❌ Произошла ошибка при парсинге H2H.");

                            }

                        } else {

                            console.log("H2H URL не найден в объекте матча от ИИ.");

                            await bot.sendMessage(chatId, "⚠️ H2H URL не найден, парсинг невозможен.");

                        }

                        // NEW: Scrape team stats

                        if (matchData && matchData.homeTeamUrl && matchData.awayTeamUrl) {

                            try {

                                await bot.sendMessage(chatId, `▶️ Запускаю парсинг статистики для команды ${matchData.homeTeam}...`);

                                const homeStats = await scrapeWebsite(`https://fbref.com${matchData.homeTeamUrl}`);

                                state.homeTeamFbrefStats = homeStats;

                                await bot.sendMessage(chatId, `✅ Успешно! Статистика для ${matchData.homeTeam} получена.`);

                                await bot.sendMessage(chatId, `▶️ Запускаю парсинг статистики для команды ${matchData.awayTeam}...`);

                                const awayStats = await scrapeWebsite(`https://fbref.com${matchData.awayTeamUrl}`);

                                state.awayTeamFbrefStats = awayStats;

                                await bot.sendMessage(chatId, `✅ Успешно! Статистика для ${matchData.awayTeam} получена.`);

                            } catch (teamStatError) {

                                console.error("Ошибка при парсинге статистики команд:", teamStatError);

                                await bot.sendMessage(chatId, "❌ Произошла ошибка при парсинге статистики команд.");

                            }

                        } else {

                            console.log("URLы команд не найдены, парсинг статистики невозможен.");

                            await bot.sendMessage(chatId, "⚠️ URLы команд не найдены, парсинг статистики невозможен.");

                        }
                    } else {
                        console.log('ИИ не смог найти соответствующий матч в данных с Fbref.');
                        await bot.sendMessage(chatId, "⚠️ ИИ не смог найти матч в данных с Fbref.com.");
                    }
                } catch (e) {
                    console.error("Ошибка при обработке ответа ИИ для поиска матча Fbref:", e);
                    await bot.sendMessage(chatId, "❌ Произошла ошибка при поиске матча в данных Fbref с помощью ИИ.");
                }
            }

            await bot.sendMessage(chatId, "▶️ Получение списка турниров для команд...");

            try {
                const [homeT, awayT] = await Promise.all([getTeamTournaments(selectedMatch.homeTeamId), getTeamTournaments(selectedMatch.awayTeamId)]);

                const parseTournaments = d => d ? Object.entries(d).map(([id, deets]) => ({ id, name: deets.tournamentName })) : [];
                state.homeTournaments = parseTournaments(homeT);
                state.awayTournaments = parseTournaments(awayT);

                if (state.homeTournaments.length === 0) return bot.sendMessage(chatId, `Не удалось найти турниры для команды ${selectedMatch.homeTeam}.`);

                state.state = 'awaiting_home_tournament';
                conversationState.set(chatId, state);

                const homeKeyboard = state.homeTournaments.map(t => ([{ text: t.name, callback_data: `hometournament_select_${t.id}` }]));
                homeKeyboard.push([{ text: 'Все турниры', callback_data: 'hometournament_select_all' }]);

                await bot.sendMessage(chatId, `Выберите лигу для анализа команды ${selectedMatch.homeTeam}:`, {
                    reply_markup: { inline_keyboard: homeKeyboard }
                });

            } catch (error) {
                console.error("Ошибка при получении турниров команд:", error);
                bot.sendMessage(chatId, "К сожалению, произошла ошибка при получении списков турниров.");
            }

        } else if (data.startsWith('hometournament_select_')) {
            if (state.state !== 'awaiting_home_tournament') return;

            await bot.answerCallbackQuery(callbackQuery.id);
            await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: msg.chat.id, message_id: msg.message_id }).catch(() => { });

            const id = data.substring('hometournament_select_'.length);
            state.selectedHomeTournamentId = id === 'all' ? state.homeTournaments.map(t => t.id).join(',') : id;

            const choice = id === 'all' ? 'Все турниры' : state.homeTournaments.find(t => t.id === id)?.name;
            await bot.sendMessage(chatId, `Для ${state.statshubMatchInfo.homeTeam.name} выбран(ы): ${choice || 'ID ' + id}.`);

            if (state.awayTournaments.length === 0) return bot.sendMessage(chatId, `Не удалось найти турниры для команды ${state.statshubMatchInfo.awayTeam.name}.`);

            state.state = 'awaiting_away_tournament';
            conversationState.set(chatId, state);

            const awayKeyboard = state.awayTournaments.map(t => ([{ text: t.name, callback_data: `awaytournament_select_${t.id}` }]));
            awayKeyboard.push([{ text: 'Все турниры', callback_data: 'awaytournament_select_all' }]);

            await bot.sendMessage(chatId, `Выберите лигу для анализа команды ${state.statshubMatchInfo.awayTeam.name}:`, {
                reply_markup: { inline_keyboard: awayKeyboard }
            });

        } else if (data.startsWith('awaytournament_select_')) {
            if (state.state !== 'awaiting_away_tournament') return;

            await bot.answerCallbackQuery(callbackQuery.id);
            await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: msg.chat.id, message_id: msg.message_id }).catch(() => { });

            const id = data.substring('awaytournament_select_'.length);
            state.selectedAwayTournamentId = id === 'all' ? state.awayTournaments.map(t => t.id).join(',') : id;

            const choice = id === 'all' ? 'Все турниры' : state.awayTournaments.find(t => t.id === id)?.name;
            await bot.sendMessage(chatId, `Для ${state.statshubMatchInfo.awayTeam.name} выбран(ы): ${choice || 'ID ' + id}.`);

            // New step: Ask for expert opinion
            state.state = 'awaiting_expert_opinion';
            conversationState.set(chatId, state);

            const date = new Date();
            date.setDate(date.getDate() + state.dayOffset);
            const dateString = date.toLocaleDateString('ru-RU');

            const perplexityPrompt = `
    Отлично, теперь самый важный шаг. Скопируй промпт ниже и выполни его в Perplexity AI (perplexity.ai).
    Затем **отправь полученный ответ** сюда следующим сообщением.
    
    ---
    
    **Промпт для Perplexity:**
    
    Тема: Детальный анализ футбольного матча ${state.match}, который состоится ${dateString}.

    Запрос:
    Выступи в роли ведущего футбольного аналитика. Твоя задача — собрать и обобщить мнения авторитетных спортивных экспертов, аналитических порталов и известных капперов по этому матчу.
    
    Структурируй свой ответ в виде краткого, но емкого резюме (5-7 предложений), освещая следующие ключевые аспекты:
    
    1.  **Консенсус-прогноз:** Какой исход (победа, ничья, тоталы, обе забъют) и почему считается наиболее вероятным среди большинства экспертов?
    2.  **Оценка формы и тактики:** Как эксперты оценивают текущую игровую форму, моральное состояние и тактические схемы команд?
    3.  **Ключевые факторы для исхода:** Какие факторы выделяются как решающие? (например, травмы лидеров, очные встречи, мотивация, стиль игры тренеров).
    4.  **Ожидаемый характер игры:** Будет ли это открытый футбол с обилием голов или закрытая тактическая борьба?
    
    Цель — получить концентрированную выжимку экспертных мнений, которая поможет принять взвешенное решение.
    `;
            await bot.sendMessage(chatId, perplexityPrompt);

        } else if (data.startsWith('prompt_')) {
            if (state.state !== 'awaiting_prompt_type') return bot.answerCallbackQuery(callbackQuery.id, { text: "Ошибка: не найдено данных для генерации промпта. Начните заново с /start.", show_alert: true });

            const promptType = data.split('_')[1];
            await bot.answerCallbackQuery(callbackQuery.id);
            await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: msg.chat.id, message_id: msg.message_id }).catch(() => { });

            await bot.sendMessage(chatId, `Генерирую промпт для типа "${promptType === 'single' ? 'Ординар' : 'Экспресс'}"...`);

            const finalPromptText = await generateFinalPrompt(promptType, state, state.fbrefH2hData);
            const filePath = path.join(__dirname, '..', 'temp', `final_prompt_${chatId}.txt`);

            try {
                await fs.mkdir(path.dirname(filePath), { recursive: true });
                await fs.writeFile(filePath, finalPromptText);
                await bot.sendDocument(chatId, filePath, {}, { contentType: 'text/plain' });
                await fs.unlink(filePath);

                // --- NEW ---
                state.state = 'awaiting_scores';
                state.scoreMessages = []; // Initialize array for raw text messages
                conversationState.set(chatId, state);
                await bot.sendMessage(chatId, "✅ Промпт отправлен. Ожидаю данные о счетах...");
                // --- END NEW ---

            } catch (error) {
                console.error('Произошла ошибка при создании файла промпта:', error);
                bot.sendMessage(chatId, `К сожалению, произошла ошибка при создании файла: ${error.message}.`);
                // On error, we should still clean up
                conversationState.delete(chatId);
                await closeBrowser();
            }
        }
    });

    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        if (!msg.text || msg.text.startsWith('/')) return;

        const state = conversationState.get(chatId);

        if (!state) {
            if (!msg.text.includes("HTML сохранен для отладки:")) {
                bot.sendMessage(chatId, "Неизвестная команда или сообщение. Используйте /start, чтобы начать.");
            }
            return;
        }

        // New handler for expert opinion
        if (state.state === 'awaiting_expert_opinion') {
            state.expertOpinion = msg.text;
            state.state = 'fetching_data';
            conversationState.set(chatId, state);

            await bot.sendMessage(chatId, "✅ Мнение экспертов принято. Начинаю сбор и анализ данных...");

            // Now, start the data fetching process
            await continueFetchingData(chatId, state);
            return; // Important to stop further processing
        }

        if (state.state === 'awaiting_scores') {
            // If a timer is already running, clear it to reset the debounce period.
            if (state.analysisTimer) {
                clearTimeout(state.analysisTimer);
            }

            // Add the new message to the list
            state.scoreMessages.push(msg.text);

            // Inform the user on the first message of a batch.
            if (state.scoreMessages.length === 1) {
                bot.sendMessage(chatId, `✅ Данные приняты. Анализ начнется автоматически через 3 секунды после последнего сообщения.`);
            }

            // Set a new timer.
            state.analysisTimer = setTimeout(async () => {
                await bot.sendMessage(chatId, "▶️ Данные получены. Запускаю AI для предобработки...");

                try {
                    const combinedText = state.scoreMessages.join('\n\n');
                    const preProcessPrompt = `
        Тебе предоставлен блок текста, содержащий один или несколько JSON-массивов или объектов. Твоя задача — извлечь ВСЕ объекты, у которых есть поля "score" и "confidence", и объединить их в один единый, валидный JSON-объект формата {"scores": [...]}.
        - Не меняй значения, просто собери все в один массив.
        - Игнорируй любой другой текст, который не является частью этих объектов.
        - В твоем ответе должен быть ТОЛЬКО этот JSON-объект и ничего больше.
        Входные данные:
        
        ${combinedText}
        
        `;
                    const aiResponse = await getPrediction(preProcessPrompt);
                    const cleanedResponse = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
                    const parsedData = JSON.parse(cleanedResponse);

                    if (!parsedData.scores || !Array.isArray(parsedData.scores)) {
                        throw new Error("AI не вернул ожидаемый формат {'scores': [...]}");
                    }

                    await bot.sendMessage(chatId, "▶️ AI предобработка завершена. Суммирую очки уверенности...");

                    const scoreSums = new Map();
                    parsedData.scores.forEach(item => {
                        if (item.score) {
                            const score = item.score.trim();
                            const confidence = parseInt(item.confidence, 10);
                            if (score && !isNaN(confidence)) {
                                scoreSums.set(score, (scoreSums.get(score) || 0) + confidence);
                            }
                        }
                    });

                    const sortedScores = [...scoreSums.entries()]
                        .sort((a, b) => b[1] - a[1]); // Get all unique scores, sorted

                    const uniqueScoreCount = sortedScores.length;

                    const analyzeAndFormatScores = (aiScores, rawOdds, allOutcomes) => {
                        const top5Scores = aiScores.slice(0, 5);
                        const uniqueScoreCount = aiScores.length;

                        const calculateCoverage = (scoresToCalc, validOutcomeScores) => {
                            const scoreMap = new Map(scoresToCalc);
                            const totalConfidence = [...scoreMap.values()].reduce((sum, conf) => sum + conf, 0);
                            if (totalConfidence === 0) return 0;
                    
                            let matchingConfidence = 0;
                            scoresToCalc.forEach(([score]) => {
                                const normalizedScore = score.replace('-', ':');
                                if (validOutcomeScores.includes(normalizedScore)) {
                                    matchingConfidence += scoreMap.get(score);
                                }
                            });
                            return (matchingConfidence / totalConfidence) * 100;
                        };

                        const results = allOutcomes.map(outcome => {
                            const { name, odd: oddId, scores: validScores } = outcome;

                            let latestOdd = 'N/A';
                            const oddHistory = rawOdds ? rawOdds[oddId] : null;
                            if (oddHistory && oddHistory.length > 0) {
                                const sortedHistory = [...oddHistory].sort((a, b) => b[0] - a[0]);
                                if (sortedHistory.length > 0 && sortedHistory[0].length > 1) {
                                    latestOdd = sortedHistory[0][1].toFixed(2);
                                }
                            }

                            const coverage5 = calculateCoverage(top5Scores, validScores);
                            const coverageN = calculateCoverage(aiScores, validScores);
                            
                            const numericOdd = parseFloat(latestOdd);
                            let valueScore = 0;
                            if (!isNaN(numericOdd) && numericOdd > 0 && coverageN > 0) {
                                const ourProbability = coverageN / 100;
                                const bookieProbability = 1 / numericOdd;
                                valueScore = ourProbability / bookieProbability;
                            }
                            
                            const contributingScores = {};
                            const topNMap = new Map(aiScores);
                            aiScores.forEach(([score]) => {
                                const normalizedScore = score.replace('-', ':');
                                if (validScores.includes(normalizedScore)) {
                                    contributingScores[normalizedScore] = `${topNMap.get(score)}`;
                                }
                            });

                            return {
                                name: name,
                                odd: latestOdd,
                                coverage5: coverage5,
                                coverageN: coverageN,
                                valueScore: valueScore,
                                scores: contributingScores,
                            };
                        }).filter(res => res.coverageN > 0 && res.valueScore > 0 && parseFloat(res.odd) > 1.3)
                          .sort((a, b) => b.coverageN - a.coverageN);

                        let formattedOutput = `📊 *Результаты анализа по Value Score (Ценности):*\n\n`;
                        if (results.length === 0) {
                             return { formattedText: "Не найдено ценных исходов (Value > 0) с коэффициентом > 1.3.", rawResults: [] };
                        }
                        
                        results.forEach(res => {
                            const scoresDetails = Object.entries(res.scores)
                                .sort(([, confA], [, confB]) => Number(confB) - Number(confA))
                                .map(([s, c]) => `${s} (${c})`)
                                .join(', ');

                            let prefix = '';
                            if (res.valueScore > 1.1) {
                                prefix = '💎 ';
                            }

                            formattedOutput += `${prefix}*${res.name}* (Кэф: ${res.odd}, Покрытие (T5/T${uniqueScoreCount}): ${res.coverage5.toFixed(0)}%/${res.coverageN.toFixed(0)}%, **Value: ${res.valueScore.toFixed(2)}**): _${scoresDetails}_\n\n`;
                        });

                        return { formattedText: formattedOutput, rawResults: results };
                    };

                    const generateRecommendations = (results, state) => {
                        // The 'results' array is already sorted by valueScore in descending order.
                        const top3Results = results.slice(0, 3);

                        const date = new Date();
                        date.setDate(date.getDate() + state.dayOffset);
                        const dateString = date.toLocaleDateString('ru-RU');

                        let output = `*🤖 Рекомендации по ставкам:*\nМатч: *${state.match}*\nДата: ${dateString}\n\n`;

                        if (top3Results.length === 0) {
                            return "Не найдено ценных исходов для формирования рекомендаций.";
                        }

                        const medals = ['🥇', '🥈', '🥉'];

                        top3Results.forEach((res, index) => {
                            output += `${medals[index]} *Место ${index + 1}:* ${res.name}\n`;
                            output += `   - *Кэф:* ${res.odd}\n`;
                            output += `   - *Value Score:* ${res.valueScore.toFixed(2)}\n`;
                            output += `   - *Уверенность ИИ:* ${res.coverageN.toFixed(0)}%\n\n`;
                        });

                        return output;
                    };


                    // Main execution
                    const { formattedText, rawResults } = analyzeAndFormatScores(sortedScores, state.rawOddsHistory, oddsData);
                    await bot.sendMessage(chatId, formattedText, { parse_mode: 'Markdown' });

                    if (rawResults.length > 0) {
                        const recommendationsText = generateRecommendations(rawResults, state);
                        // Send recommendations as plain text to avoid parsing errors
                        await bot.sendMessage(chatId, recommendationsText, { parse_mode: 'Markdown' });
                    }

                } catch (e) {
                    await bot.sendMessage(chatId, `❌ Произошла ошибка во время анализа: ${e.message}`);
                } finally {
                    // Final cleanup
                    conversationState.delete(chatId);
                    await closeBrowser();
                    console.log('Сессия анализа счетов завершена, состояние очищено, браузер закрыт.');
                }
            }, 3000); // 3-second delay

            conversationState.set(chatId, state);
            return;
        }

        // Fallback for any other statefull message that is not handled
        if (state.state) {
            bot.sendMessage(chatId, "Я ожидаю другого ответа. Пожалуйста, используйте кнопки или следуйте инструкциям.");
        }
    });
}
module.exports = {
    setupHandlers,
};
