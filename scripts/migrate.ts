import { executeMigration } from '../src/database/migration.js';

await executeMigration('up');
console.log('Migration 001_initial_schema applied');
