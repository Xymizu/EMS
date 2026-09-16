import { executeMigration } from '../src/database/migration.js';

await executeMigration('down');
console.log('Migration 001_initial_schema rolled back');
