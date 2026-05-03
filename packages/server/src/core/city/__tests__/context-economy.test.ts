import { beforeEach, describe, expect, it } from 'vitest';

import { registerCityCommands } from '../commands.js';
import { HookRegistry, type WSMessage } from '../../plugin-system/hook-registry.js';

function createWsContext(sent: WSMessage[]) {
  return {
    ws: {},
    session: {
      userId: 'user-context-economy',
      agentId: 'agent-context-economy',
      agentName: 'Context Economy Agent',
      role: 'agent' as const,
      trustMode: 'full' as const,
    },
    inCity: true,
    currentLocation: null,
    isActionLeaseHolder: true,
    hasActionLease: true,
    currentTable: null,
    gateway: {
      send(_ws: unknown, msg: WSMessage) {
        sent.push(msg);
      },
      broadcast() {},
      sendToAgent() {},
      pushToOwner() {},
      getOnlineAgentIds() {
        return [];
      },
    },
    setLocation() {},
    setInCity() {},
  };
}

describe('core context economy responses', () => {
  let hooks: HookRegistry;
  let sent: WSMessage[];

  beforeEach(() => {
    hooks = new HookRegistry();
    registerCityCommands(hooks);
    sent = [];
  });

  it('bounds plugin command discovery detail by default and returns the next detail request ref', async () => {
    for (let i = 0; i < 25; i += 1) {
      hooks.registerWSCommand(`acme.echo.command_${i}@v1`, () => undefined, {
        type: `acme.echo.command_${i}@v1`,
        description: `Echo command ${i}`,
        pluginName: 'acme.echo',
        params: {
          text: { type: 'string', description: 'Short text to echo.' },
        },
        actionLeasePolicy: { required: false },
      });
    }

    await hooks.handleWSCommand('what_can_i_do', createWsContext(sent) as any, {
      id: 'discover-1',
      type: 'what_can_i_do',
      payload: { scope: 'plugin', pluginId: 'acme.echo' },
    });

    expect(sent.at(-1)).toMatchObject({
      id: 'discover-1',
      type: 'result',
      payload: {
        level: 'detail',
        target: { scope: 'plugin', pluginId: 'acme.echo' },
        page: {
          limit: 20,
          returned: 20,
          total: 25,
          nextCursor: '20',
        },
        nextDetailRequest: {
          type: 'what_can_i_do',
          payload: { scope: 'plugin', pluginId: 'acme.echo', cursor: '20', limit: 20 },
        },
      },
    });

    expect((sent.at(-1)?.payload as any).commands).toHaveLength(20);
  });
});
