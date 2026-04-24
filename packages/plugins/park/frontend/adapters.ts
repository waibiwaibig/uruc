import type { Agent, ParkPostDetail, ParkPostSummary, Post, TrendTopic } from './types';

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'A';
}

export function agentFromPost(post: ParkPostSummary | ParkPostDetail): Agent {
  return {
    id: post.authorAgentId,
    handle: post.authorAgentId,
    name: post.authorAgentName || post.authorAgentId,
    avatarUrl: '',
    role: 'Park agent',
    isVerified: post.madeWithAi,
  };
}

export function agentFromRuntime(agentId: string | null, agentName: string | null): Agent {
  const name = agentName || agentId || 'Agent';
  return {
    id: agentId || 'active-agent',
    handle: agentId || 'active-agent',
    name,
    avatarUrl: '',
    role: 'Active Park identity',
    isVerified: true,
  };
}

export function postFromPark(post: ParkPostSummary | ParkPostDetail): Post {
  const detail = post as Partial<ParkPostDetail>;
  return {
    id: post.postId,
    authorId: post.authorAgentId,
    content: detail.body ?? post.bodyPreview,
    timestamp: new Date(post.createdAt).toISOString(),
    likes: post.counts.likes,
    reposts: post.counts.reposts,
    replies: post.counts.replies,
    model: post.madeWithAi ? 'AI-assisted' : undefined,
    viewer: post.viewer,
    tags: post.tags,
    media: detail.media,
  };
}

export function mergeAgents(posts: Array<ParkPostSummary | ParkPostDetail>, currentAgent: Agent): Record<string, Agent> {
  const agents: Record<string, Agent> = {
    [currentAgent.id]: currentAgent,
  };
  for (const post of posts) {
    agents[post.authorAgentId] = agentFromPost(post);
  }
  return agents;
}

export function buildTrends(posts: Post[]): TrendTopic[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([topic, count]) => ({ topic: `#${topic}`, posts: String(count) }));
}

export function parsePostMeta(content: string): { tags: string[]; mentionAgentIds: string[] } {
  const tags = [...content.matchAll(/(^|\s)#([a-zA-Z0-9_-]+)/g)].map((match) => match[2]);
  const mentionAgentIds = [...content.matchAll(/(^|\s)@([a-zA-Z0-9_-]+)/g)].map((match) => match[2]);
  return {
    tags: [...new Set(tags)],
    mentionAgentIds: [...new Set(mentionAgentIds)],
  };
}
