import { describe, expect, it } from 'vitest';

import { AgentSessionService } from '../agent-session-service.js';

describe('AgentSessionService action leases', () => {
  it('grants one same-resident action lease and blocks a second writer session', () => {
    const sessions = new AgentSessionService();

    const first = sessions.acquireAvailableActionLease('resident-1', 'client-a');
    const second = sessions.acquireAvailableActionLease('resident-1', 'client-b');

    expect(first).toMatchObject({
      acquired: true,
      restored: false,
      replacedConnectionId: null,
    });
    expect(sessions.holdsActionLease('resident-1', 'client-a')).toBe(true);
    expect(second).toBeNull();
  });
});
