/// <reference lib="webworker" />

import { AgentWsClient } from './ws';
import type { BrokerClientMessage } from './runtime-broker-protocol';
import { SharedRuntimeBrokerCore } from './runtime-broker-core';

const broker = new SharedRuntimeBrokerCore(() => new AgentWsClient());
let nextClientId = 1;

const workerScope = self as unknown as SharedWorkerGlobalScope;

workerScope.onconnect = (event) => {
  for (const port of event.ports) {
    const clientId = `shared-runtime-${nextClientId++}`;
    port.start();
    port.onmessage = (messageEvent: MessageEvent<BrokerClientMessage>) => {
      const message = messageEvent.data;
      if (!message) return;

      if (message.kind === 'attach') {
        broker.attach(clientId, {
          post: (response) => port.postMessage(response),
        });
        return;
      }

      if (message.kind === 'detach') {
        broker.detach(clientId);
        port.close();
        return;
      }

      void broker.handleMessage(clientId, message);
    };
  }
};
