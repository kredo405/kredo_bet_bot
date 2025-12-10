// src/utils/poisson.js

/**
 * A simple memoized factorial function.
 * @param {number} n - The number to calculate the factorial for.
 * @returns {number} The factorial of n.
 */
const factorial = (() => {
    const cache = [1, 1];
    return (n) => {
        if (n < 0) return NaN;
        if (cache[n]) return cache[n];
        let result = cache[cache.length - 1];
        for (let i = cache.length; i <= n; i++) {
            result *= i;
            cache[i] = result;
        }
        return result;
    };
})();

/**
 * Calculates the Poisson probability for a specific number of events given an average rate (lambda).
 * P(k; λ) = (λ^k * e^-λ) / k!
 * @param {number} k - The number of events (e.g., goals).
 * @param {number} lambda - The average rate of events (e.g., expected goals).
 * @returns {number} The Poisson probability.
 */
function poissonProbability(k, lambda) {
    if (k < 0 || lambda < 0) return 0;
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
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
 * Calculates outcome probabilities (win, push, loss) for a football match using a Poisson distribution model.
 * This function generates a matrix of score probabilities and then sums them up according
 * to the rules of each betting market.
 * @param {object} homeTeamStats - The home team's stats, requires { home_xg_for, home_xg_against, home_games }.
 * @param {object} awayTeamStats - The away team's stats, requires { away_xg_for, away_xg_against, away_games }.
 * @param {Array<object>} markets - The oddsData array containing market definitions.
 * @returns {object} An object mapping market names to their calculated {win, push, loss} probabilities.
 */
function calculateOutcomeProbabilities(homeTeamStats, awayTeamStats, markets) {
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

    const MAX_GOALS = 10; // Sufficient for over 99.9% of outcomes, better performance
    const scoreMatrix = Array(MAX_GOALS + 1).fill(0).map(() => Array(MAX_GOALS + 1).fill(0));

    // 1. Populate the score probability matrix
    for (let h = 0; h <= MAX_GOALS; h++) {
        for (let a = 0; a <= MAX_GOALS; a++) {
            const homeProb = poissonProbability(h, lambdaHome);
            const awayProb = poissonProbability(a, lambdaAway);
            scoreMatrix[h][a] = homeProb * awayProb;
        }
    }

    const marketProbabilities = {};
    // 2. For each market, sum the probabilities for Win, Push, and Loss
    for (const market of markets) {
        const probs = { win: 0, push: 0, loss: 0 };
        
        for (let h = 0; h <= MAX_GOALS; h++) {
            for (let a = 0; a <= MAX_GOALS; a++) {
                const outcome = getMarketOutcome(h, a, market.name);
                if (outcome === 'WIN') {
                    probs.win += scoreMatrix[h][a];
                } else if (outcome === 'PUSH') {
                    probs.push += scoreMatrix[h][a];
                }
            }
        }
        
        probs.loss = 1 - probs.win - probs.push;

        // Convert to percentage and store
        marketProbabilities[market.name] = {
            win: probs.win * 100,
            push: probs.push * 100,
            loss: probs.loss * 100,
        };
    }

    return marketProbabilities;
}

module.exports = { calculateOutcomeProbabilities };