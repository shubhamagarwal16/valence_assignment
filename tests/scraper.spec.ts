import { test, expect } from '@playwright/test';
import { scrapFromAmazon } from '../src/scraper';

test.describe('Scraper Functions', () => {
    test('scrapFromAmazon logic is working', async ({ page }) => {
        const dummySku = 'TEST_SKU_123';

        // Mock the network request to Amazon
        await page.route(`**/dp/${dummySku}`, async route => {
            const mockHtml = `
            <!DOCTYPE html>
            <html>
              <body>
                <span id="productTitle"> Playwright Testing Book </span>
                <div class="apex-core-price-identifier">
                  <span class="apex-pricetopay-value priceToPay">
                    <span class="a-price-symbol">₹</span>
                    <span class="a-price-whole">499</span>
                    <span class="a-price-fraction">.00</span>
                  </span>
                </div>
                <div id="feature-bullets">
                  <ul>
                    <li>Best test book</li>
                  </ul>
                </div>
                <div id="averageCustomerReviews_feature_div">
                  <div id="averageCustomerReviews">
                    <a id="acrCustomerReviewLink">
                      <span id="acrCustomerReviewText">42 ratings</span>
                    </a>
                  </div>
                </div>
              </body>
            </html>
            `;

            await route.fulfill({ contentType: 'text/html', body: mockHtml });
        });

        // Call the scraper function
        const result = await scrapFromAmazon(page, dummySku);

        // Assertions
        expect(result.source).toBe('Amazon');
        expect(result.sku).toBe(dummySku);
        expect(result.title).toBe('Playwright Testing Book');
        expect(result.price).toBe('499.00');
        expect(result.description).toBe('Best test book');
        expect(result.reviewsAndRating).toBe('42');
    });

    test('handles 404 error from Amazon', async ({ page }) => {
        const dummySku = 'INVALID_SKU';

        // Mock the network request to return 404
        await page.route(`**/dp/${dummySku}`, async route => {
            await route.fulfill({ status: 404, contentType: 'text/html', body: '<html><body>404 Not Found</body></html>' });
        });

        // Expect the function to throw an error
        await expect(scrapFromAmazon(page, dummySku)).rejects.toThrow(`Product with SKU ${dummySku} not found on Amazon.`);
    });
})