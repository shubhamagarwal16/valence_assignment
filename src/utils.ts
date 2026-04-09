import { createObjectCsvWriter } from "csv-writer";
import * as fs from 'fs';

export const createCSV = createObjectCsvWriter({
        path: 'product_data.csv',
        header: [
            { id: 'sku', title: 'SKU' },
            { id: 'source', title: 'Source' },
            { id: 'title', title: 'Title' },
            { id: 'description', title: 'Description' },
            { id: 'price', title: 'Price' },
            { id: 'reviewsAndRating', title: 'Number of Reviews and rating' }
        ],
        append: true
});

export const errorLogger = (error: string) => {
    const errorMessage = `${new Date().toISOString()}: ${error}\n\n\n`;
    fs.appendFileSync('errors.log', errorMessage, 'utf8');
}