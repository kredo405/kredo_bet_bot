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

const formatOddsHistory = (apiData, oddsMetadata) => {
  if (!apiData) return [];

  const oddIdToName = new Map();
  oddsMetadata.forEach(item => {
      oddIdToName.set(item.odd, item.name);
  });

  const allowedOutcomes = new Set([
    'ОЗ Да', 'ОЗ Нет', 'ТБ 2.5', 'ТМ 2.5', 
    'Победа 1', 'Победа 2', 'Ничья', 'Ф1 0', 'Ф2 0'
  ]);

  const structuredOdds = [];

  const sortedOddIds = Object.keys(apiData).sort((a, b) => {
    const nameA = oddIdToName.get(a) || '';
    const nameB = oddIdToName.get(b) || '';
    return nameA.localeCompare(nameB);
  });

  for (const oddId of sortedOddIds) {
      if (Object.hasOwnProperty.call(apiData, oddId)) {
          const oddName = oddIdToName.get(oddId);
          if (!oddName || !allowedOutcomes.has(oddName)) {
              continue;
          }

          const history = apiData[oddId];
          if (!history || history.length < 2) continue;

          const sortedHistory = [...history].sort((a, b) => b[0] - a[0]);
          const currentOdd = sortedHistory[0][1];
          const initialOdd = sortedHistory[sortedHistory.length - 1][1];

          const diff = currentOdd - initialOdd;
          const percentChange = (diff / initialOdd) * 100;

          structuredOdds.push({
            name: oddName,
            initial: initialOdd.toFixed(2),
            current: currentOdd.toFixed(2),
            change: percentChange.toFixed(0),
            isSignificant: Math.abs(percentChange) > 10,
          });
      }
  }

  return structuredOdds;
};

module.exports = {
    stripHtml,
    formatTimestamp,
    formatOddsHistory,
};