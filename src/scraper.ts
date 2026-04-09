import { type Browser, type Page, chromium } from 'playwright';
import * as fs from 'fs';
import type { SkuEntry } from './main.types.js';



(async () => {
    const browser = await chromium.launch();

    const rawData = fs.readFileSync('skus.json', 'utf8');
    const { skus }: { skus: SkuEntry[] } = JSON.parse(rawData);

    for (const entry of skus) {
        await processSku(browser, entry);
    }

    console.log(skus);

    await browser.close();
})();

async function processSku(browser: Browser, entry: SkuEntry) {
    console.log(entry);

    const page = await browser.newPage();

    try {
        let data;
        console.log(` ${entry.Type} - ${entry.SKU}`);

        if (entry.Type === 'Amazon') {
            data = await scrapFromAmazon(page, entry.SKU);
        }
    } catch (error) {
        console.error(error);
    } finally {
        await page.close();
    }
}

async function scrapFromAmazon(page: Page, sku: string) {
    await page.goto(`https://www.amazon.in/dp/${sku}`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const title = await page.locator('span#productTitle').innerText();

    console.log('Page title:', title);

}