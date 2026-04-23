import { describe, expect, it, vi } from 'vitest';
import { createRuntimeTransport } from '../runtime-transport';

describe('createRuntimeTransport', () => {
  it('falls back to the direct transport when the shared worker cannot be created', () => {
    const fallback = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      send: vi.fn(),
      resetIdentity: vi.fn(),
      subscribeSnapshot: vi.fn(),
      subscribeMessage: vi.fn(),
      subscribeStatus: vi.fn(),
      subscribeError: vi.fn(),
      getState: vi.fn(),
      dispose: vi.fn(),
    };
    const directFactory = vi.fn(() => fallback);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    vi.stubGlobal('SharedWorker', class SharedWorkerStub {} as unknown as typeof SharedWorker);

    const transport = createRuntimeTransport({
      brokerWorkerFactory: () => {
        throw new Error('Shared worker not available');
      },
      directFactory,
    });

    expect(transport).toBe(fallback);
    expect(directFactory).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('returns a transport error state instead of silently opening a second direct websocket when shared runtime is required', async () => {
    const directFactory = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    vi.stubGlobal('SharedWorker', class SharedWorkerStub {} as unknown as typeof SharedWorker);

    const transport = createRuntimeTransport({
      brokerWorkerFactory: () => {
        throw new Error('Shared worker not available');
      },
      directFactory,
      allowDirectFallback: false,
    });

    expect(directFactory).not.toHaveBeenCalled();
    expect(transport.getState().status).toBe('error');
    expect(transport.getState().error).toBeTruthy();
    await expect(transport.connect('ws://127.0.0.1:3001')).rejects.toThrow();

    warnSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
