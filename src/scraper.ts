import { type Browser, type Page } from 'playwright';
import * as fs from 'fs';
import type { ProductData, SkuEntry } from './main.types.ts';
import { createCSV, errorLogger } from './utils.ts';
import { chromium } from 'playwright-extra';
import stealth from "puppeteer-extra-plugin-stealth";

chromium.use(stealth());

(async () => {
    try {
        const browser = await chromium.launch({ headless: true });

        const rawData = fs.readFileSync('skus.json', 'utf8');
        const { skus }: { skus: SkuEntry[] } = JSON.parse(rawData);

        if (!skus || skus.length === 0) {
            errorLogger('No SKUs found in the JSON file.');
            await browser.close();
            return;
        }

        let data: ProductData[] = [];

        //concurrency
        const batchSize = 2;
        for (let i = 0; i < skus.length; i += batchSize) {
            const batch = skus.slice(i, i + batchSize);

            const promises = batch.map(async sku => {
                const output = await processSku(browser, sku);
                if (output) {
                    data.push(output);
                }
            });

            await Promise.all(promises);
        }

        if (data.length) {
            await createCSV.writeRecords(data);
        }

        await browser.close();

    } catch (error: any) {
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
        else if (entry.Type === 'Walmart') {
            data = await scrapFromWalmart(page, entry.SKU);
        }
        else {
            errorLogger(`Wrong SKU type = ${entry.Type} for SKU: ${entry.SKU}`);
        }

        return data
    } catch (error: any) {
        errorLogger(error.message);
        return null
    } finally {
        await page.close();
    }
}

function retryLogic(){

}

async function scrapFromAmazon(page: Page, sku: string) {
    try {
        const response = await page.goto(`https://www.amazon.in/dp/${sku}`, { waitUntil: 'domcontentloaded', timeout: 30000 });

        if (response?.status() === 404) {
            throw new Error(`Product with SKU ${sku} not found on Amazon.`);
        }

        // CAPTA
        const isCaptcha = await page.$('form[action="/errors/validateCaptcha"]');
        if (isCaptcha) throw new Error("CAPTCHA encountered on Amazon.");

        // READING DATA
        const title = await page.locator('span#productTitle').innerText();
        const wholePrice = await page.locator('.apex-core-price-identifier span.apex-pricetopay-value.priceToPay span.a-price-symbol').innerText().catch(() => "") + await page.locator('.apex-core-price-identifier span.apex-pricetopay-value.priceToPay span.a-price-whole').innerText().catch(() => "");
        const fractionPrice = await page.locator('.apex-core-price-identifier span.apex-pricetopay-value.priceToPay span.a-price-fraction').innerText().catch(() => "");
        const price = `${wholePrice}${fractionPrice}`.replace(/\s+/g, '').trim();
        const description = await page.locator('#feature-bullets ul').innerText();
        const reviewsAndRating = await page.locator('#averageCustomerReviews_feature_div #averageCustomerReviews #acrCustomerReviewLink #acrCustomerReviewText').innerText();
console.log(price);

        return {
            sku,
            source: "Amazon",
            title,
            description,
            price,
            reviewsAndRating: reviewsAndRating.replace(/[^0-9,]/g, "")
        }
    } catch (error: any) {
        errorLogger(error.message);
        return null;
    }
}

async function scrapFromWalmart(page: Page, sku: string) {
    try {
        const response = await page.goto(`https://www.walmart.com/ip/${sku}`, { waitUntil: 'domcontentloaded', timeout: 30000 });

        if (response?.status() === 404) {
            throw new Error(`Product with SKU ${sku} not found on Amazon.`);
        }

        // CAPTA
        const isCaptcha = await page.$('#px-captcha');
        if (isCaptcha) throw new Error("CAPTCHA encountered on Walmart.");

        // READING DATA
        const title = await page.locator('h1#main-title').innerText();
        const price = await page.locator('span[itemprop="price"]').innerText().catch(() => "");
        const description = await page.locator('#top-highlights-module ul').innerText();
        const reviewsAndRating = await page.locator('a[itemprop="ratingCount"]').innerText();

        return {
            sku,
            source: "Walmart",
            title,
            description,
            price: price.replace(/[^0-9,.$₹]/g, ""),
            reviewsAndRating: reviewsAndRating.replace(/[^K0-9,.]/g, "")
        }
    } catch (error: any) {
        errorLogger(error.message);
        return null;
    }
}