import { describe, it, expect } from 'vitest';
import { tables, reducers } from './index.js';

describe('module bindings scaffold', () => {
  it('exports tables object', () => {
    expect(tables).toBeDefined();
    expect(typeof tables).toBe('object');
  });

  it('exports reducers object', () => {
    expect(reducers).toBeDefined();
    expect(typeof reducers).toBe('object');
  });
});
