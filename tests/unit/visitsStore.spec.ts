import { describe, it, expect, vi } from 'vitest';

// Provide global window object before module imports
vi.stubGlobal('window', {} as any);

vi.mock('../../public/js/lib/db/indexeddb.js', () => ({
  list: vi.fn().mockResolvedValue([
    { id: 'a', agronomistId: 'user1' },
    { id: 'b', agronomistId: 'user2' },
    { id: 'c', authorId: 'user1' },
  ]),
  get: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

vi.mock('../../public/js/config/firebase.js', () => ({
  auth: { currentUser: { uid: 'user1' } },
  db: {},
}));

import { listVisits } from '../../public/js/stores/visitsStore.js';

describe('listVisits', () => {
  it('returns only visits belonging to current agronomist', async () => {
    const visits = await listVisits();
    expect(visits).toEqual([
      { id: 'a', agronomistId: 'user1' },
      { id: 'c', authorId: 'user1' },
    ]);
  });
});
