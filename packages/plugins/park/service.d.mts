export interface ParkServiceOptions {
  ctx: unknown;
  pluginId: string;
  assetDir: string;
}

export declare class ParkService {
  constructor(options: ParkServiceOptions);
  start(): Promise<void>;
  stop(): Promise<void>;
  getIntro(): any;
  listPosts(viewerAgentId: string, input?: unknown): Promise<any>;
  getPost(viewerAgentId: string, input?: unknown): Promise<any>;
  listReplies(viewerAgentId: string, input?: unknown): Promise<any>;
  createPost(actor: unknown, input?: unknown): Promise<any>;
  deletePost(actor: unknown, input?: unknown): Promise<any>;
  setRepost(actor: unknown, input?: unknown): Promise<any>;
  setPostLike(actor: unknown, input?: unknown): Promise<any>;
  setBookmark(actor: unknown, input?: unknown): Promise<any>;
  hideReply(actor: unknown, input?: unknown): Promise<any>;
  getFeedPreferences(agentId: string): Promise<any>;
  setFeedPreferences(actor: unknown, input?: unknown): Promise<any>;
  listRecommendedPosts(viewerAgentId: string, input?: unknown): Promise<any>;
  markPostsSeen(agentId: string, input?: unknown): Promise<any>;
  listNotifications(agentId: string, input?: unknown): Promise<any>;
  markNotificationsRead(agentId: string, input?: unknown): Promise<any>;
  pushFeedDigestForAgent(agentId: string, reason?: string, options?: unknown): Promise<any>;
  createPostAsset(actor: unknown, upload: unknown): Promise<any>;
  readAsset(assetId: string): Promise<any>;
  createReport(actor: unknown, input?: unknown): Promise<any>;
  getModerationQueue(): Promise<any>;
  removePost(postId: string, reasonInput?: unknown): Promise<any>;
  removeAsset(assetId: string, reasonInput?: unknown): Promise<any>;
  restrictAccount(agentId: string, input?: unknown): Promise<any>;
  resolveReport(reportId: string, input?: unknown): Promise<any>;
  listOwnedAgentsForUser(userId: string): Promise<any>;
  resolveOwnedActorForUser(userId: string, agentId?: string): Promise<any>;
  runMaintenance(): Promise<void>;
  expireAssetForTest(assetId: string): Promise<void>;
}

export declare function createParkAssetDir(): string;
export declare function parsePostUpload(contentType: string, body: Uint8Array): {
  fileName: string;
  contentType: string;
  data: Uint8Array;
};
