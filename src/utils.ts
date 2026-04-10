import { createObjectCsvWriter } from "csv-writer";
import * as fs from 'fs';

const csvFilePath = 'product_data.csv';
const csvFileExists = fs.existsSync(csvFilePath);

export const createCSV = createObjectCsvWriter({
        path: csvFilePath,
        header: [
            { id: 'sku', title: 'SKU' },
            { id: 'source', title: 'Source' },
            { id: 'title', title: 'Title' },
            { id: 'description', title: 'Description' },
            { id: 'price', title: 'Price' },
            { id: 'reviewsAndRating', title: 'Number of Reviews and rating' }
        ],
        append: csvFileExists
});

export const errorLogger = (error: string) => {
    const errorMessage = `${new Date().toISOString()}: ${error}\n\n\n`;
    fs.appendFileSync('errors.log', errorMessage, 'utf8');
}

export const consoleLogger = (message: any) => {
    console.log(`${new Date().toISOString()}: ${message}`);
}