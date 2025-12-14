/**
 * Removes HTML tags from a string.
 * @param {string} html - The HTML string to clean.
 * @returns {string} - The cleaned text.
 */
function stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, '');
}

// Helper functions for odds history formatting
const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
};

const formatOddsHistory = (apiData, oddsMetadata, poissonProbabilities) => {
  if (!apiData) return '';
  if (!poissonProbabilities) poissonProbabilities = {}; // Guard against undefined

  // --- Step 1: Create lookup map ---
  const oddIdToName = new Map();
  oddsMetadata.forEach(item => {
      oddIdToName.set(item.odd, item.name);
  });

  // --- Step 2: Format the final output string ---
  let resultString = 'ДВИЖЕНИЕ КОЭФФИЦИЕНТОВ [Вес: Очень высокий]: Доверяй Fair кэфу в данных, он рассчитан на базе xG модели По Пуассону и методу Монтекарло, используй его как опорную точку\n';
  let hasFilteredOdds = false;

  const sortedOddIds = Object.keys(apiData).sort((a, b) => {
    const nameA = oddIdToName.get(a) || '';
    const nameB = oddIdToName.get(b) || '';
    return nameA.localeCompare(nameB);
  });

  for (const oddId of sortedOddIds) {
      if (Object.hasOwnProperty.call(apiData, oddId)) {
          const oddName = oddIdToName.get(oddId);
          if (!oddName) continue;

          const history = apiData[oddId];
          if (!history || history.length < 2) continue;

          const sortedHistory = [...history].sort((a, b) => b[0] - a[0]);
          const currentOdd = sortedHistory[0][1];
          const initialOdd = sortedHistory[sortedHistory.length - 1][1];

          // Filtering by current coefficient
          if (currentOdd < 1.4 || currentOdd > 3.3) {
              continue;
          }

          hasFilteredOdds = true;

          // Calculation
          const diff = currentOdd - initialOdd;
          const percentChange = (diff / initialOdd) * 100;
          const direction = percentChange < 0 ? 'Падение' : 'Рост';
          const isSignificant = Math.abs(percentChange) > 10 ? ', прогруз' : '';

          // Formatting
          let line = `  - ${oddName}: Открытие ${initialOdd.toFixed(2)} -> Текущий ${currentOdd.toFixed(2)} (${direction} ${Math.abs(percentChange).toFixed(0)}%${isSignificant})`;

          // Append fair probability and fair coefficient if calculated via Poisson
          const marketProbs = poissonProbabilities[oddName];
          if (marketProbs && marketProbs.win > 0) {
              const winProb = marketProbs.win;
              const pushProb = marketProbs.push;
              let fairCoeff;

              // If there's a significant chance of a push, adjust the fair odds calculation.
              if (pushProb > 0.01) {
                  // Fair odd for markets with a push = (1 - P(Push)) / P(Win)
                  fairCoeff = (100 - pushProb) / winProb;
              } else {
                  // Standard fair odd for markets without a push
                  fairCoeff = 100 / winProb;
              }
              
              line += `, вероятность: ${winProb.toFixed(0)}% (fair кэф: ${fairCoeff.toFixed(2)})`;
          }

          resultString += line + '\n';
      }
  }

  return hasFilteredOdds ? resultString : '';
};

module.exports = {
    stripHtml,
    formatTimestamp,
    formatOddsHistory,
};