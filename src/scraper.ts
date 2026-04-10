import { type Browser, type Page } from 'playwright';
import * as fs from 'fs';
import type { ProductData, SkuEntry } from './main.types.ts';
import { consoleLogger, createCSV, errorLogger } from './utils.ts';
import { chromium } from 'playwright-extra';
import stealth from "puppeteer-extra-plugin-stealth";
import chalk from 'chalk';

chromium.use(stealth());

(async () => {
    consoleLogger(chalk.white.bgGreen("Starting the scraper..."));

    let browser: Browser | null = null;
    try {
        browser = await chromium.launch({ headless: true });

        const rawData = fs.readFileSync('skus.json', 'utf8');
        const { skus }: { skus: SkuEntry[] } = JSON.parse(rawData);

        if (!skus || skus.length === 0) {
            errorLogger('No SKUs found in the JSON file.');
            await browser.close();
            return;
        }

        let data: ProductData[]= [];

        //concurrency
        const batchSize = 2;
        for (let i = 0; i < skus.length; i += batchSize) {
            const batch = skus.slice(i, i + batchSize);

            const promises = batch.map(async sku => {
                const output = await processSku(browser as Browser, sku);
                if (output) {
                    data.push(output!);
                }
            });

            await Promise.all(promises);
        }

        if (data.length) {
            await createCSV.writeRecords(data);
        }
        consoleLogger(chalk.white.bgGreen("Scrapping Completed..."))

    } catch (error: any) {
        consoleLogger(chalk.white.bgRed("Encountered error"))

        errorLogger(error.message);
        return
    }
    finally {
        if (browser) {
            await browser.close();
        }
    }
})();

async function processSku(browser: Browser, entry: SkuEntry) {
    const page = await browser.newPage();

    try {
        let data: ProductData | null = null;

        if (entry.Type === 'Amazon') {
            data = await retryLogic(() => scrapFromAmazon(page, entry.SKU));
        }
        else if (entry.Type === 'Walmart') {
            data = await retryLogic(() => scrapFromWalmart(page, entry.SKU));
        }
        else {
            errorLogger(`Wrong SKU type = ${entry.Type} for SKU: ${entry.SKU}`);
            consoleLogger(chalk.white.bgRed(`Wrong SKU type = ${entry.Type} for SKU: ${entry.SKU}`));
            return null;
        }

        return data
    } catch (error: any) {
        errorLogger(error.message);
        consoleLogger(chalk.white.bgRed(`Error occurred while processing SKU: ${entry.SKU}`));

        return null
    } finally {
        if (!page.isClosed()) {
            await page.close();
        }
    }
}

function retryLogic<T>(callback: () => Promise<T>, retryCount: number = 3, delay: number = 2000) {
    return new Promise<T>((resolve, reject) => {
        let attempts = 0;

        const attempt = () => {
            callback()
                .then(resolve)
                .catch((err: any) => {                    
                    attempts++;
                    
                    if (attempts < retryCount) {
                        setTimeout(attempt, delay);
                    } else {
                        reject(err);
                    }
                });
        };

        attempt();
    });
}

export async function scrapFromAmazon(page: Page, sku: string) {
    try {
        consoleLogger(chalk.blue(`Scraping Amazon for SKU: ${sku} started`));
        const response = await page.goto(`https://www.amazon.in/dp/${sku}`, { waitUntil: 'domcontentloaded', timeout: 30000 });

        if (response?.status() === 404) {
            throw new Error(`Product with SKU ${sku} not found on Amazon.`);
        }

        // CAPTA
        const isCaptcha = await page.$('form[action="/errors/validateCaptcha"]');
        if (isCaptcha) {
            consoleLogger(chalk.white.bgRed(`CAPTCHA encountered for SKU: ${sku} on Amazon.`));
            throw new Error("CAPTCHA encountered on Amazon.");
        }

        // READING DATA
        const title = await page.locator('span#productTitle').innerText().then(t => t.trim());
        const wholePrice = await page.locator('.apex-core-price-identifier span.apex-pricetopay-value.priceToPay span.a-price-symbol').innerText().catch(() => "") + await page.locator('.apex-core-price-identifier span.apex-pricetopay-value.priceToPay span.a-price-whole').innerText().catch(() => "");
        const fractionPrice = await page.locator('.apex-core-price-identifier span.apex-pricetopay-value.priceToPay span.a-price-fraction').innerText().catch(() => "");
        const price = `${wholePrice}${fractionPrice}`.replace(/[^0-9,.]/g, "").trim();
        const description = await page.locator('#feature-bullets ul').innerText().then(t => t.trim());
        const reviewsAndRating = await page.locator('#averageCustomerReviews_feature_div #averageCustomerReviews #acrCustomerReviewLink #acrCustomerReviewText').innerText();

        consoleLogger(chalk.blue(`Scraping Amazon for SKU: ${sku} completed`));

        return {
            sku,
            source: "Amazon",
            title,
            description,
            price,
            reviewsAndRating: reviewsAndRating.replace(/[^0-9,]/g, "")
        }
    } catch (error: any) {
        consoleLogger(chalk.white.bgRed(`Error occurred while scraping Amazon for SKU: ${sku}`, error.message));        
        errorLogger(error.message);
        throw error;
    }
}

export async function scrapFromWalmart(page: Page, sku: string) {
    try {
        const response = await page.goto(`https://www.walmart.com/ip/${sku}`, { waitUntil: 'domcontentloaded', timeout: 30000 });

        consoleLogger(chalk.blue(`Scraping Walmart for SKU: ${sku} started`));

        if (response?.status() === 404) {
            throw new Error(`Product with SKU ${sku} not found on Walmart.`);
        }

        // CAPTA
        const isCaptcha = await page.$('#px-captcha');
        if (isCaptcha) {
            consoleLogger(chalk.white.bgRed(`CAPTCHA encountered for SKU: ${sku} on Walmart.`));
            throw new Error(`CAPTCHA encountered on Walmart for SKU: ${sku}`);
        }

        // READING DATA
        const title = await page.locator('h1#main-title').innerText();
        const price = await page.locator('span[itemprop="price"]').innerText().catch(() => "");
        const description = await page.locator('#top-highlights-module ul').innerText();
        const reviewsAndRating = await page.locator('a[itemprop="ratingCount"]').innerText();

        consoleLogger(chalk.blue(`Scraping Walmart for SKU: ${sku} completed`));

        return {
            sku,
            source: "Walmart",
            title,
            description,
            price: price.replace(/[^0-9,.$₹]/g, ""),
            reviewsAndRating: reviewsAndRating.replace(/[^K0-9,.]/g, "")
        }
    } catch (error: any) {
        consoleLogger(chalk.white.bgRed(`Error occurred while scraping Walmart for SKU: ${sku}`, error.message));        
        errorLogger(error.message);
        throw error;
    }
}