import * as fs from 'fs';
import { consoleLogger } from './utils.ts';
import chalk from 'chalk';

(function cleanFiles() {
    consoleLogger(chalk.white.bgGreen("Removing product_data and errors.log if they exist..."));
    
    fs.unlink('product_data.csv', (err) => {});
    fs.unlink('errors.log', (err) => {});
    
    consoleLogger(chalk.white.bgGreen("DONE"));
})()