const { scrapeMatchesByDate } = require('./src/services/parser');

async function run() {
    const date = '2025-12-14';
    console.log(`Starting scrape for date: ${date}`);
    try {
        const result = await scrapeMatchesByDate(date);
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error executing scrapeMatchesByDate:', error);
    }
}

run();
