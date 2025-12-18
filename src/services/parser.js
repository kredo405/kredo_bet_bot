const { getBrowser } = require('./browser');
const fs = require('fs/promises');

/**
 * Scrapes all matches for a given day from the main fbref matches page using Playwright.
 * @param {string} date - The date to scrape in YYYY-MM-DD format.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of leagues, each containing a list of matches.
 */
async function scrapeMatchesByDate(date) {
    const url = `https://fbref.com/en/matches/${date}`;
    console.log(`Запускаю парсинг матчей по дате для URL: ${url}`);
    let page;
    try {
        const browser = getBrowser();
        page = await browser.newPage({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 }
        });

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Try to click away any popups, but don't fail if they don't exist.
        try {
            const continueButton = page.locator('text=/Continue without supporting us/i');
            await continueButton.click({ timeout: 3000 });
            console.log('Clicked "Continue without supporting us" button.');
        } catch (e) {
            console.log('"Continue" button not found, proceeding.');
        }
        try {
            const cookieButton = page.locator('button.css-10nqu2i');
            await cookieButton.click({ timeout: 3000 });
            console.log('Clicked cookie consent button.');
        } catch(e) {
            console.log('Cookie button not found, proceeding.');
        }


        // Wait for the target container to be attached to the DOM, not necessarily visible.
        // This is more reliable as the content might be in comments or hidden tabs.
        await page.waitForSelector('div[id^="all_sched_"]', { state: 'attached', timeout: 20000 });

        const leagues = await page.evaluate(() => {
            const allLeagues = [];
            const leagueContainers = document.querySelectorAll('div[id^="all_sched_"]');

            leagueContainers.forEach(container => {
                let tableContainer = container.querySelector('.table_container');
                if (!tableContainer) {
                    const comments = Array.from(container.childNodes).filter(node => node.nodeType === Node.COMMENT_NODE).map(comment => comment.textContent).join('');
                    if (comments.includes('<table class="stats_table"')) {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = comments;
                        tableContainer = tempDiv.querySelector('.table_container');
                    }
                }
                if (!tableContainer) return;

                const leagueNameElement = container.querySelector('.section_heading h2 a');
                if (!leagueNameElement) return;

                const league = {
                    leagueName: leagueNameElement.innerText,
                    matches: [],
                };
                
                const matchRows = tableContainer.querySelectorAll('table.stats_table tbody tr');
                matchRows.forEach(row => {
                    const startTimeEl = row.querySelector('td[data-stat="start_time"] .localtime');
                    const homeTeamEl = row.querySelector('td[data-stat="home_team"] a');
                    const awayTeamEl = row.querySelector('td[data-stat="away_team"] a');
                    const h2hLinkEl = row.querySelector('td[data-stat="match_report"] a');

                    if (startTimeEl && homeTeamEl && awayTeamEl) {
                        league.matches.push({
                            startTime: startTimeEl.innerText.replace(/[()]/g, ''),
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
        if (page) {
            const screenshotPath = 'fbref_error_matches.png';
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`Скриншот ошибки сохранен в ${screenshotPath}`);
        }
        return { error: `Не удалось извлечь данные матчей. Ошибка: ${error.message}` };
    } finally {
        if (page) {
            await page.close();
        }
    }
}


/**
 * Scrapes Head-to-Head match history from an fbref.com matchup page using Playwright.
 * @param {string} url The H2H URL to scrape.
 * @returns {Promise<Array<Object>>} An array of past matches with their stats.
 */
async function scrapeH2H(url) {
    console.log(`Запускаю парсинг H2H для URL: ${url}`);
    let page;
    try {
        const browser = getBrowser();
        page = await browser.newPage({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 }
        });

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Handle potential popups
        try {
            const continueButton = page.locator('text=/Continue without supporting us/i');
            await continueButton.click({ timeout: 3000 });
        } catch (e) { /* ignore */ }
        try {
            const cookieButton = page.locator('button.css-10nqu2i');
            await cookieButton.click({ timeout: 3000 });
        } catch (e) { /* ignore */ }
        
        await page.waitForSelector('#content', { state: 'attached', timeout: 20000 });

        const h2hData = await page.evaluate(() => {
            const history = [];
            const twoYearsAgo = new Date().getFullYear() - 2;

            let historyTable = document.querySelector('table[id*="games_history"]');
            if (!historyTable) {
                const comments = Array.from(document.body.childNodes).filter(node => node.nodeType === Node.COMMENT_NODE).map(comment => comment.textContent).join('');
                if (comments.includes('id="games_history"')) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = comments;
                    historyTable = tempDiv.querySelector('table[id*="games_history"]');
                }
            }
            if (!historyTable) return [];

            const historyRows = historyTable.querySelectorAll('tbody tr');
            historyRows.forEach(row => {
                if (!row.hasAttribute('data-row') && !row.classList.contains('spacer')) return;
                const dateEl = row.querySelector('[data-stat="date"] a');
                if (dateEl && parseInt(dateEl.innerText.split('-')[0], 10) >= twoYearsAgo) {
                    const scoreEl = row.querySelector('[data-stat="score"] a');
                    if (scoreEl && scoreEl.innerText.trim() !== '') {
                         history.push({
                            competition: row.querySelector('[data-stat="comp"] a')?.innerText || '',
                            date: dateEl.innerText,
                            homeTeam: row.querySelector('[data-stat="home_team"] a')?.innerText || '',
                            homeXG: row.querySelector('[data-stat="home_xg"]')?.innerText || null,
                            score: scoreEl.innerText.trim(),
                            awayXG: row.querySelector('[data-stat="away_xg"]')?.innerText || null,
                            awayTeam: row.querySelector('[data-stat="away_team"] a')?.innerText || ''
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
        if (page) {
            const screenshotPath = 'fbref_error_h2h.png';
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`Скриншот ошибки сохранен в ${screenshotPath}`);
        }
        return { error: `Не удалось извлечь данные H2H. Ошибка: ${error.message}` };
    } finally {
        if (page) {
            await page.close();
        }
    }
}


/**
 * Scrapes structured data from specific tables on an fbref.com squad page using Playwright.
 * @param {string} url The URL to scrape.
 * @returns {Promise<Object>} An object containing structured data.
 */
async function scrapeWebsite(url) {
    console.log(`Запускаю детальный парсинг для URL: ${url}`);
    let page;
    try {
        const browser = getBrowser();
        page = await browser.newPage({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 }
        });

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Handle potential popups
        try {
            const continueButton = page.locator('text=/Continue without supporting us/i');
            await continueButton.click({ timeout: 3000 });
        } catch (e) { /* ignore */ }
        try {
            const cookieButton = page.locator('button.css-10nqu2i');
            await cookieButton.click({ timeout: 3000 });
        } catch (e) { /* ignore */ }

        await page.waitForSelector('#content', { state: 'attached', timeout: 20000 });

        const extractedData = await page.evaluate(() => {
            const data = { results: {}, matchlogs: [], player_stats: [], goalkeeper_stats: [] };

            const findTable = (selector) => {
                let table = document.querySelector(selector);
                if (table) return table;

                const comments = Array.from(document.body.childNodes).filter(node => node.nodeType === Node.COMMENT_NODE).map(comment => comment.textContent).join('');
                const selectorId = selector.match(/id="([^"]+)"/);
                if (selectorId && comments.includes(selectorId[1])) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = comments;
                    return tempDiv.querySelector(selector);
                }
                return null;
            };

            const homeAwayTable = findTable('table[id*="_home_away"]');
            if (homeAwayTable) {
                const resultsRow = homeAwayTable.querySelector('tbody tr.hilite.bold');
                if (resultsRow) {
                    resultsRow.querySelectorAll('td[data-stat]').forEach(cell => {
                        data.results[cell.dataset.stat] = cell.innerText;
                    });
                }
            }
            
            const matchlogRows = document.querySelectorAll('div#all_matchlogs tbody tr:not(.thead)');
            matchlogRows.forEach(row => {
                const resultCell = row.querySelector('[data-stat="result"]');
                if (resultCell && resultCell.innerText.trim() !== '') {
                    const matchData = {};
                    row.querySelectorAll('[data-stat]').forEach(cell => {
                        matchData[cell.dataset.stat] = cell.innerText;
                    });
                    data.matchlogs.push(matchData);
                }
            });
            data.matchlogs = data.matchlogs.slice(-5);

            const playerStatsTable = findTable('table[id^="stats_standard_"]');
             if (playerStatsTable) {
                const playerRows = playerStatsTable.querySelectorAll('tbody tr:not(.thead)');
                const disallowedPositions = new Set(['GK']);
                
                let allPlayers = Array.from(playerRows).map(row => {
                    const playerCell = row.querySelector('[data-stat="player"]');
                    if (!playerCell || playerCell.innerText.trim() === '') return null;
                    const playerData = {};
                    row.querySelectorAll('[data-stat]').forEach(cell => {
                        playerData[cell.dataset.stat] = cell.innerText;
                    });
                    return !playerData.position ? null : playerData;
                }).filter(Boolean);

                data.player_stats = allPlayers
                    .filter(p => !p.position.split(',').some(pos => disallowedPositions.has(pos.trim())))
                    .sort((a, b) => parseInt(b.minutes.replace(/,/g, ''), 10) - parseInt(a.minutes.replace(/,/g, ''), 10));
            }

            const gcaStatsTable = findTable('table[id^="stats_gca_"]');
            if (gcaStatsTable) {
                const gcaPlayerStats = {};
                gcaStatsTable.querySelectorAll('tbody tr:not(.thead)').forEach(row => {
                    const playerCell = row.querySelector('[data-stat="player"]');
                    if (playerCell?.innerText.trim()) {
                        gcaPlayerStats[playerCell.innerText.trim()] = {
                            sca_per90: row.querySelector('[data-stat="sca_per90"]')?.innerText,
                            gca_per90: row.querySelector('[data-stat="gca_per90"]')?.innerText
                        };
                    }
                });
                data.player_stats.forEach(player => {
                    if (gcaPlayerStats[player.player]) {
                        Object.assign(player, gcaPlayerStats[player.player]);
                    }
                });
            }
            
            const keeperAdvStatsTable = findTable('table[id="stats_keeper_adv"]');
            if (keeperAdvStatsTable) {
                keeperAdvStatsTable.querySelectorAll('tbody tr:not(.thead)').forEach(row => {
                    const playerCell = row.querySelector('th[data-stat="player"]');
                    if (playerCell?.innerText.trim()) {
                        const keeperData = { player: playerCell.innerText };
                        row.querySelectorAll('td[data-stat]').forEach(cell => {
                            keeperData[cell.dataset.stat] = cell.innerText;
                        });
                        data.goalkeeper_stats.push(keeperData);
                    }
                });
            }
            
            return data;
        });
        
        console.log("Структурированные данные успешно извлечены.");
        return extractedData;

    } catch (error) {
        console.error(`Ошибка при детальном парсинге URL ${url}:`, error);
        if (page) {
            const screenshotPath = 'fbref_error_website.png';
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`Скриншот ошибки сохранен в ${screenshotPath}`);
        }
        return { error: `Не удалось извлечь структурированные данные. Ошибка: ${error.message}` };
    } finally {
        if (page) {
            await page.close();
        }
    }
}

// Keeping the module exports consistent
module.exports = { scrapeWebsite, scrapeMatchesByDate, scrapeH2H };