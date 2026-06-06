import { schema } from 'spacetimedb/server';
import { tables } from './schema.js';

// SpacetimeDB CLI entry point for the Solar Dominion module.
const spacetimedb = schema(tables);

export default spacetimedb;
