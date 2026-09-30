import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { userStorageKey, readUserData, writeUserData } from '../src/lib/userStorage.ts';

const originalStorage = globalThis.localStorage;
let entries: Map<string, string>;
beforeEach(() => {
  entries = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => entries.set(key, value),
    },
  });
});
afterEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: originalStorage });
});

test('all personal resources are isolated between accounts sharing a browser', () => {
  for (const resource of ['itineraries', 'current-itinerary', 'photo-journals', 'visited-provinces']) {
    writeUserData('alice', resource, [{ id: 'alice-data' }]);
    assert.deepEqual(readUserData('bob', resource, []), []);
    writeUserData('bob', resource, [{ id: 'bob-data' }]);
    assert.deepEqual(readUserData('alice', resource, []), [{ id: 'alice-data' }]);
    assert.deepEqual(readUserData('bob', resource, []), [{ id: 'bob-data' }]);
  }
});

test('shared legacy data is not assigned to an arbitrary signed-in user', () => {
  for (const key of ['vietnam_saved_itineraries', 'vietnam_current_itinerary', 'vietnam_photo_journals', 'vietnam_visited_provinces']) {
    entries.set(key, JSON.stringify([{ id: 'unknown-owner' }]));
  }
  assert.deepEqual(readUserData('alice', 'itineraries', []), []);
  assert.equal(readUserData('alice', 'current-itinerary', null), null);
});

test('signed-out users cannot read or write an account cache', () => {
  writeUserData('alice', 'itineraries', ['private']);
  assert.deepEqual(readUserData('', 'itineraries', []), []);
  assert.throws(() => writeUserData('', 'itineraries', ['guest']));
});

test('corrupt data falls back only within the requested account', () => {
  entries.set(userStorageKey('alice', 'itineraries'), '{');
  writeUserData('bob', 'itineraries', ['private']);
  assert.deepEqual(readUserData('alice', 'itineraries', []), []);
  assert.deepEqual(readUserData('bob', 'itineraries', []), ['private']);
});

test('UID delimiters cannot collide with other users or resource keys', () => {
  assert.notEqual(userStorageKey('alice:plans', 'data'), userStorageKey('alice', 'plans:data'));
});
