import { type Browser, type Page, chromium } from 'playwright';
import * as fs from 'fs';
import type { SkuEntry } from './main.types.ts';
import { createCSV, errorLogger } from './utils.ts';

(async () => {
    try {
        const browser = await chromium.launch();

        const rawData = fs.readFileSync('skus.json', 'utf8');
        const { skus }: { skus: SkuEntry[] } = JSON.parse(rawData);

        if (!skus || skus.length === 0) {
            errorLogger('No SKUs found in the JSON file.');
            await browser.close();
            return;
        }

        for (const entry of skus) {
            const output = await processSku(browser, entry);
            if (output) {
                await createCSV.writeRecords([output])
            }
        }

        await browser.close();
    } catch (error) {
        errorLogger(error.message);
        return
    }
})();

async function processSku(browser: Browser, entry: SkuEntry) {
    const page = await browser.newPage();

    try {
        let data;

        if (entry.Type === 'Amazon') {
            data = await scrapFromAmazon(page, entry.SKU);
        }

        return data
    } catch (error) {
        errorLogger(error.message);
        return null
    } finally {
        await page.close();
    }
}

async function scrapFromAmazon(page: Page, sku: string) {
    try {
        const response = await page.goto(`https://www.amazon.in/dp/${sku}`, { waitUntil: 'domcontentloaded', timeout: 30000 });

        if(response?.status() === 404){
            throw new Error(`Product with SKU ${sku} not found on Amazon.`);
        }
        
        // CAPTA
        const isCaptcha = await page.$('form[action="/errors/validateCaptcha"]');
        if (isCaptcha) throw new Error("CAPTCHA encountered on Amazon.");

        // READING DATA
        const title = await page.locator('span#productTitle').innerText();
        const wholePrice = await page.locator('.apex-core-price-identifier span.apex-pricetopay-value.priceToPay span.a-price-whole').innerText().catch(() => "");
        const fractionPrice = await page.locator('.apex-core-price-identifier span.apex-pricetopay-value.priceToPay span.a-price-fraction').innerText().catch(() => "");
        const price = `${wholePrice}${fractionPrice}`.replace(/\s+/g, '').trim();
        const description = await page.locator('#feature-bullets ul').innerText();
        const reviewsAndRating = await page.locator('#averageCustomerReviews_feature_div #averageCustomerReviews #acrCustomerReviewLink #acrCustomerReviewText').innerText();

        return {
            sku,
            source: "Amazon",
            title,
            description,
            price,
            reviewsAndRating: reviewsAndRating.replace(/[^0-9]/g, "")
        }
    } catch (error) {
        errorLogger(error.message);
        return null;
    }
}