// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NotificationProvider, useNotifications } from '../NotificationProvider';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function NotificationProbe() {
  const { notify } = useNotifications();

  return (
    <div>
      <button type="button" onClick={() => notify({ type: 'success', message: 'Saved' })}>success</button>
      <button type="button" onClick={() => notify({ type: 'info', message: 'Heads up' })}>info</button>
      <button type="button" onClick={() => notify({ type: 'warning', message: 'Careful' })}>warning</button>
      <button type="button" onClick={() => notify({ type: 'error', message: 'Failed' })}>error</button>
    </div>
  );
}

async function renderNotifications() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <NotificationProvider>
        <NotificationProbe />
      </NotificationProvider>,
    );
  });

  return {
    container,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

async function click(button: Element | null) {
  expect(button).toBeTruthy();
  await act(async () => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('NotificationProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('renders typed toasts in a fixed live region', async () => {
    const mounted = await renderNotifications();

    await click(mounted.container.querySelector('button'));
    await click([...mounted.container.querySelectorAll('button')].find((button) => button.textContent === 'info') ?? null);
    await click([...mounted.container.querySelectorAll('button')].find((button) => button.textContent === 'warning') ?? null);
    await click([...mounted.container.querySelectorAll('button')].find((button) => button.textContent === 'error') ?? null);

    const viewport = document.body.querySelector<HTMLElement>('[data-uruc-notification-viewport]');
    expect(viewport).toBeTruthy();
    expect(viewport?.className).toContain('fixed');
    expect(viewport?.getAttribute('aria-live')).toBe('polite');
    expect(document.body.querySelector('[data-uruc-notification-assertive]')?.getAttribute('aria-live')).toBe('assertive');
    expect(document.body.textContent).toContain('Saved');
    expect(document.body.textContent).toContain('Heads up');
    expect(document.body.textContent).toContain('Careful');
    expect(document.body.textContent).toContain('Failed');

    await mounted.unmount();
  });

  it('dismisses a toast with its close button', async () => {
    const mounted = await renderNotifications();

    await click(mounted.container.querySelector('button'));
    expect(document.body.textContent).toContain('Saved');

    await click(document.body.querySelector('button[aria-label="Dismiss notification"]'));
    expect(document.body.textContent).not.toContain('Saved');

    await mounted.unmount();
  });

  it('auto-dismisses success toasts but keeps errors by default', async () => {
    vi.useFakeTimers();
    const mounted = await renderNotifications();

    await click(mounted.container.querySelector('button'));
    await click([...mounted.container.querySelectorAll('button')].find((button) => button.textContent === 'error') ?? null);

    await act(async () => {
      vi.advanceTimersByTime(4500);
    });

    expect(document.body.textContent).not.toContain('Saved');
    expect(document.body.textContent).toContain('Failed');

    await mounted.unmount();
  });
});
