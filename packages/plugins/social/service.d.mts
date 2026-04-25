export interface SocialServiceOptions {
  ctx: unknown;
  pluginId: string;
  assetDir: string;
  exportDir: string;
}

export declare class SocialService {
  constructor(options: SocialServiceOptions);
  start(): Promise<void>;
  stop(): Promise<void>;
  getSocialIntro(): Promise<any> | any;
  getUsageGuide(): Promise<any> | any;
  searchContacts(actor: unknown, input?: unknown): Promise<any>;
  listRelationships(agentId: string): Promise<any>;
  listRelationshipsPage(agentId: string, input?: unknown): Promise<any>;
  sendRequest(actor: unknown, input?: unknown): Promise<any>;
  respondRequest(actor: unknown, input?: unknown): Promise<any>;
  removeFriend(actor: unknown, input?: unknown): Promise<any>;
  blockAgent(actor: unknown, input?: unknown): Promise<any>;
  unblockAgent(actor: unknown, input?: unknown): Promise<any>;
  listInbox(agentId: string, input?: unknown): Promise<any>;
  openDirectThread(actor: unknown, input?: unknown): Promise<any>;
  getThreadHistory(agentId: string, input?: unknown): Promise<any>;
  sendThreadMessage(actor: unknown, input?: unknown): Promise<any>;
  markThreadRead(agentId: string, input?: unknown): Promise<any>;
  createGroup(actor: unknown, input?: unknown): Promise<any>;
  renameGroup(actor: unknown, input?: unknown): Promise<any>;
  inviteGroupMember(actor: unknown, input?: unknown): Promise<any>;
  removeGroupMember(actor: unknown, input?: unknown): Promise<any>;
  leaveGroup(actor: unknown, input?: unknown): Promise<any>;
  disbandGroup(actor: unknown, input?: unknown): Promise<any>;
  listMoments(agentId: string, input?: unknown): Promise<any>;
  createMoment(actor: unknown, input?: unknown): Promise<any>;
  deleteMoment(actor: unknown, input?: unknown): Promise<any>;
  setMomentLike(actor: unknown, input?: unknown): Promise<any>;
  listMomentComments(agentId: string, input?: unknown): Promise<any>;
  createMomentComment(actor: unknown, input?: unknown): Promise<any>;
  deleteMomentComment(actor: unknown, input?: unknown): Promise<any>;
  listMomentNotifications(agentId: string, input?: unknown): Promise<any>;
  markMomentNotificationsRead(agentId: string, input?: unknown): Promise<any>;
  createMomentAsset(actor: unknown, upload: unknown): Promise<any>;
  readAsset(viewerAgentId: string, assetId: string): Promise<any>;
  createReport(actor: unknown, input?: unknown): Promise<any>;
  getModerationQueue(): Promise<any>;
  removeMessage(messageId: string, reasonInput?: unknown): Promise<any>;
  removeMoment(momentId: string, reasonInput?: unknown): Promise<any>;
  restrictAccount(agentId: string, input?: unknown): Promise<any>;
  resolveReport(reportId: string, input?: unknown): Promise<any>;
  listOwnedAgentsForUser(userId: string): Promise<any>;
  resolveOwnedActorForUser(userId: string, agentId: string): Promise<any>;
  resolveReadableOwnedActorForUser(userId: string, agentId: string): Promise<any>;
  getPrivacyStatus(actor: unknown): Promise<any>;
  requestDataExport(actor: unknown): Promise<any>;
  readExportDownload(userId: string, requestId: string): Promise<any>;
  requestDataErasure(actor: unknown): Promise<any>;
  runMaintenance(): Promise<void>;
  pushRelationshipUpdate(agentIds: string[], options?: unknown): Promise<void>;
  pushInboxUpdate(agentIds: string[], options?: unknown): Promise<void>;
}

export declare function createSocialAssetDir(): string;
export declare function createSocialExportDir(): string;
export declare function parseMomentUpload(contentType: string, body: Uint8Array): {
  fileName: string;
  contentType: string;
  data: Uint8Array;
};
