// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ParkViewProvider, type ParkViewContextValue } from '../../../../plugins/park/frontend/context';
import { MobileNav } from '../../../../plugins/park/frontend/components/layout/MobileNav';
import { Sidebar } from '../../../../plugins/park/frontend/components/layout/Sidebar';

function makeParkContext(): ParkViewContextValue {
  const currentUser = {
    id: 'agent-1',
    handle: 'agent1',
    name: 'Agent One',
    avatarUrl: '',
    role: 'member',
  };

  return {
    activeTab: 'for-you',
    posts: [],
    agents: { [currentUser.id]: currentUser },
    currentUser,
    suggestedAgents: [],
    trends: [],
    busy: false,
    selectedPost: null,
    replies: [],
    setActiveTab: vi.fn(),
    searchPosts: vi.fn(),
    publishPost: vi.fn(),
    uploadPostAsset: vi.fn(async () => null),
    openPostDetail: vi.fn(),
    closePostDetail: vi.fn(),
    replyToPost: vi.fn(),
    quotePost: vi.fn(),
    toggleRepost: vi.fn(),
    toggleLike: vi.fn(),
    toggleBookmark: vi.fn(),
    deletePost: vi.fn(),
    hideReply: vi.fn(),
    reportPost: vi.fn(),
  };
}

async function renderParkNavigation(element: React.ReactNode) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/workspace/plugins/uruc.park/home']}>
        <ParkViewProvider value={makeParkContext()}>{element}</ParkViewProvider>
      </MemoryRouter>,
    );
  });

  return {
    container,
    cleanup: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('park plugin navigation', () => {
  it('keeps desktop sidebar links inside the workspace plugin route tree', async () => {
    const { container, cleanup } = await renderParkNavigation(<Sidebar />);

    const hrefs = Array.from(container.querySelectorAll('a'), (anchor) => anchor.getAttribute('href'));

    expect(hrefs).toEqual(expect.arrayContaining([
      '/workspace/plugins/uruc.park/home',
      '/workspace/plugins/uruc.park/explore',
      '/workspace/plugins/uruc.park/notifications',
      '/workspace/plugins/uruc.park/messages',
      '/workspace/plugins/uruc.park/profile',
      '/workspace/plugins/uruc.park/settings',
    ]));
    expect(hrefs).not.toContain('/');
    expect(hrefs.every((href) => href?.startsWith('/workspace/plugins/uruc.park/'))).toBe(true);

    await cleanup();
  });

  it('keeps mobile navigation links inside the workspace plugin route tree', async () => {
    const { container, cleanup } = await renderParkNavigation(<MobileNav />);

    const hrefs = Array.from(container.querySelectorAll('a'), (anchor) => anchor.getAttribute('href'));

    expect(hrefs).toEqual([
      '/workspace/plugins/uruc.park/home',
      '/workspace/plugins/uruc.park/explore',
      '/workspace/plugins/uruc.park/notifications',
      '/workspace/plugins/uruc.park/messages',
    ]);

    await cleanup();
  });
});
