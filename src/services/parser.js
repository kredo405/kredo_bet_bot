const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Apply the stealth plugin to make puppeteer less detectable
puppeteer.use(StealthPlugin());

/**
 * Scrapes all matches for a given day from the main fbref matches page.
 * @param {string} date - The date to scrape in YYYY-MM-DD format.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of leagues, each containing a list of matches.
 */
async function scrapeMatchesByDate(date) {
    const url = `https://fbref.com/en/matches/${date}`;
    try {
        browser = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        try {
            // Wait for the schedule container to be visible to avoid race conditions
            await page.waitForSelector('div[id^="all_sched_"]', { timeout: 120000 });
        } catch (error) {
            if (error.name === 'TimeoutError') {
                console.error("Timeout waiting for selector. Saving debug info...");
                const screenshotPath = '/home/kredo405/.gemini/tmp/401e09a38c60e7e20b470c88d0f709c7fe2bcd07492dde3083c103ae4ce0e0c3/fbref_error.png';
                const htmlPath = '/home/kredo405/.gemini/tmp/401e09a38c60e7e20b470c88d0f709c7fe2bcd07492dde3083c103ae4ce0e0c3/fbref_error.html';
                
                await page.screenshot({ path: screenshotPath, fullPage: true });
                const pageContent = await page.content();
                const fs = require('fs/promises');
                await fs.writeFile(htmlPath, pageContent);

                console.error(`Debug screenshot saved to: ${screenshotPath}`);
                console.error(`Debug HTML saved to: ${htmlPath}`);
            }
            throw error; // Re-throw the original error
        }

        const leagues = await page.evaluate(() => {
            const allLeagues = [];
            
            // Находим все контейнеры лиг на странице
            const leagueContainers = document.querySelectorAll('div[id^="all_sched_"]');

            leagueContainers.forEach(container => {
                // Иногда таблицы бывают внутри закомментированного HTML.
                // Проверяем, есть ли таблица напрямую, если нет - ищем в комментариях.
                let tableContainer = container.querySelector('.table_container');

                if (!tableContainer) {
                    const comments = Array.from(container.childNodes)
                        .filter(node => node.nodeType === Node.COMMENT_NODE)
                        .map(comment => comment.textContent)
                        .join('');
                    
                    if (comments.includes('<table class="stats_table"')) {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = comments;
                        tableContainer = tempDiv.querySelector('.table_container');
                    }
                }

                if (!tableContainer) return;

                const league = {};
                
                const leagueNameElement = container.querySelector('.section_heading h2 a');
                if (!leagueNameElement) return;

                league.leagueName = leagueNameElement.innerText;
                league.matches = [];
                
                const matchRows = tableContainer.querySelectorAll('table.stats_table tbody tr');
                
                matchRows.forEach(row => {
                    const startTimeEl = row.querySelector('td[data-stat="start_time"] .localtime');
                    const homeTeamEl = row.querySelector('td[data-stat="home_team"] a');
                    const awayTeamEl = row.querySelector('td[data-stat="away_team"] a');
                    const h2hLinkEl = row.querySelector('td[data-stat="match_report"] a');

                    if (startTimeEl && homeTeamEl && awayTeamEl) {
                        league.matches.push({
                            startTime: startTimeEl.innerText.replace(/[()]/g, ''), // Убираем скобки
                            homeTeam: homeTeamEl.innerText,
                            homeTeamUrl: homeTeamEl.getAttribute('href'),
                            awayTeam: awayTeamEl.innerText,
                            awayTeamUrl: awayTeamEl.getAttribute('href'),
                            h2hUrl: h2hLinkEl ? h2hLinkEl.getAttribute('href') : null
                        });
                    }
                });

                if (league.matches.length > 0) {
                    allLeagues.push(league);
                }
            });

            return allLeagues;
        });

        console.log(`Найдено ${leagues.length} лиг с матчами.`);
        return leagues;

    } catch (error) {
        console.error(`Ошибка при парсинге матчей по дате (${url}):`, error);
        return {
            error: `Не удалось извлечь данные матчей. Ошибка: ${error.message}`
        };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}


/**
 * Scrapes Head-to-Head match history from an fbref.com matchup page.
 * @param {string} url The H2H URL to scrape.
 * @returns {Promise<Array<Object>>} An array of past matches with their stats.
 */
async function scrapeH2H(url) {
    console.log(`Запускаю парсинг H2H для URL: ${url}`);
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Handle cookie consent button
        try {
            const cookieButtonSelector = 'button.css-10nqu2i';
            await page.waitForSelector(cookieButtonSelector, { timeout: 5000 });
            await page.click(cookieButtonSelector);
            console.log('Cookie consent button clicked.');
            await page.waitForTimeout(2000); // Wait for banner to disappear
        } catch (e) {
            console.log('Cookie consent button not found or already accepted.');
        }


        try {
            // Wait for the main content to be visible to avoid race conditions
            await page.waitForSelector('#content', { timeout: 10000 });
        } catch (error) {
            if (error.name === 'TimeoutError') {
                console.error("Timeout waiting for selector. Saving debug info...");
                const screenshotPath = '/home/kredo405/.gemini/tmp/401e09a38c60e7e20b470c88d0f709c7fe2bcd07492dde3083c103ae4ce0e0c3/fbref_error.png';
                const htmlPath = '/home/kredo405/.gemini/tmp/401e09a38c60e7e20b470c88d0f709c7fe2bcd07492dde3083c103ae4ce0e0c3/fbref_error.html';
                
                await page.screenshot({ path: screenshotPath, fullPage: true });
                const pageContent = await page.content();
                const fs = require('fs/promises');
                await fs.writeFile(htmlPath, pageContent);

                console.error(`Debug screenshot saved to: ${screenshotPath}`);
                console.error(`Debug HTML saved to: ${htmlPath}`);
            }
            throw error; // Re-throw the original error
        }

        const h2hData = await page.evaluate(() => {
            const history = [];
            const currentYear = new Date().getFullYear();
            const twoYearsAgo = currentYear - 2;

            // Find the table more robustly, checking comments as a fallback
            let historyTable = document.querySelector('table[id*="games_history"]');

            if (!historyTable) {
                const comments = Array.from(document.body.childNodes)
                    .filter(node => node.nodeType === Node.COMMENT_NODE)
                    .map(comment => comment.textContent)
                    .join('');
                
                if (comments.includes('id="games_history"')) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = comments;
                    historyTable = tempDiv.querySelector('table[id*="games_history"]');
                }
            }

            if (!historyTable) return [];

            const historyRows = historyTable.querySelectorAll('tbody tr'); // more robust selector

            historyRows.forEach(row => {
                // Check if it's a valid data row and not a subheader
                if (!row.hasAttribute('data-row') && !row.classList.contains('spacer')) return;

                const compEl = row.querySelector('[data-stat="comp"] a');
                const dateEl = row.querySelector('[data-stat="date"] a');
                const homeTeamEl = row.querySelector('[data-stat="home_team"] a');
                const homeXgEl = row.querySelector('[data-stat="home_xg"]');
                const scoreEl = row.querySelector('[data-stat="score"] a');
                const awayXgEl = row.querySelector('[data-stat="away_xg"]');
                const awayTeamEl = row.querySelector('[data-stat="away_team"] a');

                if (dateEl && homeTeamEl && awayTeamEl && scoreEl) {
                    const score = scoreEl.innerText.trim();
                    const matchDateStr = dateEl.innerText;
                    const matchYear = parseInt(matchDateStr.split('-')[0], 10);

                    // Apply filters: score must not be empty and match must be within the last 2 years
                    if (score !== '' && matchYear >= twoYearsAgo) {
                        history.push({
                            competition: compEl ? compEl.innerText : '',
                            date: matchDateStr,
                            homeTeam: homeTeamEl.innerText,
                            homeXG: homeXgEl ? homeXgEl.innerText : null,
                            score: score,
                            awayXG: awayXgEl ? awayXgEl.innerText : null,
                            awayTeam: awayTeamEl.innerText
                        });
                    }
                }
            });

            return history;
        });
        
        console.log(`Найдено ${h2hData.length} матчей в истории личных встреч (после фильтрации).`);
        return h2hData;

    } catch (error) {
        console.error(`Ошибка при парсинге H2H URL ${url}:`, error);
        return {
            error: `Не удалось извлечь данные H2H. Ошибка: ${error.message}`
        };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}


/**
 * Scrapes structured data from specific tables on an fbref.com squad page.
 * @param {string} url The URL to scrape.
 * @returns {Promise<Object>} An object containing structured data for results and match logs.
 */
async function scrapeWebsite(url) {
    console.log(`Запускаю детальный парсинг для URL: ${url}`);
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        const extractedData = await page.evaluate(() => {
            const data = {
                results: {},
                matchlogs: [],
                player_stats: [],
                goalkeeper_stats: [] // New property for goalkeeper stats
            };

            // --- 1. Extract Home/Away Results ---
            const homeAwayTable = document.querySelector('table[id*="_home_away"]');
            if (homeAwayTable) {
                const resultsRow = homeAwayTable.querySelector('tbody tr.hilite.bold');
                if (resultsRow) {
                    const resultStats = [
                        "home_games", "home_wins", "home_ties", "home_losses", "home_goals_for", "home_goals_against", 
                        "home_goal_diff", "home_points", "home_points_avg", "home_xg_for", "home_xg_against", 
                        "home_xg_diff", "home_xg_diff_per90", "away_games", "away_wins", "away_ties", "away_losses", 
                        "away_goals_for", "away_goals_against", "away_goal_diff", "away_points", "away_points_avg", 
                        "away_xg_for", "away_xg_against", "away_xg_diff", "away_xg_diff_per90"
                    ];
                    resultStats.forEach(stat => {
                        const element = resultsRow.querySelector(`td[data-stat="${stat}"]`);
                        if (element) {
                            data.results[stat] = element.innerText;
                        }
                    });
                }
            }

            // --- 2. Extract Match Logs ---
            const matchlogRows = document.querySelectorAll('div#all_matchlogs tbody tr:not(.thead)');
            const matchlogStats = ["date", "comp", "venue", "result", "goals_for", "goals_against", "opponent", "xg_for", "xg_against", "possession"];
            
            matchlogRows.forEach(row => {
                const resultCell = row.querySelector('[data-stat="result"]');
                if (resultCell && resultCell.innerText.trim() !== '') {
                    const matchData = {};
                    matchlogStats.forEach(stat => {
                        const element = row.querySelector(`[data-stat="${stat}"]`);
                        if (element) {
                            matchData[stat] = element.innerText;
                        }
                    });
                    data.matchlogs.push(matchData);
                }
            });

            data.matchlogs = data.matchlogs.slice(-5);

            // --- 3. Extract, Filter, and Sort Player Stats ---
            const playerStatsTable = document.querySelector('table[id^="stats_standard_"]');
            if (playerStatsTable) {
                const playerRows = playerStatsTable.querySelectorAll('tbody tr:not(.thead)');
                const disallowedPositions = new Set(['GK']);
                const playerStatsKeys = ["player", "minutes", "position", "games", "xg_per90", "xg_assist_per90"];
                
                let allPlayers = Array.from(playerRows).map(row => {
                    const playerCell = row.querySelector('[data-stat="player"]');
                    if (!playerCell || playerCell.innerText.trim() === '') return null;

                    const playerData = {};
                    playerStatsKeys.forEach(stat => {
                        const statCell = row.querySelector(`[data-stat="${stat}"]`);
                        if (statCell) {
                            playerData[stat] = statCell.innerText;
                        }
                    });

                    if (!playerData.position || !playerData.minutes) return null;
                    
                    return playerData;
                }).filter(Boolean);

                const filteredPlayers = allPlayers.filter(player => {
                    const positions = player.position.split(',');
                    return !positions.some(pos => disallowedPositions.has(pos.trim()));
                });

                filteredPlayers.sort((a, b) => {
                    const minutesA = parseInt(a.minutes.replace(/,/g, ''), 10);
                    const minutesB = parseInt(b.minutes.replace(/,/g, ''), 10);
                    return minutesB - minutesA;
                });

                data.player_stats = filteredPlayers;
            }

            // --- 4. Extract Goal and Shot Creation (GCA) stats and merge them ---
            const gcaStatsTable = document.querySelector('table[id^="stats_gca_"]');
            if (gcaStatsTable) {
                const gcaPlayerStats = {};
                const gcaRows = gcaStatsTable.querySelectorAll('tbody tr:not(.thead)');
                
                gcaRows.forEach(row => {
                    const playerCell = row.querySelector('[data-stat="player"]');
                    const scaCell = row.querySelector('[data-stat="sca_per90"]');
                    const gcaCell = row.querySelector('[data-stat="gca_per90"]');

                    if (playerCell && scaCell && gcaCell) {
                        const playerName = playerCell.innerText.trim();
                        if (playerName) {
                            gcaPlayerStats[playerName] = {
                                sca_per90: scaCell.innerText,
                                gca_per90: gcaCell.innerText
                            };
                        }
                    }
                });

                // Merge GCA stats into the main player_stats
                data.player_stats.forEach(player => {
                    if (gcaPlayerStats[player.player]) {
                        player.sca_per90 = gcaPlayerStats[player.player].sca_per90;
                        player.gca_per90 = gcaPlayerStats[player.player].gca_per90;
                    }
                });
            }

            // --- 5. Extract Goalkeeper Stats ---
            const keeperAdvStatsDiv = document.querySelector('div#all_stats_keeper_adv');
            if (keeperAdvStatsDiv) {
                let keeperStatsTableBody = keeperAdvStatsDiv.querySelector('table.stats_table tbody');

                if (!keeperStatsTableBody) {
                    const comments = Array.from(keeperAdvStatsDiv.childNodes)
                        .filter(node => node.nodeType === Node.COMMENT_NODE)
                        .map(comment => comment.textContent)
                        .join('');
                    
                    if (comments.includes('<table class="stats_table"')) {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = comments;
                        keeperStatsTableBody = tempDiv.querySelector('table.stats_table tbody');
                    }
                }

                if (keeperStatsTableBody) {
                    const keeperRows = keeperStatsTableBody.querySelectorAll('tr:not(.thead)');
                    const keeperStatsKeys = [
                        "player", "position", "minutes_90s", "gk_goals_against", "gk_pens_allowed", "gk_psxg", 
                        "gk_psnpxg_per_shot_on_target_against", "gk_psxg_net", "gk_psxg_net_per90"
                    ];

                    keeperRows.forEach(row => {
                        const keeperData = {};
                        const playerCell = row.querySelector('th[data-stat="player"]'); // Player is in a <th>
                        if (playerCell && playerCell.innerText.trim() !== '') {
                            keeperData.player = playerCell.innerText;
                            
                            keeperStatsKeys.slice(1).forEach(stat => {
                                const element = row.querySelector(`td[data-stat="${stat}"]`);
                                if (element) {
                                    keeperData[stat] = element.innerText;
                                }
                            });
                            data.goalkeeper_stats.push(keeperData);
                        }
                    });
                }
            }

            return data;
        });
        
        console.log("Структурированные данные успешно извлечены.");
        return extractedData;

    } catch (error) {
        console.error(`Ошибка при детальном парсинге URL ${url}:`, error);
        return {
            error: `Не удалось извлечь структурированные данные. Ошибка: ${error.message}`
        };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * Scrapes goalkeeper statistics from an fbref.com squad page.
 * @param {string} url The URL to scrape.
 * @returns {Promise<Array<Object>>} An array of goalkeeper stats.
 */
async function scrapeGoalkeeperStats(url) {
    console.log(`Запускаю парсинг статистики вратарей для URL: ${url}`);
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        const goalkeeperStats = await page.evaluate(() => {
            const keepers = [];
            const keeperAdvStatsDiv = document.querySelector('div#all_stats_keeper_adv');

            if (!keeperAdvStatsDiv) return [];

            let keeperStatsTable = keeperAdvStatsDiv.querySelector('table.stats_table tbody');

            // Check if the table is in a comment
            if (!keeperStatsTable) {
                const comments = Array.from(keeperAdvStatsDiv.childNodes)
                    .filter(node => node.nodeType === Node.COMMENT_NODE)
                    .map(comment => comment.textContent)
                    .join('');
                
                if (comments.includes('<table class="stats_table"')) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = comments;
                    keeperStatsTable = tempDiv.querySelector('table.stats_table tbody');
                }
            }

            if (!keeperStatsTable) return [];

            const keeperRows = keeperStatsTable.querySelectorAll('tr:not(.thead)'); // Exclude header rows
            const keeperStatsKeys = [
                "player", "position", "minutes_90s", "gk_goals_against", "gk_pens_allowed", "gk_psxg", 
                "gk_psnpxg_per_shot_on_target_against", "gk_psxg_net", "gk_psxg_net_per90"
            ];

            keeperRows.forEach(row => {
                const playerData = {};
                let hasPlayer = false;
                keeperStatsKeys.forEach(stat => {
                    const element = row.querySelector(`td[data-stat="${stat}"]`);
                    if (element) {
                        playerData[stat] = element.innerText;
                        if (stat === "player") hasPlayer = true;
                    }
                });
                if (hasPlayer) {
                    keepers.push(playerData);
                }
            });

            return keepers;
        });
        
        console.log(`Найдено ${goalkeeperStats.length} вратарей со статистикой.`);
        return goalkeeperStats;

    } catch (error) {
        console.error(`Ошибка при парсинге статистики вратарей URL ${url}:`, error);
        return {
            error: `Не удалось извлечь статистику вратарей. Ошибка: ${error.message}`
        };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

module.exports = { scrapeWebsite, scrapeMatchesByDate, scrapeH2H, scrapeGoalkeeperStats };
