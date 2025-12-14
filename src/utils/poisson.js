// src/utils/poisson.js

/**
 * Generates a random integer from a Poisson distribution.
 * Uses the Knuth algorithm, which is efficient for small lambda values.
 * @param {number} lambda - The average rate of events (must be > 0).
 * @returns {number} A random integer following the Poisson distribution.
 */
function generatePoissonRandom(lambda) {
    if (lambda <= 0) return 0;
    const L = Math.exp(-lambda);
    let p = 1.0;
    let k = 0;
    do {
        k++;
        p *= Math.random();
    } while (p > L);
    return k - 1;
}


/**
 * Determines the outcome of a bet for a given score.
 * @param {number} h - Home goals.
 * @param {number} a - Away goals.
 * @param {string} marketName - The name of the market (e.g., "ТБ 2.5", "Ф1 (-1.5)").
 * @returns {'WIN'|'PUSH'|'LOSS'} - The outcome of the bet.
 */
function getMarketOutcome(h, a, marketName) {
    const total = h + a;
    
    // Regex for dynamic markets (e.g., ТБ 2.5, ИТ1М1, Ф1(-1))
    // Makes the space after the type optional to handle "ТМ1" vs "ТМ 1"
    const totalMatch = marketName.match(/^Т([БМ])\s?(\d+(\.\d+)?)$/);
    const it1Match = marketName.match(/^ИТ1([БМ])(\d+(\.\d+)?)$/);
    const it2Match = marketName.match(/^ИТ2([БМ])(\d+(\.\d+)?)$/);
    const handicapMatch = marketName.match(/^Ф(\d)\s\(?([\+\-]?\d+(\.\d+)?)\)?$/);

    if (totalMatch) {
        const type = totalMatch[1]; // Б (Over) or М (Under)
        const value = parseFloat(totalMatch[2]);
        if (total > value) return type === 'Б' ? 'WIN' : 'LOSS';
        if (total < value) return type === 'М' ? 'WIN' : 'LOSS';
        return 'PUSH'; // Occurs if total === value
    }
    
    if (it1Match) {
        const type = it1Match[1];
        const value = parseFloat(it1Match[2]);
        if (h > value) return type === 'Б' ? 'WIN' : 'LOSS';
        if (h < value) return type === 'М' ? 'WIN' : 'LOSS';
        return 'PUSH';
    }
    
    if (it2Match) {
        const type = it2Match[1];
        const value = parseFloat(it2Match[2]);
        if (a > value) return type === 'Б' ? 'WIN' : 'LOSS';
        if (a < value) return type === 'М' ? 'WIN' : 'LOSS';
        return 'PUSH';
    }
    
    if (handicapMatch) {
        const team = handicapMatch[1]; // 1 or 2
        const value = parseFloat(handicapMatch[2]);
        
        if (team === '1') {
            const scoreWithHandicap = h + value;
            if (scoreWithHandicap > a) return 'WIN';
            if (scoreWithHandicap < a) return 'LOSS';
            return 'PUSH';
        }
        if (team === '2') {
            const scoreWithHandicap = a + value;
            if (scoreWithHandicap > h) return 'WIN';
            if (scoreWithHandicap < h) return 'LOSS';
            return 'PUSH';
        }
    }

    // Static markets (no push outcomes)
    switch (marketName) {
        case "Победа 1": return h > a ? 'WIN' : 'LOSS';
        case "Победа 2": return a > h ? 'WIN' : 'LOSS';
        case "Ничья": return h === a ? 'WIN' : 'LOSS'; // A bet on "Draw" wins if h === a.
        case "1X": return h >= a ? 'WIN' : 'LOSS';
        case "12": return h !== a ? 'WIN' : 'LOSS';
        case "2X": return a >= h ? 'WIN' : 'LOSS';
        case "ОЗ Да": return h > 0 && a > 0 ? 'WIN' : 'LOSS';
        case "ОЗ Нет": return h === 0 || a === 0 ? 'WIN' : 'LOSS';
        case "Результативная ничья Да": return h === a && h > 0 ? 'WIN' : 'LOSS';
        case "Результативная ничья Нет": return h !== a || (h === 0 && a === 0) ? 'WIN' : 'LOSS';
        default: return 'LOSS'; // Default to loss if market is not recognized
    }
}


/**
 * Calculates outcome probabilities for a football match using a Monte Carlo simulation
 * based on a Poisson distribution of goals.
 * @param {object} homeTeamStats - The home team's stats, requires { home_xg_for, home_xg_against, home_games }.
 * @param {object} awayTeamStats - The away team's stats, requires { away_xg_for, away_xg_against, away_games }.
 * @param {Array<object>} markets - The oddsData array containing market definitions.
 * @param {number} [simulations=10000] - The number of Monte Carlo simulations to run.
 * @returns {object} An object mapping market names to their calculated {win, push, loss} probabilities.
 */
function calculateOutcomeProbabilities(homeTeamStats, awayTeamStats, markets, simulations = 10000) {
    const homeAttack = parseFloat(homeTeamStats.home_xg_for) / homeTeamStats.home_games;
    const homeDefense = parseFloat(homeTeamStats.home_xg_against) / homeTeamStats.home_games;
    const awayAttack = parseFloat(awayTeamStats.away_xg_for) / awayTeamStats.away_games;
    const awayDefense = parseFloat(awayTeamStats.away_xg_against) / awayTeamStats.away_games;

    const lambdaHome = Math.sqrt(homeAttack * awayDefense);
    const lambdaAway = Math.sqrt(awayAttack * homeDefense);

    if (isNaN(lambdaHome) || isNaN(lambdaAway)) {
        console.error("Failed to calculate lambda values. Check input stats.");
        return {};
    }

    // 1. Run the Monte Carlo simulation
    const simulatedScores = [];
    for (let i = 0; i < simulations; i++) {
        const homeGoals = generatePoissonRandom(lambdaHome);
        const awayGoals = generatePoissonRandom(lambdaAway);
        simulatedScores.push({ h: homeGoals, a: awayGoals });
    }

    const marketProbabilities = {};
    // 2. For each market, count the outcomes from the simulation results
    for (const market of markets) {
        const counts = { win: 0, push: 0, loss: 0 };
        
        for (const score of simulatedScores) {
            const outcome = getMarketOutcome(score.h, score.a, market.name);
            if (outcome === 'WIN') {
                counts.win++;
            } else if (outcome === 'PUSH') {
                counts.push++;
            }
        }
        
        counts.loss = simulations - counts.win - counts.push;

        // Convert counts to percentage and store
        marketProbabilities[market.name] = {
            win: (counts.win / simulations) * 100,
            push: (counts.push / simulations) * 100,
            loss: (counts.loss / simulations) * 100,
        };
    }

    return marketProbabilities;
}

module.exports = { calculateOutcomeProbabilities };