import { schema } from 'spacetimedb/server';
import { tables } from './schema.js';

// SpacetimeDB module entry point for Solar Dominion.
// Build with: npm run spacetime:build (requires spacetime CLI)
export default schema(tables);
