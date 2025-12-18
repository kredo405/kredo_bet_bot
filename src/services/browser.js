const { chromium } = require('playwright');

let browser = null;

const launchBrowser = async () => {
    if (browser) {
        return browser;
    }
    try {
        console.log('▶️ Launching a new Playwright browser instance...');
        browser = await chromium.launch({
            headless: true, // Use headless for performance
        });
        console.log('✅ Browser launched successfully.');
    } catch (error) {
        console.error('❌ Could not launch browser:', error);
        throw error;
    }
    return browser;
};

const getBrowser = () => {
    if (!browser) {
        throw new Error('Browser has not been launched. Call launchBrowser() first.');
    }
    return browser;
};

const closeBrowser = async () => {
    if (browser) {
        await browser.close();
        browser = null;
        console.log('Browser closed.');
    }
};

module.exports = {
    launchBrowser,
    getBrowser,
    closeBrowser,
};
