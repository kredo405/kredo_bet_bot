const { scrapeMatchesByDate } = require('./src/services/parser');
const fs = require('fs');
const path = require('path');

async function runAndSave() {
    const date = '2025-12-14';
    const tempDir = '/home/kredo405/.gemini/tmp/401e09a38c60e7e20b470c88d0f709c7fe2bcd07492dde3083c103ae4ce0e0c3';
    const outputPath = path.join(tempDir, 'matches_data.json');

    console.log(`Starting scrape for date: ${date}`);
    try {
        const result = await scrapeMatchesByDate(date);
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        console.log(`Successfully saved match data to ${outputPath}`);
    } catch (error) {
        console.error('Error executing scrapeMatchesByDate and saving file:', error);
    }
}

runAndSave();
