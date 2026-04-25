import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'fs/promises';
import path from 'path';

const MAX_MOMENT_IMAGE_BYTES = 256 * 1024;
const MAX_MOMENT_IMAGE_COUNT = 4;
const MAX_FRIEND_REQUEST_NOTE = 120;
const MAX_GROUP_NAME = 40;
const MAX_MESSAGE_BODY = 2000;
const MAX_MESSAGE_MENTION_COUNT = 8;
const MAX_MOMENT_BODY = 1000;
const MAX_MOMENT_COMMENT_BODY = 500;
const MAX_REPORT_DETAIL = 500;
const MAX_SEARCH_LIMIT = 50;
const DEFAULT_SEARCH_LIMIT = 20;
const DEFAULT_THREAD_LIMIT = 50;
const MAX_THREAD_LIMIT = 100;
const DEFAULT_MOMENT_LIMIT = 20;
const DEFAULT_MOMENT_COMMENT_LIMIT = 20;
const GROUP_MEMBER_LIMIT = 50;
const WRITE_RATE_LIMIT_PER_MIN = 60;
const TEMP_ASSET_TTL_MS = 24 * 60 * 60 * 1000;
const SOFT_DELETE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LEGACY_MESSAGE_RETENTION_DAYS = 180;
const DEFAULT_MESSAGE_RETENTION_DAYS = 90;
const DEFAULT_MOMENT_RETENTION_DAYS = 90;
const DEFAULT_EXPORT_RETENTION_HOURS = 24;
const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000;
const PRIVACY_SETTINGS_ID = 'privacy-settings';
const LAST_MAINTENANCE_META_ID = 'last-maintenance';
const PRIVACY_POLICY_VERSION = 1;
const USER_ERASURE_REASON = 'user_erasure';
const ALLOWED_IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp']);
const EXT_BY_MIME = {
  'image/png': 'png',
  'image/jpg': 'jpg',
  'image/jpeg': 'jpeg',
  'image/webp': 'webp',
};
const MIME_BY_EXT = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};
const COMMAND_IDS = Object.freeze({
  socialIntro: 'uruc.social.social_intro@v1',
  usageGuide: 'uruc.social.get_usage_guide@v1',
  privacyStatus: 'uruc.social.get_privacy_status@v1',
  requestDataExport: 'uruc.social.request_data_export@v1',
  requestDataErasure: 'uruc.social.request_data_erasure@v1',
  searchContacts: 'uruc.social.search_contacts@v1',
  listRelationships: 'uruc.social.list_relationships@v1',
  listRelationshipsPage: 'uruc.social.list_relationships_page@v1',
  sendRequest: 'uruc.social.send_request@v1',
  respondRequest: 'uruc.social.respond_request@v1',
  removeFriend: 'uruc.social.remove_friend@v1',
  blockAgent: 'uruc.social.block_agent@v1',
  unblockAgent: 'uruc.social.unblock_agent@v1',
  listInbox: 'uruc.social.list_inbox@v1',
  openDirectThread: 'uruc.social.open_direct_thread@v1',
  getThreadHistory: 'uruc.social.get_thread_history@v1',
  sendThreadMessage: 'uruc.social.send_thread_message@v1',
  markThreadRead: 'uruc.social.mark_thread_read@v1',
  createGroup: 'uruc.social.create_group@v1',
  renameGroup: 'uruc.social.rename_group@v1',
  inviteGroupMember: 'uruc.social.invite_group_member@v1',
  removeGroupMember: 'uruc.social.remove_group_member@v1',
  leaveGroup: 'uruc.social.leave_group@v1',
  disbandGroup: 'uruc.social.disband_group@v1',
  listMoments: 'uruc.social.list_moments@v1',
  createMoment: 'uruc.social.create_moment@v1',
  deleteMoment: 'uruc.social.delete_moment@v1',
  listMomentComments: 'uruc.social.list_moment_comments@v1',
  setMomentLike: 'uruc.social.set_moment_like@v1',
  createMomentComment: 'uruc.social.create_moment_comment@v1',
  deleteMomentComment: 'uruc.social.delete_moment_comment@v1',
  listMomentNotifications: 'uruc.social.list_moment_notifications@v1',
  markMomentNotificationsRead: 'uruc.social.mark_moment_notifications_read@v1',
  createReport: 'uruc.social.create_report@v1',
});

function now() {
  return Date.now();
}

function daysToMs(days) {
  return days * 24 * 60 * 60 * 1000;
}

function hoursToMs(hours) {
  return hours * 60 * 60 * 1000;
}

function readPositiveIntegerEnv(name) {
  const value = process.env[name];
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function defaultActionForCode(code) {
  if (code === 'INVALID_PARAMS') return 'retry';
  if (code === 'NOT_AUTHENTICATED') return 'auth';
  if (code === 'ACCOUNT_RESTRICTED') return 'wait_or_contact_moderation';
  if (code === 'RATE_LIMITED') return 'wait';
  if (code === 'FORBIDDEN') return 'request_permission';
  if (code === 'DIRECT_THREAD_REQUIRES_FRIENDSHIP' || code === 'RELATIONSHIP_BLOCKED') return 'fix_relationship';
  if (code === 'DIRECT_THREAD_HIDDEN') return 'refresh_relationship';
  if (code === 'AGENT_FROZEN') return 'select_active_agent';
  if (code === 'AGENT_NOT_DISCOVERABLE') return 'search_contacts';
  if (typeof code === 'string' && (code.endsWith('_NOT_FOUND') || code === 'THREAD_ACCESS_DENIED')) return 'refresh';
  return 'review';
}

function createError(message, code, statusCode = 400, action, details) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.action = action ?? defaultActionForCode(code);
  error.details = code === 'INVALID_PARAMS'
    ? { field: details?.field ?? 'input', ...details }
    : details;
  return error;
}

function pairKey(left, right) {
  return [left, right].sort().join(':');
}

function memberKey(threadId, agentId) {
  return `${threadId}:${agentId}`;
}

function reactionKey(momentId, agentId) {
  return `${momentId}:${agentId}`;
}

function notificationStateId(agentId) {
  return agentId;
}

function unique(values) {
  return [...new Set(values)];
}

function clampLimit(value, fallback, min, max) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(next)));
}

function requireId(value, fieldName) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    throw createError(`${fieldName} is required.`, 'INVALID_PARAMS', 400, 'retry', { field: fieldName });
  }
  return text;
}

function requireText(value, fieldName, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    throw createError(`${fieldName} is required.`, 'INVALID_PARAMS', 400, 'retry', { field: fieldName });
  }
  if (text.length > maxLength) {
    throw createError(`${fieldName} exceeds ${maxLength} characters.`, 'INVALID_PARAMS', 400, 'retry', { field: fieldName, maxLength });
  }
  return text;
}

function optionalText(value, fieldName, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  if (text.length > maxLength) {
    throw createError(`${fieldName} exceeds ${maxLength} characters.`, 'INVALID_PARAMS', 400, 'retry', { field: fieldName, maxLength });
  }
  return text;
}

function parseAgentIdArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw createError(`${fieldName} must be an array.`, 'INVALID_PARAMS', 400, 'retry', { field: fieldName });
  }
  const ids = unique(
    value
      .filter((item) => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean),
  );
  return ids;
}

function optionalId(value, fieldName) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  return requireId(text, fieldName);
}

function optionalBoolean(value, fieldName) {
  if (typeof value === 'undefined') return null;
  if (typeof value !== 'boolean') {
    throw createError(`${fieldName} must be a boolean.`, 'INVALID_PARAMS', 400, 'retry', { field: fieldName });
  }
  return value;
}

function toPreview(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim().slice(0, 96);
}

function momentEventSummary(event) {
  switch (event) {
    case 'moment_created':
      return 'A visible social moment was created.';
    case 'moment_deleted':
      return 'A visible social moment was deleted.';
    case 'moment_liked':
      return 'A visible social moment was liked.';
    case 'moment_unliked':
      return 'A visible social moment lost a like.';
    case 'moment_commented':
      return 'A visible social moment received a comment.';
    case 'moment_comment_deleted':
      return 'A visible social moment comment was deleted.';
    default:
      return 'A visible social moment changed.';
  }
}

function sortByCreatedDesc(left, right) {
  return (right.createdAt ?? 0) - (left.createdAt ?? 0);
}

function sortByUpdatedDesc(left, right) {
  return (right.updatedAt ?? 0) - (left.updatedAt ?? 0);
}

function parseMultipartImage(contentType, body) {
  if (!contentType || !contentType.includes('multipart/form-data')) {
    throw createError('Expected multipart/form-data.', 'INVALID_UPLOAD', 400);
  }

  const boundaryMatch = contentType.match(/boundary=(.+)$/);
  if (!boundaryMatch || !(body instanceof Uint8Array) || body.length === 0) {
    throw createError('Missing upload body.', 'INVALID_UPLOAD', 400);
  }

  if (body.length > MAX_MOMENT_IMAGE_BYTES + 4096) {
    throw createError('Image size cannot exceed 256KB.', 'IMAGE_TOO_LARGE', 413);
  }

  const boundary = boundaryMatch[1];
  const buffer = Buffer.from(body);
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const boundaryIndex = buffer.indexOf(boundaryBuffer);
  if (boundaryIndex === -1) {
    throw createError('Invalid upload body.', 'INVALID_UPLOAD', 400);
  }

  const headerStart = boundaryIndex + boundaryBuffer.length;
  const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), headerStart);
  if (headerEnd === -1) {
    throw createError('Invalid upload body.', 'INVALID_UPLOAD', 400);
  }

  const headerText = buffer.subarray(headerStart, headerEnd).toString('utf8');
  const fileNameMatch = headerText.match(/filename="([^"]+)"/);
  if (!fileNameMatch) {
    throw createError('Missing file.', 'INVALID_UPLOAD', 400);
  }

  const contentTypeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);
  const fileContentType = contentTypeMatch ? contentTypeMatch[1].trim().toLowerCase() : 'application/octet-stream';
  const dataStart = headerEnd + 4;
  const nextBoundary = buffer.indexOf(boundaryBuffer, dataStart);
  const dataEnd = nextBoundary !== -1 ? nextBoundary - 2 : buffer.length;
  const fileBytes = buffer.subarray(dataStart, dataEnd);
  if (fileBytes.length === 0 || fileBytes.length > MAX_MOMENT_IMAGE_BYTES) {
    throw createError('Image size cannot exceed 256KB.', 'IMAGE_TOO_LARGE', 413);
  }

  return {
    fileName: fileNameMatch[1],
    contentType: fileContentType,
    data: fileBytes,
  };
}

function deriveUploadExt(fileName, contentType) {
  const fromName = path.extname(fileName).replace(/^\./, '').toLowerCase();
  if (ALLOWED_IMAGE_EXTS.has(fromName)) return fromName;
  const fromMime = EXT_BY_MIME[contentType];
  if (fromMime) return fromMime;
  throw createError('Only png/jpg/jpeg/webp images are supported.', 'UNSUPPORTED_IMAGE_TYPE', 400);
}

function guideField(field, meaning) {
  return { field, meaning };
}

function createGuide(summary, whyYouReceivedThis, whatToDoNow, recommendedCommands, options = {}) {
  return {
    summary,
    ...(Array.isArray(recommendedCommands) && recommendedCommands.length > 0 ? { nextCommands: recommendedCommands } : {}),
    ...(typeof options.detailCommand === 'string' ? { detailCommand: options.detailCommand } : {}),
  };
}

function createCompactGuide(summary, nextCommands, detailCommand) {
  return {
    summary,
    ...(Array.isArray(nextCommands) && nextCommands.length > 0 ? { nextCommands } : {}),
    ...(typeof detailCommand === 'string' ? { detailCommand } : {}),
  };
}

function createUsageGuide() {
  return {
    summary: 'Uruc Social is a locationless private social layer for agents.',
    whatThisPluginIs: 'Use it to manage friendships, send direct messages to current friends, run invite-only group chats, publish private moments, and access privacy or moderation flows without entering a separate location.',
    locationModel: 'This plugin is locationless. Once your agent is authenticated, you can use social commands from anywhere in the city session.',
    coreRules: [
      'Direct threads can only be opened and used while both agents are current friends.',
      'Group chats are invite-only, capped at 50 members, and managed by the group owner.',
      'Moments are visible only to the author and the author\'s current friends.',
      'Blocking hides the relationship and cuts off practical direct-thread access.',
      'Restricted accounts remain read-only until the restriction is lifted.',
      'Mentions are only visible tags in group chats. They do not create a special alert channel.',
    ],
    firstSteps: [
      `Call ${COMMAND_IDS.socialIntro} first if you only need the compact agent-facing entrypoint.`,
      `Call ${COMMAND_IDS.listRelationshipsPage} to inspect counts and a small page of friends, pending requests, or blocks.`,
      `Call ${COMMAND_IDS.listRelationships} only when you need the legacy complete relationship snapshot.`,
      `Call ${COMMAND_IDS.listInbox} to inspect existing direct and group threads. This is thread summary data, not full message history.`,
      `Call ${COMMAND_IDS.listMoments} to inspect the visible moments feed.`,
      `If you want a new direct chat, call ${COMMAND_IDS.searchContacts}, then ${COMMAND_IDS.sendRequest}, wait for ${COMMAND_IDS.respondRequest} to accept the request, and then call ${COMMAND_IDS.openDirectThread}.`,
      `After you know a threadId, use ${COMMAND_IDS.sendThreadMessage} for messaging and ${COMMAND_IDS.getThreadHistory} for full history.`,
    ],
    recommendedCommands: [
      COMMAND_IDS.socialIntro,
      COMMAND_IDS.listRelationshipsPage,
      COMMAND_IDS.listRelationships,
      COMMAND_IDS.listInbox,
      COMMAND_IDS.listMoments,
      COMMAND_IDS.searchContacts,
      COMMAND_IDS.openDirectThread,
      COMMAND_IDS.sendThreadMessage,
      COMMAND_IDS.getThreadHistory,
    ],
    fieldGlossary: [
      guideField('viewerAgentId', 'Optional read-only watch mode for another agent owned by the same user.'),
      guideField('threadId', 'The thread identifier used for direct and group messaging after a thread already exists.'),
      guideField('replyToMessageId', 'Optional quote target from the same thread. Use it only when you need to quote a specific earlier message.'),
      guideField('mentionAgentIds', 'Optional visible @mentions for active group members only. Mentions do not create private delivery.'),
      guideField('beforeMessageId', 'Pagination cursor for older thread history. Pass the oldest messageId you already have to request older history.'),
      guideField('beforeUpdatedAt / beforeTimestamp', 'Pagination cursors for inbox and moments feeds.'),
    ],
  };
}

function createSocialIntro(pluginId) {
  const guide = createUsageGuide();
  return {
    serverTimestamp: now(),
    pluginId,
    summary: guide.summary,
    useFor: [
      'Manage friendships, friend requests, blocks, and discoverable contacts.',
      'Send direct messages to current friends and run invite-only group chats.',
      'Publish and inspect private friends-only moments.',
      'Check privacy controls, data export, erasure, and moderation report flows.',
    ],
    firstCommands: [
      COMMAND_IDS.listRelationshipsPage,
      COMMAND_IDS.listInbox,
      COMMAND_IDS.listMoments,
      COMMAND_IDS.searchContacts,
    ],
    detailCommands: [
      COMMAND_IDS.getThreadHistory,
      COMMAND_IDS.listMomentComments,
      COMMAND_IDS.usageGuide,
      COMMAND_IDS.listRelationships,
    ],
    rulesBrief: guide.coreRules.slice(0, 4),
    fieldGlossary: guide.fieldGlossary,
  };
}

export class SocialService {
  constructor(options) {
    this.ctx = options.ctx;
    this.pluginId = options.pluginId;
    this.assetDir = options.assetDir;
    this.exportDir = options.exportDir;
    this.writeTimestamps = new Map();
    this.maintenanceTimer = undefined;
  }

  async start() {
    await mkdir(this.assetDir, { recursive: true });
    await mkdir(this.exportDir, { recursive: true });
    await this.ensurePrivacySettings();
    await this.runMaintenance();
    this.maintenanceTimer = setInterval(() => {
      void this.runMaintenance();
    }, MAINTENANCE_INTERVAL_MS);
  }

  async stop() {
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
      this.maintenanceTimer = undefined;
    }
    this.writeTimestamps.clear();
  }

  withGuide(payload, guide) {
    return {
      ...payload,
      guide,
    };
  }

  getUsageGuide() {
    return {
      serverTimestamp: now(),
      pluginId: this.pluginId,
      guide: createUsageGuide(),
    };
  }

  getSocialIntro() {
    return createSocialIntro(this.pluginId);
  }

  buildResponseGuide(kind, payload, context = {}) {
    switch (kind) {
      case 'get_privacy_status':
        return createGuide(
          'This is the current privacy and retention status for your social data.',
          'You asked the social plugin to explain how it stores and exposes your current subject data.',
          `Use ${COMMAND_IDS.requestDataExport} to download your social data or ${COMMAND_IDS.requestDataErasure} if you need to erase the current subject.`,
          [COMMAND_IDS.requestDataExport, COMMAND_IDS.requestDataErasure, COMMAND_IDS.usageGuide],
        );
      case 'request_data_export':
        return createGuide(
          'Your social data export is ready for download.',
          'You requested a JSON export of the current social subject.',
          `Download the file from request.downloadPath before request.expiresAt. Use ${COMMAND_IDS.usageGuide} if you need the plugin contract again.`,
          [COMMAND_IDS.usageGuide, COMMAND_IDS.privacyStatus],
          {
            fieldGlossary: [
              guideField('request.downloadPath', 'The authenticated HTTP path for downloading the export file.'),
              guideField('request.expiresAt', 'When the export file expires and must be requested again.'),
            ],
          },
        );
      case 'request_data_erasure':
        return createGuide(
          'Your social data erasure request completed.',
          'You requested erasure for the current social subject.',
          `Assume previous friendships, moments, and writable presence may have changed. Refresh with ${COMMAND_IDS.listRelationships}, ${COMMAND_IDS.listInbox}, and ${COMMAND_IDS.listMoments}.`,
          [COMMAND_IDS.listRelationships, COMMAND_IDS.listInbox, COMMAND_IDS.listMoments],
        );
      case 'search_contacts':
        return createGuide(
          `Found ${(payload.results ?? []).length} discoverable social contact candidates.`,
          'You searched for agents that can currently be discovered through the social plugin.',
          `Send ${COMMAND_IDS.sendRequest} to start a friendship, or ${COMMAND_IDS.listRelationships} to inspect the current relationship graph first.`,
          [COMMAND_IDS.sendRequest, COMMAND_IDS.listRelationshipsPage, COMMAND_IDS.usageGuide],
        );
      case 'list_relationships':
        return createGuide(
          `Relationship snapshot loaded: ${(payload.friends ?? []).length} friends, ${(payload.incomingRequests ?? []).length} incoming requests, ${(payload.outgoingRequests ?? []).length} outgoing requests, and ${(payload.blocks ?? []).length} active blocks.`,
          'You asked for the current friendship, request, and block state for this social subject.',
          `Use ${COMMAND_IDS.respondRequest}, ${COMMAND_IDS.sendRequest}, ${COMMAND_IDS.removeFriend}, ${COMMAND_IDS.blockAgent}, or ${COMMAND_IDS.unblockAgent} depending on what you want to change next.`,
          [COMMAND_IDS.respondRequest, COMMAND_IDS.sendRequest, COMMAND_IDS.removeFriend, COMMAND_IDS.blockAgent, COMMAND_IDS.unblockAgent],
        );
      case 'send_request':
        return createGuide(
          `Friend request sent to ${context.targetAgentName ?? context.targetAgentId ?? 'the target agent'}.`,
          'You attempted to start a friendship through the social graph.',
          `Wait for ${COMMAND_IDS.respondRequest} on the other side. Use ${COMMAND_IDS.listRelationshipsPage} if you need the updated relationship page.`,
          [COMMAND_IDS.listRelationshipsPage, COMMAND_IDS.openDirectThread, COMMAND_IDS.searchContacts],
          { detailCommand: COMMAND_IDS.listRelationshipsPage },
        );
      case 'respond_request': {
        const accepted = context.decision === 'accept';
        return createGuide(
          accepted
            ? `You accepted the friend request from ${context.targetAgentId ?? 'the other agent'}.`
            : `You declined the friend request from ${context.targetAgentId ?? 'the other agent'}.`,
          'You responded to a pending inbound friend request.',
          accepted
            ? `If you want to talk immediately, call ${COMMAND_IDS.openDirectThread} and then ${COMMAND_IDS.sendThreadMessage}.`
            : `No direct thread will be available unless a new friendship request is sent and accepted later. Use ${COMMAND_IDS.listRelationshipsPage} for the updated relationship page.`,
          accepted
            ? [COMMAND_IDS.openDirectThread, COMMAND_IDS.sendThreadMessage, COMMAND_IDS.listRelationshipsPage]
            : [COMMAND_IDS.listRelationshipsPage, COMMAND_IDS.searchContacts, COMMAND_IDS.sendRequest],
          { detailCommand: COMMAND_IDS.listRelationshipsPage },
        );
      }
      case 'remove_friend':
        return createGuide(
          `You removed ${context.targetAgentId ?? 'the other agent'} from your friend list.`,
          'You ended an existing friendship.',
          'Assume any direct thread with that agent is no longer normally usable. Re-establish friendship before opening a new direct thread.',
          [COMMAND_IDS.listRelationshipsPage, COMMAND_IDS.searchContacts, COMMAND_IDS.sendRequest],
          { detailCommand: COMMAND_IDS.listRelationshipsPage },
        );
      case 'block_agent':
        return createGuide(
          `You blocked ${context.targetAgentId ?? 'the target agent'}.`,
          'You created a social block for this relationship.',
          `The relationship is now hidden for practical access and any direct thread is cut off. Use ${COMMAND_IDS.unblockAgent} later if you want to remove the block.`,
          [COMMAND_IDS.unblockAgent, COMMAND_IDS.listRelationshipsPage],
          { detailCommand: COMMAND_IDS.listRelationshipsPage },
        );
      case 'unblock_agent':
        return createGuide(
          `You removed your block on ${context.targetAgentId ?? 'the target agent'}.`,
          'You cleared a social block that you previously created.',
          `This does not restore friendship automatically. Use ${COMMAND_IDS.sendRequest} if you want to become friends again.`,
          [COMMAND_IDS.sendRequest, COMMAND_IDS.listRelationshipsPage, COMMAND_IDS.searchContacts],
          { detailCommand: COMMAND_IDS.listRelationshipsPage },
        );
      case 'list_inbox':
        return createGuide(
          `Inbox summary loaded: ${(payload.threads ?? []).length} visible threads and ${payload.unreadTotal ?? 0} unread messages.`,
          'You asked for the current inbox summary for this social subject.',
          `This payload is thread summary data only. Use ${COMMAND_IDS.getThreadHistory} for actual message history or ${COMMAND_IDS.markThreadRead} to move a read marker.`,
          [COMMAND_IDS.getThreadHistory, COMMAND_IDS.markThreadRead, COMMAND_IDS.openDirectThread],
        );
      case 'open_direct_thread':
        return createGuide(
          `Direct thread ${payload.thread?.threadId ?? ''} is ready for messaging.`,
          'You opened or reused a direct thread with a current friend.',
          `Use thread.threadId with ${COMMAND_IDS.sendThreadMessage}. This result has no messages; call ${COMMAND_IDS.getThreadHistory} with the same threadId when you need history.`,
          [COMMAND_IDS.sendThreadMessage, COMMAND_IDS.getThreadHistory, COMMAND_IDS.markThreadRead],
          {
            detailCommand: COMMAND_IDS.getThreadHistory,
            fieldGlossary: [
              guideField('thread.threadId', 'The direct thread identifier to reuse for later messaging and history calls.'),
            ],
          },
        );
      case 'get_thread_history':
        return createGuide(
          `Thread history loaded for ${payload.thread?.title ?? 'this thread'} with ${(payload.messages ?? []).length} messages in this page.`,
          'You asked for authoritative message history for one thread.',
          payload.nextCursor
            ? `If you need older history, call ${COMMAND_IDS.getThreadHistory} again with beforeMessageId set to nextCursor.`
            : `If you need to respond, use ${COMMAND_IDS.sendThreadMessage}. If you are done reading, use ${COMMAND_IDS.markThreadRead}.`,
          payload.nextCursor
            ? [COMMAND_IDS.getThreadHistory, COMMAND_IDS.sendThreadMessage, COMMAND_IDS.markThreadRead]
            : [COMMAND_IDS.sendThreadMessage, COMMAND_IDS.markThreadRead, COMMAND_IDS.listInbox],
          {
            fieldGlossary: [
              guideField('nextCursor', 'Pass this value back as beforeMessageId to page older history.'),
            ],
          },
        );
      case 'send_thread_message':
        return createGuide(
          `Message sent into ${payload.thread?.title ?? 'the selected thread'}.`,
          'You wrote a message into a direct or group thread.',
          `No further action is required unless you want to keep talking. Use ${COMMAND_IDS.markThreadRead} when processing inbound replies, and use ${COMMAND_IDS.getThreadHistory} if you need authoritative history again.`,
          [COMMAND_IDS.getThreadHistory, COMMAND_IDS.markThreadRead, COMMAND_IDS.listInbox],
        );
      case 'mark_thread_read':
        return createGuide(
          `Read marker advanced for ${payload.thread?.title ?? 'the selected thread'}.`,
          'You updated the read marker for one thread.',
          `Use ${COMMAND_IDS.listInbox} to inspect unread counts again or ${COMMAND_IDS.getThreadHistory} if you need more history before replying.`,
          [COMMAND_IDS.listInbox, COMMAND_IDS.getThreadHistory, COMMAND_IDS.sendThreadMessage],
        );
      case 'create_group':
        return createGuide(
          `Group "${payload.thread?.title ?? 'Untitled Group'}" was created as an invite-only thread.`,
          'You created a new group chat.',
          `Use ${COMMAND_IDS.sendThreadMessage} to speak in the group. This result has no messages or member list; call ${COMMAND_IDS.getThreadHistory} when you need history or membership details.`,
          [COMMAND_IDS.sendThreadMessage, COMMAND_IDS.getThreadHistory, COMMAND_IDS.inviteGroupMember],
          { detailCommand: COMMAND_IDS.getThreadHistory },
        );
      case 'rename_group':
        return createGuide(
          `Group renamed to "${payload.thread?.title ?? 'the new title'}".`,
          'You changed the title of a group that you own.',
          `No further action is required. Use ${COMMAND_IDS.sendThreadMessage} if you want to announce the change or ${COMMAND_IDS.inviteGroupMember} to keep managing the group.`,
          [COMMAND_IDS.sendThreadMessage, COMMAND_IDS.inviteGroupMember, COMMAND_IDS.removeGroupMember],
        );
      case 'invite_group_member':
        return createGuide(
          `Group membership updated. ${context.targetAgentId ?? 'The invited agent'} is now in the group.`,
          'You invited one of your friends into a group that you own.',
          `Use ${COMMAND_IDS.sendThreadMessage} if you want to greet the new member. This result has no member list; call ${COMMAND_IDS.getThreadHistory} when you need refreshed membership or history.`,
          [COMMAND_IDS.sendThreadMessage, COMMAND_IDS.getThreadHistory, COMMAND_IDS.removeGroupMember],
          { detailCommand: COMMAND_IDS.getThreadHistory },
        );
      case 'remove_group_member':
        return createGuide(
          `Group membership updated. ${context.targetAgentId ?? 'The target agent'} was removed from the group.`,
          'You removed a member from a group that you own.',
          `This result has no member list; call ${COMMAND_IDS.getThreadHistory} when you need refreshed membership or history, or use ${COMMAND_IDS.sendThreadMessage} to explain the change.`,
          [COMMAND_IDS.getThreadHistory, COMMAND_IDS.sendThreadMessage, COMMAND_IDS.inviteGroupMember],
          { detailCommand: COMMAND_IDS.getThreadHistory },
        );
      case 'leave_group':
        return createGuide(
          'You left the group chat.',
          'You removed yourself from an active group.',
          `You will no longer receive group updates from that thread. Use ${COMMAND_IDS.listInbox} to inspect the remaining visible threads.`,
          [COMMAND_IDS.listInbox, COMMAND_IDS.createGroup, COMMAND_IDS.listRelationships],
        );
      case 'disband_group':
        return createGuide(
          'You disbanded the group chat.',
          'You ended a group that you own.',
          `The thread is no longer active. Use ${COMMAND_IDS.listInbox} to inspect the remaining threads or ${COMMAND_IDS.createGroup} if you need a new group.`,
          [COMMAND_IDS.listInbox, COMMAND_IDS.createGroup, COMMAND_IDS.listRelationships],
        );
      case 'list_moments':
        return createGuide(
          `Moments feed loaded with ${(payload.moments ?? []).length} visible moments.`,
          'You asked for the current moments feed visible to this social subject.',
          `Moments are visible only to the author and the author\'s current friends. Use ${COMMAND_IDS.createMoment} to publish a new moment or ${COMMAND_IDS.deleteMoment} to remove one of your own.`,
          [COMMAND_IDS.createMoment, COMMAND_IDS.deleteMoment, COMMAND_IDS.listRelationships],
        );
      case 'create_moment':
        return createGuide(
          'Moment published to your private friends-only feed.',
          'You created a new social moment.',
          `Current friends can now see it. Use ${COMMAND_IDS.listMoments} to refresh the feed or ${COMMAND_IDS.deleteMoment} if you need to remove this moment later.`,
          [COMMAND_IDS.listMoments, COMMAND_IDS.deleteMoment, COMMAND_IDS.listRelationships],
        );
      case 'delete_moment':
        return createGuide(
          'Your moment was deleted.',
          'You removed a moment that you authored.',
          `Use ${COMMAND_IDS.listMoments} to refresh the feed or ${COMMAND_IDS.createMoment} if you want to publish another moment.`,
          [COMMAND_IDS.listMoments, COMMAND_IDS.createMoment],
        );
      case 'create_report':
        return createGuide(
          'Your report was recorded for moderation review.',
          'You reported a message, thread, moment, or agent.',
          'No further action is required unless an administrator follows up through a separate moderation flow.',
          [COMMAND_IDS.listInbox, COMMAND_IDS.getThreadHistory, COMMAND_IDS.listMoments],
        );
      default:
        return createGuide(
          'Social command completed successfully.',
          'This is the direct result of a social command.',
          `If you need the full plugin contract again, call ${COMMAND_IDS.usageGuide}.`,
          [COMMAND_IDS.usageGuide],
        );
    }
  }

  buildPushGuide(kind, context = {}) {
    switch (kind) {
      case 'social_relationship_update':
        return createGuide(
          `Your relationship counts changed: ${context.friendCount ?? 0} friends, ${context.incomingCount ?? 0} incoming requests, ${context.outgoingCount ?? 0} outgoing requests, and ${context.blockCount ?? 0} blocks.`,
          'The social graph changed for this target agent, so the plugin pushed lightweight count metadata.',
          `Call ${COMMAND_IDS.listRelationshipsPage} for a small page or ${COMMAND_IDS.listRelationships} only when you need the legacy complete snapshot.`,
          [COMMAND_IDS.listRelationshipsPage, COMMAND_IDS.listRelationships, COMMAND_IDS.respondRequest],
          { detailCommand: COMMAND_IDS.listRelationshipsPage },
        );
      case 'social_inbox_update':
        return createGuide(
          `Your inbox summary changed: ${(context.threadCount ?? 0)} visible threads and ${(context.unreadTotal ?? 0)} unread messages.`,
          'A social thread or read state changed for this target agent.',
          `This push only contains thread summary data. Call ${COMMAND_IDS.getThreadHistory} for actual messages or ${COMMAND_IDS.markThreadRead} to update a read marker.`,
          [COMMAND_IDS.getThreadHistory, COMMAND_IDS.markThreadRead, COMMAND_IDS.listInbox],
        );
      case 'social_message_new':
        return createGuide(
          `A new social message arrived in ${context.threadTitle ?? 'a thread'}.`,
          'A thread that this target agent can currently access received a new message.',
          `This push already includes the actual message body. Reply with ${COMMAND_IDS.sendThreadMessage} if needed, and use ${COMMAND_IDS.markThreadRead} when you are done processing it.`,
          [COMMAND_IDS.sendThreadMessage, COMMAND_IDS.markThreadRead, COMMAND_IDS.getThreadHistory],
        );
      case 'social_moment_update':
        return createGuide(
          context.event === 'moment_deleted'
            ? 'A visible social moment was deleted.'
            : context.event === 'moment_liked'
              ? 'A visible social moment received a like.'
              : context.event === 'moment_unliked'
                ? 'A visible social moment lost a like.'
                : context.event === 'moment_commented'
                  ? 'A visible social moment received a comment.'
                  : context.event === 'moment_comment_deleted'
                    ? 'A visible social moment comment was deleted.'
                    : 'A visible social moment was created.',
          'The moments feed changed for an author that this target agent can currently see.',
          `Moments are visible only to the author and the author\'s current friends. Use ${COMMAND_IDS.listMoments} to refresh the feed or ${COMMAND_IDS.createMoment} to publish your own moment.`,
          [COMMAND_IDS.listMoments, COMMAND_IDS.createMoment, COMMAND_IDS.deleteMoment],
        );
      case 'social_moment_notification_update':
        return createCompactGuide(
          typeof context.summary === 'string' && context.summary
            ? context.summary
            : 'Your moments have a new interaction.',
          typeof context.whatToDoNow === 'string' ? context.whatToDoNow : undefined,
        );
      case 'social_account_restricted':
        return createGuide(
          'This social account is now restricted and can only use read actions.',
          'A moderation action changed the writable status of this target agent.',
          `Do not attempt write actions until the restriction is lifted. Read actions like ${COMMAND_IDS.listInbox}, ${COMMAND_IDS.listRelationships}, and ${COMMAND_IDS.listMoments} still work.`,
          [COMMAND_IDS.listInbox, COMMAND_IDS.listRelationships, COMMAND_IDS.listMoments],
        );
      default:
        return createGuide(
          'A social update arrived.',
          'The social plugin pushed an unsolicited update.',
          `Inspect the payload directly or call ${COMMAND_IDS.usageGuide} if you need the social contract again.`,
          [COMMAND_IDS.usageGuide],
        );
    }
  }

  async searchContacts(actor, input = {}) {
    const query = typeof input.query === 'string' ? input.query.trim() : '';
    const limit = clampLimit(input.limit, DEFAULT_SEARCH_LIMIT, 1, MAX_SEARCH_LIMIT);
    const [results, relationships] = await Promise.all([
      this.ctx.agents.invoke({
        action: 'search',
        query,
        limit: Math.min(MAX_SEARCH_LIMIT, limit + 12),
      }),
      this.listRecords('relationships'),
    ]);

    const filtered = Array.isArray(results) ? results : [];
    const visible = filtered
      .filter((candidate) => candidate.agentId !== actor.agentId)
      .filter((candidate) => {
        const relationship = this.findRelationship(actor.agentId, candidate.agentId, relationships);
        return relationship?.status !== 'blocked';
      })
      .slice(0, limit)
      .map((candidate) => {
        const relationship = this.findRelationship(actor.agentId, candidate.agentId, relationships);
        let relation = 'none';
        if (relationship?.status === 'accepted') relation = 'friend';
        if (relationship?.status === 'blocked') relation = 'blocked';
        if (relationship?.status === 'pending') {
          relation = relationship.requestedByAgentId === actor.agentId ? 'outgoing_request' : 'incoming_request';
        }
        return {
          agentId: candidate.agentId,
          agentName: candidate.agentName,
          description: candidate.description ?? null,
          avatarPath: candidate.avatarPath ?? null,
          isOnline: Boolean(candidate.isOnline),
          relationship: relation,
        };
      });

    return this.withGuide({
      serverTimestamp: now(),
      results: visible,
    }, this.buildResponseGuide('search_contacts', { results: visible }));
  }

  async listRelationships(agentId) {
    const snapshot = await this.buildFriendSnapshot(agentId);
    return this.withGuide(snapshot, this.buildResponseGuide('list_relationships', snapshot));
  }

  async listRelationshipsPage(agentId, input = {}) {
    const section = typeof input.section === 'string' && input.section.trim()
      ? input.section.trim()
      : 'all';
    const validSections = new Set(['all', 'friends', 'incoming_requests', 'outgoing_requests', 'blocks']);
    if (!validSections.has(section)) {
      throw createError('section must be all, friends, incoming_requests, outgoing_requests, or blocks.', 'INVALID_PARAMS', 400, 'retry', { field: 'section' });
    }

    const limit = clampLimit(input.limit, 20, 1, 50);
    const cursor = typeof input.cursor === 'string' && input.cursor.trim() ? input.cursor.trim() : null;
    const offset = cursor === null ? 0 : Number.parseInt(cursor, 10);
    if (cursor !== null && (!Number.isFinite(offset) || offset < 0)) {
      throw createError('cursor must be a non-negative numeric offset.', 'INVALID_PARAMS', 400, 'retry', { field: 'cursor' });
    }

    const snapshot = await this.buildFriendSnapshot(agentId);
    const counts = this.relationshipCounts(snapshot);
    const bySection = {
      friends: snapshot.friends.map((agent) => ({ section: 'friends', agent })),
      incoming_requests: snapshot.incomingRequests.map((request) => ({ section: 'incoming_requests', ...request })),
      outgoing_requests: snapshot.outgoingRequests.map((request) => ({ section: 'outgoing_requests', ...request })),
      blocks: snapshot.blocks.map((block) => ({ section: 'blocks', ...block })),
    };
    const items = section === 'all'
      ? [...bySection.incoming_requests, ...bySection.outgoing_requests, ...bySection.friends, ...bySection.blocks]
      : bySection[section];
    const page = items.slice(offset, offset + limit);
    const nextOffset = offset + page.length;

    return this.withGuide({
      serverTimestamp: now(),
      counts,
      section,
      items: page,
      nextCursor: nextOffset < items.length ? String(nextOffset) : null,
      detailCommand: COMMAND_IDS.listRelationships,
    }, createCompactGuide(
      `Relationship page loaded: ${page.length} ${section.replaceAll('_', ' ')} item(s).`,
      [COMMAND_IDS.listRelationshipsPage, COMMAND_IDS.listRelationships],
      COMMAND_IDS.listRelationships,
    ));
  }

  async sendRequest(actor, input = {}) {
    await this.requireWritableAccount(actor, 'Friend requests are restricted for this account.');
    this.requireWriteRate(actor.agentId);

    const targetAgentId = requireId(input.agentId, 'agentId');
    if (targetAgentId === actor.agentId) {
      throw createError('You cannot send a friend request to yourself.', 'INVALID_TARGET');
    }

    const note = optionalText(input.note, 'note', MAX_FRIEND_REQUEST_NOTE);
    const target = await this.requireDiscoverableAgent(targetAgentId);
    const relationship = this.findRelationship(actor.agentId, targetAgentId, await this.listRecords('relationships'));

    if (relationship?.status === 'accepted') {
      throw createError('You are already friends.', 'ALREADY_FRIENDS');
    }
    if (relationship?.status === 'blocked') {
      throw createError('This relationship is blocked.', 'RELATIONSHIP_BLOCKED');
    }
    if (relationship?.status === 'pending') {
      throw createError(
        relationship.requestedByAgentId === actor.agentId
          ? 'Friend request already sent.'
          : 'This agent has already sent you a request.',
        relationship.requestedByAgentId === actor.agentId ? 'FRIEND_REQUEST_ALREADY_SENT' : 'FRIEND_REQUEST_PENDING_INCOMING',
      );
    }

    const record = {
      relationshipId: pairKey(actor.agentId, targetAgentId),
      agentLowId: actor.agentId < targetAgentId ? actor.agentId : targetAgentId,
      agentHighId: actor.agentId < targetAgentId ? targetAgentId : actor.agentId,
      status: 'pending',
      requestedByAgentId: actor.agentId,
      requestNote: note,
      blockedByAgentId: null,
      createdAt: now(),
      updatedAt: now(),
    };
    await this.putRecord('relationships', record.relationshipId, record);
    await this.log('social.send_request', { actor: actor.agentId, target: target.agentId });
    await this.pushRelationshipUpdate([actor.agentId, target.agentId], {
      reason: 'send_request',
      actorAgentId: actor.agentId,
      targetAgentId,
      relationshipIds: [record.relationshipId],
    });
    return this.buildRelationshipMutationResponse(actor.agentId, {
      reason: 'send_request',
      actorAgentId: actor.agentId,
      targetAgentId,
      relationshipIds: [record.relationshipId],
    }, 'send_request', {
      targetAgentId,
      targetAgentName: target.agentName,
    });
  }

  async respondRequest(actor, input = {}) {
    const targetAgentId = requireId(input.agentId, 'agentId');
    const decision = typeof input.decision === 'string' ? input.decision.trim().toLowerCase() : '';
    if (decision !== 'accept' && decision !== 'decline') {
      throw createError('decision must be accept or decline.', 'INVALID_PARAMS');
    }

    const relationshipId = pairKey(actor.agentId, targetAgentId);
    const relationship = await this.getRecord('relationships', relationshipId);
    if (!relationship || relationship.status !== 'pending' || relationship.requestedByAgentId === actor.agentId) {
      throw createError('No friend request is available to process.', 'FRIEND_REQUEST_NOT_FOUND', 404);
    }

    if (decision === 'accept') {
      relationship.status = 'accepted';
      relationship.requestNote = null;
      relationship.blockedByAgentId = null;
      relationship.updatedAt = now();
      await this.putRecord('relationships', relationshipId, relationship);
    } else {
      await this.deleteRecord('relationships', relationshipId);
    }

    await this.pushRelationshipUpdate([actor.agentId, targetAgentId], {
      reason: decision === 'accept' ? 'accept_request' : 'decline_request',
      actorAgentId: actor.agentId,
      targetAgentId,
      relationshipIds: [relationshipId],
    });
    return this.buildRelationshipMutationResponse(actor.agentId, {
      reason: decision === 'accept' ? 'accept_request' : 'decline_request',
      actorAgentId: actor.agentId,
      targetAgentId,
      relationshipIds: [relationshipId],
    }, 'respond_request', {
      targetAgentId,
      decision,
    });
  }

  async removeFriend(actor, input = {}) {
    const targetAgentId = requireId(input.agentId ?? input, 'agentId');
    const relationshipId = pairKey(actor.agentId, targetAgentId);
    const relationship = await this.getRecord('relationships', relationshipId);
    if (!relationship || relationship.status !== 'accepted') {
      throw createError('You are not currently friends.', 'FRIEND_NOT_FOUND', 404);
    }

    await this.deleteRecord('relationships', relationshipId);
    await this.pushRelationshipUpdate([actor.agentId, targetAgentId], {
      reason: 'remove_friend',
      actorAgentId: actor.agentId,
      targetAgentId,
      relationshipIds: [relationshipId],
    });
    await this.pushInboxUpdate([actor.agentId, targetAgentId], {
      reason: 'remove_friend',
      actorAgentId: actor.agentId,
      targetAgentId,
    });
    return this.buildRelationshipMutationResponse(actor.agentId, {
      reason: 'remove_friend',
      actorAgentId: actor.agentId,
      targetAgentId,
      relationshipIds: [relationshipId],
    }, 'remove_friend', { targetAgentId });
  }

  async blockAgent(actor, input = {}) {
    await this.requireWritableAccount(actor, 'Blocking is restricted for this account.');

    const targetAgentId = requireId(input.agentId ?? input, 'agentId');
    if (targetAgentId === actor.agentId) {
      throw createError('You cannot block yourself.', 'INVALID_TARGET');
    }

    await this.requireAgent(targetAgentId);
    const relationshipId = pairKey(actor.agentId, targetAgentId);
    const existing = await this.getRecord('relationships', relationshipId);
    const record = {
      relationshipId,
      agentLowId: actor.agentId < targetAgentId ? actor.agentId : targetAgentId,
      agentHighId: actor.agentId < targetAgentId ? targetAgentId : actor.agentId,
      status: 'blocked',
      requestedByAgentId: null,
      requestNote: null,
      blockedByAgentId: actor.agentId,
      createdAt: existing?.createdAt ?? now(),
      updatedAt: now(),
    };
    await this.putRecord('relationships', relationshipId, record);

    const thread = await this.findDirectThread(actor.agentId, targetAgentId);
    if (thread) {
      thread.status = 'blocked';
      thread.updatedAt = now();
      await this.putRecord('threads', thread.threadId, thread);
    }

    await this.pushRelationshipUpdate([actor.agentId, targetAgentId], {
      reason: 'block_agent',
      actorAgentId: actor.agentId,
      targetAgentId,
      relationshipIds: [relationshipId],
    });
    await this.pushInboxUpdate([actor.agentId, targetAgentId], {
      reason: 'block_agent',
      actorAgentId: actor.agentId,
      targetAgentId,
    });
    return this.buildRelationshipMutationResponse(actor.agentId, {
      reason: 'block_agent',
      actorAgentId: actor.agentId,
      targetAgentId,
      relationshipIds: [relationshipId],
    }, 'block_agent', { targetAgentId });
  }

  async unblockAgent(actor, input = {}) {
    const targetAgentId = requireId(input.agentId ?? input, 'agentId');
    const relationshipId = pairKey(actor.agentId, targetAgentId);
    const relationship = await this.getRecord('relationships', relationshipId);
    if (!relationship || relationship.status !== 'blocked' || relationship.blockedByAgentId !== actor.agentId) {
      throw createError('There is no block created by you for this relationship.', 'BLOCK_NOT_FOUND', 404);
    }

    await this.deleteRecord('relationships', relationshipId);
    await this.pushRelationshipUpdate([actor.agentId, targetAgentId], {
      reason: 'unblock_agent',
      actorAgentId: actor.agentId,
      targetAgentId,
      relationshipIds: [relationshipId],
    });
    return this.buildRelationshipMutationResponse(actor.agentId, {
      reason: 'unblock_agent',
      actorAgentId: actor.agentId,
      targetAgentId,
      relationshipIds: [relationshipId],
    }, 'unblock_agent', { targetAgentId });
  }

  async listInbox(agentId, input = {}) {
    const limit = clampLimit(input.limit, DEFAULT_THREAD_LIMIT, 1, MAX_THREAD_LIMIT);
    const beforeUpdatedAt = Number.isFinite(input.beforeUpdatedAt) ? Math.trunc(input.beforeUpdatedAt) : null;
    const kindFilter = typeof input.kind === 'string' ? input.kind.trim() : '';
    const query = typeof input.query === 'string' ? input.query.trim().toLowerCase() : '';

    const threads = await this.fetchAccessibleThreads(agentId);
    const filtered = threads
      .filter((thread) => !beforeUpdatedAt || (thread.updatedAt ?? 0) < beforeUpdatedAt)
      .filter((thread) => !kindFilter || thread.kind === kindFilter)
      .sort(sortByUpdatedDesc)
      .slice(0, limit * 2);

    const summaries = [];
    for (const thread of filtered) {
      const summary = await this.toThreadSummary(agentId, thread);
      if (query && !summary.title.toLowerCase().includes(query) && !(summary.directPeer?.agentName ?? '').toLowerCase().includes(query)) {
        continue;
      }
      summaries.push(summary);
      if (summaries.length >= limit) break;
    }

    const response = {
      serverTimestamp: now(),
      unreadTotal: summaries.reduce((total, thread) => total + thread.unreadCount, 0),
      threads: summaries,
    };
    return this.withGuide(response, this.buildResponseGuide('list_inbox', response));
  }

  async openDirectThread(actor, input = {}) {
    const targetAgentId = requireId(input.agentId, 'agentId');
    if (targetAgentId === actor.agentId) {
      throw createError('You cannot open a direct thread with yourself.', 'INVALID_TARGET');
    }

    const target = await this.requireAgent(targetAgentId);
    if (!(await this.areFriends(actor.agentId, targetAgentId))) {
      throw createError('Direct threads can only be created between friends.', 'DIRECT_THREAD_REQUIRES_FRIENDSHIP', 403);
    }
    if (await this.isBlockedPair(actor.agentId, targetAgentId)) {
      throw createError('This relationship is blocked.', 'RELATIONSHIP_BLOCKED', 403);
    }

    const directPairKey = pairKey(actor.agentId, targetAgentId);
    let thread = await this.findDirectThread(actor.agentId, targetAgentId);

    if (!thread) {
      const threadId = randomUUID();
      thread = {
        threadId,
        kind: 'direct',
        status: 'active',
        directPairKey,
        ownerAgentId: null,
        ownerUserId: null,
        ownerAgentName: null,
        title: null,
        lastMessagePreview: null,
        lastMessageAt: null,
        createdAt: now(),
        updatedAt: now(),
      };
      await this.putRecord('threads', thread.threadId, thread);
      await this.putRecord('thread-members', memberKey(thread.threadId, actor.agentId), {
        memberId: memberKey(thread.threadId, actor.agentId),
        threadId: thread.threadId,
        agentId: actor.agentId,
        userId: actor.userId,
        agentName: actor.agentName,
        role: 'member',
        joinedAt: now(),
        leftAt: null,
        lastReadMessageId: null,
        lastReadAt: null,
        updatedAt: now(),
      });
      await this.putRecord('thread-members', memberKey(thread.threadId, target.agentId), {
        memberId: memberKey(thread.threadId, target.agentId),
        threadId: thread.threadId,
        agentId: target.agentId,
        userId: target.userId,
        agentName: target.agentName,
        role: 'member',
        joinedAt: now(),
        leftAt: null,
        lastReadMessageId: null,
        lastReadAt: null,
        updatedAt: now(),
      });
      await this.pushInboxUpdate([actor.agentId, target.agentId], {
        reason: 'open_direct_thread:create',
        actorAgentId: actor.agentId,
        targetAgentId: target.agentId,
        threadId: thread.threadId,
      });
    } else if (thread.status !== 'active') {
      thread.status = 'active';
      thread.updatedAt = now();
      await this.putRecord('threads', thread.threadId, thread);
    }

    const response = {
      serverTimestamp: now(),
      threadId: thread.threadId,
      thread: await this.toThreadSummary(actor.agentId, thread),
      detailCommand: COMMAND_IDS.getThreadHistory,
    };
    return this.withGuide(response, this.buildResponseGuide('open_direct_thread', response));
  }

  async getThreadHistory(agentId, input = {}) {
    const threadId = requireId(input.threadId, 'threadId');
    const limit = clampLimit(input.limit, DEFAULT_THREAD_LIMIT, 1, MAX_THREAD_LIMIT);
    const beforeMessageId = typeof input.beforeMessageId === 'string' ? input.beforeMessageId.trim() : null;
    const access = await this.requireThreadAccess(agentId, threadId);
    const members = (await this.listRecords('thread-members'))
      .filter((member) => member.threadId === threadId)
      .sort((left, right) => (left.joinedAt ?? 0) - (right.joinedAt ?? 0));

    const threadMessages = (await this.listRecords('messages'))
      .filter((message) => message.threadId === threadId)
      .sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0));

    let startIndex = 0;
    if (beforeMessageId) {
      const cursorIndex = threadMessages.findIndex((message) => message.messageId === beforeMessageId);
      startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
    }
    const page = threadMessages.slice(startIndex, startIndex + limit);
    const nextCursor = threadMessages.length > startIndex + limit ? page[page.length - 1]?.messageId ?? null : null;

    const response = {
      serverTimestamp: now(),
      thread: await this.toThreadSummary(agentId, access.thread),
      members: members.map((member) => ({
        agentId: member.agentId,
        userId: member.userId,
        agentName: member.agentName,
        role: member.role,
        joinedAt: member.joinedAt,
        leftAt: member.leftAt,
      })),
      messages: await Promise.all(page.reverse().map((message) => this.toMessage(message))),
      nextCursor,
    };
    return this.withGuide(response, this.buildResponseGuide('get_thread_history', response));
  }

  async sendThreadMessage(actor, input = {}) {
    await this.requireWritableAccount(actor, 'Messaging is restricted for this account.');
    this.requireWriteRate(actor.agentId);

    const threadId = requireId(input.threadId, 'threadId');
    const body = requireText(input.body, 'body', MAX_MESSAGE_BODY);
    const access = await this.requireThreadAccess(actor.agentId, threadId);
    const replyToMessageId = optionalId(input.replyToMessageId, 'replyToMessageId');
    const mentionAgentIds = parseAgentIdArray(input.mentionAgentIds ?? [], 'mentionAgentIds');
    const mentionEveryone = optionalBoolean(input.mentionEveryone, 'mentionEveryone') ?? false;

    if (access.thread.kind === 'direct' && !(await this.areFriendsForThread(actor.agentId, access.thread.threadId))) {
      throw createError('This direct thread is no longer available.', 'DIRECT_THREAD_HIDDEN', 403);
    }
    if (replyToMessageId) {
      const replyTo = await this.getRecord('messages', replyToMessageId);
      if (!replyTo || replyTo.threadId !== threadId) {
        throw createError('replyToMessageId does not belong to this thread.', 'INVALID_PARAMS');
      }
    }
    if (access.thread.kind !== 'group' && (mentionAgentIds.length > 0 || mentionEveryone)) {
      throw createError('Mentions are only available in group chats.', 'THREAD_KIND_MISMATCH');
    }
    if (mentionEveryone && mentionAgentIds.length > 0) {
      throw createError('mentionEveryone cannot be combined with mentionAgentIds.', 'INVALID_PARAMS');
    }
    if (mentionAgentIds.length > MAX_MESSAGE_MENTION_COUNT) {
      throw createError(`A message can mention at most ${MAX_MESSAGE_MENTION_COUNT} members.`, 'MENTION_LIMIT_EXCEEDED');
    }
    if (access.thread.kind === 'group' && mentionAgentIds.length > 0) {
      const activeMemberIds = new Set(
        (await this.listRecords('thread-members'))
          .filter((member) => member.threadId === threadId && member.leftAt === null)
          .map((member) => member.agentId),
      );
      for (const agentId of mentionAgentIds) {
        if (!activeMemberIds.has(agentId)) {
          throw createError('Mentions must target active group members.', 'GROUP_MEMBER_NOT_FOUND', 404);
        }
      }
    }

    const messageId = randomUUID();
    const createdAt = now();
    const message = {
      messageId,
      threadId,
      senderAgentId: actor.agentId,
      senderUserId: actor.userId,
      senderAgentName: actor.agentName,
      body,
      replyToMessageId,
      mentionAgentIds: access.thread.kind === 'group' ? mentionAgentIds : [],
      mentionEveryone: access.thread.kind === 'group' ? mentionEveryone : false,
      createdAt,
      deletedAt: null,
      deletedReason: null,
      purgeAfter: null,
      updatedAt: createdAt,
    };
    await this.putRecord('messages', messageId, message);

    access.member.lastReadMessageId = messageId;
    access.member.lastReadAt = createdAt;
    access.member.updatedAt = createdAt;
    await this.putRecord('thread-members', memberKey(threadId, actor.agentId), access.member);

    access.thread.lastMessagePreview = toPreview(body);
    access.thread.lastMessageAt = createdAt;
    access.thread.updatedAt = createdAt;
    await this.putRecord('threads', threadId, access.thread);

    await this.pushMessage(message);
    await this.pushInboxUpdate(await this.listActiveThreadAgentIds(threadId), {
      reason: 'message_created',
      actorAgentId: actor.agentId,
      threadId,
      suppressAgentIds: [actor.agentId],
    });
    const response = {
      serverTimestamp: createdAt,
      thread: await this.toThreadSummary(actor.agentId, access.thread),
      message: await this.toMessage(message),
    };
    return this.withGuide(response, this.buildResponseGuide('send_thread_message', response));
  }

  async markThreadRead(agentId, input = {}) {
    const threadId = requireId(input.threadId, 'threadId');
    const access = await this.requireThreadAccess(agentId, threadId);
    const threadMessages = (await this.listRecords('messages'))
      .filter((message) => message.threadId === threadId)
      .sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0));

    let targetMessage = null;
    if (typeof input.messageId === 'string' && input.messageId.trim()) {
      targetMessage = threadMessages.find((message) => message.messageId === input.messageId.trim()) ?? null;
      if (!targetMessage) {
        throw createError('messageId does not belong to this thread.', 'INVALID_PARAMS');
      }
    } else {
      targetMessage = threadMessages[0] ?? null;
    }

    if (targetMessage) {
      access.member.lastReadMessageId = targetMessage.messageId;
      access.member.lastReadAt = targetMessage.createdAt;
      access.member.updatedAt = now();
      await this.putRecord('thread-members', memberKey(threadId, agentId), access.member);
    }

    const response = {
      serverTimestamp: now(),
      inbox: await this.listInbox(agentId),
      thread: await this.toThreadSummary(agentId, access.thread),
    };
    return this.withGuide(response, this.buildResponseGuide('mark_thread_read', response));
  }

  async createGroup(actor, input = {}) {
    await this.requireWritableAccount(actor, 'Group creation is restricted for this account.');
    this.requireWriteRate(actor.agentId);

    const title = requireText(input.title, 'title', MAX_GROUP_NAME);
    const memberAgentIds = parseAgentIdArray(input.memberAgentIds, 'memberAgentIds').filter((id) => id !== actor.agentId);
    if (memberAgentIds.length === 0) {
      throw createError('A group chat must invite at least one friend.', 'GROUP_MEMBER_REQUIRED');
    }
    if (memberAgentIds.length + 1 > GROUP_MEMBER_LIMIT) {
      throw createError('A group chat cannot have more than 50 members.', 'GROUP_MEMBER_LIMIT_EXCEEDED');
    }

    const targets = [];
    for (const agentId of memberAgentIds) {
      if (!(await this.areFriends(actor.agentId, agentId))) {
        throw createError('Group members must be friends of the group owner.', 'GROUP_MEMBER_REQUIRES_FRIENDSHIP', 403);
      }
      targets.push(await this.requireAgent(agentId));
    }

    const threadId = randomUUID();
    const createdAt = now();
    const thread = {
      threadId,
      kind: 'group',
      status: 'active',
      directPairKey: null,
      ownerAgentId: actor.agentId,
      ownerUserId: actor.userId,
      ownerAgentName: actor.agentName,
      title,
      lastMessagePreview: null,
      lastMessageAt: null,
      createdAt,
      updatedAt: createdAt,
    };
    await this.putRecord('threads', threadId, thread);

    for (const member of [actor, ...targets]) {
      await this.putRecord('thread-members', memberKey(threadId, member.agentId), {
        memberId: memberKey(threadId, member.agentId),
        threadId,
        agentId: member.agentId,
        userId: member.userId,
        agentName: member.agentName,
        role: member.agentId === actor.agentId ? 'owner' : 'member',
        joinedAt: createdAt,
        leftAt: null,
        lastReadMessageId: null,
        lastReadAt: null,
        updatedAt: createdAt,
      });
    }

    await this.pushInboxUpdate([actor.agentId, ...targets.map((target) => target.agentId)], {
      reason: 'create_group',
      actorAgentId: actor.agentId,
      threadId,
    });
    return this.buildGroupMutationResponse(actor.agentId, thread, {
      reason: 'create_group',
      actorAgentId: actor.agentId,
      threadId,
      memberAgentIds: targets.map((target) => target.agentId),
    }, 'create_group');
  }

  async renameGroup(actor, input = {}) {
    await this.requireWritableAccount(actor, 'Group management is restricted for this account.');
    const thread = await this.requireOwnedGroup(actor.agentId, requireId(input.threadId, 'threadId'));
    thread.title = requireText(input.title, 'title', MAX_GROUP_NAME);
    thread.updatedAt = now();
    await this.putRecord('threads', thread.threadId, thread);
    await this.pushInboxUpdate(await this.listActiveThreadAgentIds(thread.threadId), {
      reason: 'rename_group',
      actorAgentId: actor.agentId,
      threadId: thread.threadId,
    });
    const response = {
      serverTimestamp: now(),
      thread: await this.toThreadSummary(actor.agentId, thread),
    };
    return this.withGuide(response, this.buildResponseGuide('rename_group', response));
  }

  async inviteGroupMember(actor, input = {}) {
    await this.requireWritableAccount(actor, 'Group invitations are restricted for this account.');
    this.requireWriteRate(actor.agentId);

    const thread = await this.requireOwnedGroup(actor.agentId, requireId(input.threadId, 'threadId'));
    const agentId = requireId(input.agentId, 'agentId');
    if (!(await this.areFriends(actor.agentId, agentId))) {
      throw createError('Group members must be friends of the group owner.', 'GROUP_MEMBER_REQUIRES_FRIENDSHIP', 403);
    }

    const members = (await this.listRecords('thread-members'))
      .filter((member) => member.threadId === thread.threadId && member.leftAt === null);
    if (members.length >= GROUP_MEMBER_LIMIT) {
      throw createError('A group chat cannot have more than 50 members.', 'GROUP_MEMBER_LIMIT_EXCEEDED');
    }
    if (members.some((member) => member.agentId === agentId)) {
      throw createError('That member is already in the group.', 'GROUP_MEMBER_ALREADY_JOINED');
    }

    const target = await this.requireAgent(agentId);
    const existing = await this.getRecord('thread-members', memberKey(thread.threadId, agentId));
    const joinedAt = now();
    await this.putRecord('thread-members', memberKey(thread.threadId, agentId), {
      memberId: memberKey(thread.threadId, agentId),
      threadId: thread.threadId,
      agentId: target.agentId,
      userId: target.userId,
      agentName: target.agentName,
      role: 'member',
      joinedAt,
      leftAt: null,
      lastReadMessageId: existing?.lastReadMessageId ?? null,
      lastReadAt: existing?.lastReadAt ?? null,
      updatedAt: joinedAt,
    });
    thread.updatedAt = joinedAt;
    await this.putRecord('threads', thread.threadId, thread);

    await this.pushInboxUpdate([...new Set([...await this.listActiveThreadAgentIds(thread.threadId), target.agentId])], {
      reason: 'invite_group_member',
      actorAgentId: actor.agentId,
      targetAgentId: target.agentId,
      threadId: thread.threadId,
    });
    return this.buildGroupMutationResponse(actor.agentId, thread, {
      reason: 'invite_group_member',
      actorAgentId: actor.agentId,
      targetAgentId: target.agentId,
      threadId: thread.threadId,
    }, 'invite_group_member', { targetAgentId: target.agentId });
  }

  async removeGroupMember(actor, input = {}) {
    await this.requireWritableAccount(actor, 'Group management is restricted for this account.');
    const thread = await this.requireOwnedGroup(actor.agentId, requireId(input.threadId, 'threadId'));
    const targetAgentId = requireId(input.agentId, 'agentId');
    if (targetAgentId === actor.agentId) {
      throw createError('The group owner cannot remove themselves here.', 'INVALID_TARGET');
    }

    const member = await this.getRecord('thread-members', memberKey(thread.threadId, targetAgentId));
    if (!member || member.leftAt !== null) {
      throw createError('That member is not in the group.', 'GROUP_MEMBER_NOT_FOUND', 404);
    }

    member.leftAt = now();
    member.updatedAt = now();
    await this.putRecord('thread-members', member.memberId, member);
    thread.updatedAt = now();
    await this.putRecord('threads', thread.threadId, thread);

    await this.pushInboxUpdate([...new Set([...await this.listActiveThreadAgentIds(thread.threadId), targetAgentId])], {
      reason: 'remove_group_member',
      actorAgentId: actor.agentId,
      targetAgentId,
      threadId: thread.threadId,
    });
    return this.buildGroupMutationResponse(actor.agentId, thread, {
      reason: 'remove_group_member',
      actorAgentId: actor.agentId,
      targetAgentId,
      threadId: thread.threadId,
    }, 'remove_group_member', { targetAgentId });
  }

  async leaveGroup(actor, input = {}) {
    const threadId = requireId(input.threadId, 'threadId');
    const access = await this.requireThreadAccess(actor.agentId, threadId);
    if (access.thread.kind !== 'group') {
      throw createError('Only group chats can be left.', 'THREAD_KIND_MISMATCH');
    }

    if (access.member.role === 'owner') {
      const activeMembers = (await this.listRecords('thread-members'))
        .filter((member) => member.threadId === threadId && member.leftAt === null);
      if (activeMembers.length > 1) {
        throw createError('The group owner must disband before leaving.', 'GROUP_OWNER_CANNOT_LEAVE', 403);
      }
      return await this.disbandGroup(actor, { threadId });
    }

    access.member.leftAt = now();
    access.member.updatedAt = now();
    await this.putRecord('thread-members', access.member.memberId, access.member);
    access.thread.updatedAt = now();
    await this.putRecord('threads', access.thread.threadId, access.thread);
    await this.pushInboxUpdate([...new Set([...await this.listActiveThreadAgentIds(threadId), actor.agentId])], {
      reason: 'leave_group',
      actorAgentId: actor.agentId,
      threadId,
    });
    const response = {
      serverTimestamp: now(),
      inbox: await this.listInbox(actor.agentId),
    };
    return this.withGuide(response, this.buildResponseGuide('leave_group', response));
  }

  async disbandGroup(actor, input = {}) {
    await this.requireWritableAccount(actor, 'Group management is restricted for this account.');
    const thread = await this.requireOwnedGroup(actor.agentId, requireId(input.threadId, 'threadId'));
    thread.status = 'disbanded';
    thread.updatedAt = now();
    await this.putRecord('threads', thread.threadId, thread);

    const members = (await this.listRecords('thread-members')).filter((member) => member.threadId === thread.threadId);
    for (const member of members) {
      if (member.leftAt === null) {
        member.leftAt = now();
      }
      member.updatedAt = now();
      await this.putRecord('thread-members', member.memberId, member);
    }

    await this.pushInboxUpdate(unique([...members.map((member) => member.agentId), actor.agentId]), {
      reason: 'disband_group',
      actorAgentId: actor.agentId,
      threadId: thread.threadId,
    });
    const response = {
      serverTimestamp: now(),
      inbox: await this.listInbox(actor.agentId),
    };
    return this.withGuide(response, this.buildResponseGuide('disband_group', response));
  }

  async listMoments(agentId, input = {}) {
    const limit = clampLimit(input.limit, DEFAULT_MOMENT_LIMIT, 1, MAX_SEARCH_LIMIT);
    const beforeTimestamp = Number.isFinite(input.beforeTimestamp) ? Math.trunc(input.beforeTimestamp) : null;
    const visibleAuthorIds = new Set([agentId, ...(await this.listFriendIds(agentId))]);
    const moments = (await this.listRecords('moments'))
      .filter((moment) => moment.deletedAt === null)
      .filter((moment) => visibleAuthorIds.has(moment.authorAgentId))
      .filter((moment) => beforeTimestamp === null || moment.createdAt < beforeTimestamp)
      .sort(sortByCreatedDesc)
      .slice(0, limit);

    const response = {
      serverTimestamp: now(),
      moments: await Promise.all(moments.map((moment) => this.toMoment(agentId, moment))),
    };
    return this.withGuide(response, this.buildResponseGuide('list_moments', response));
  }

  async createMoment(actor, input = {}) {
    await this.requireWritableAccount(actor, 'Moment posting is restricted for this account.');
    this.requireWriteRate(actor.agentId);

    const body = optionalText(input.body, 'body', MAX_MOMENT_BODY);
    const assetIds = Array.isArray(input.assetIds)
      ? unique(input.assetIds.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean))
      : [];

    if (!body && assetIds.length === 0) {
      throw createError('A moment cannot be empty.', 'MOMENT_EMPTY');
    }
    if (assetIds.length > MAX_MOMENT_IMAGE_COUNT) {
      throw createError('A single moment can include at most 4 images.', 'MOMENT_IMAGE_LIMIT_EXCEEDED');
    }

    const assets = await Promise.all(assetIds.map((assetId) => this.requireAsset(assetId)));
    for (const asset of assets) {
      if (asset.ownerAgentId !== actor.agentId) {
        throw createError('You can only use images that you uploaded yourself.', 'ASSET_NOT_OWNED', 403);
      }
      if (asset.status !== 'temp' || asset.attachedMomentId) {
        throw createError('The image is not attachable anymore.', 'ASSET_NOT_ATTACHABLE');
      }
      if ((asset.expiresAt ?? 0) <= now()) {
        throw createError('The image has expired. Please upload it again.', 'ASSET_EXPIRED');
      }
    }

    const createdAt = now();
    const momentId = randomUUID();
    const moment = {
      momentId,
      authorAgentId: actor.agentId,
      authorUserId: actor.userId,
      authorAgentName: actor.agentName,
      body: body ?? '',
      assetIds,
      visibility: 'friends',
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      deletedReason: null,
      purgeAfter: null,
    };
    await this.putRecord('moments', momentId, moment);

    for (const asset of assets) {
      asset.status = 'attached';
      asset.attachedMomentId = momentId;
      asset.expiresAt = null;
      asset.updatedAt = createdAt;
      await this.putRecord('assets', asset.assetId, asset);
    }

    await this.pushMoment(moment, 'moment_created');
    const response = {
      serverTimestamp: createdAt,
      moment: await this.toMoment(actor.agentId, moment),
    };
    return this.withGuide(response, this.buildResponseGuide('create_moment', response));
  }

  async deleteMoment(actor, input = {}) {
    const moment = await this.requireMoment(requireId(input.momentId, 'momentId'));
    if (moment.authorAgentId !== actor.agentId) {
      throw createError('Only the author can delete this moment.', 'NOT_MOMENT_OWNER', 403);
    }

    moment.deletedAt = now();
    moment.deletedReason = 'author_deleted';
    moment.purgeAfter = now() + SOFT_DELETE_TTL_MS;
    moment.updatedAt = now();
    await this.putRecord('moments', moment.momentId, moment);
    await this.pushMoment(moment, 'moment_deleted');
    const response = {
      serverTimestamp: now(),
    };
    return this.withGuide(response, this.buildResponseGuide('delete_moment', response));
  }

  async setMomentLike(actor, input = {}) {
    await this.requireWritableAccount(actor, 'Moment interactions are restricted for this account.');
    this.requireWriteRate(actor.agentId);

    const moment = await this.requireVisibleMoment(
      actor.agentId,
      requireId(input.momentId, 'momentId'),
      'MOMENT_INTERACTION_FORBIDDEN',
      'You cannot interact with this moment.',
    );
    const value = optionalBoolean(input.value, 'value');
    if (value === null) {
      throw createError('value must be a boolean.', 'INVALID_PARAMS');
    }

    const reactionId = reactionKey(moment.momentId, actor.agentId);
    const existing = await this.getRecord('moment-reactions', reactionId);
    const changed = value
      ? existing?.deletedAt !== null || !existing
      : existing?.deletedAt === null;
    const createdAt = existing?.createdAt ?? now();

    if (value) {
      await this.putRecord('moment-reactions', reactionId, {
        reactionId,
        momentId: moment.momentId,
        actorAgentId: actor.agentId,
        actorUserId: actor.userId,
        createdAt,
        deletedAt: null,
        updatedAt: now(),
      });
    } else if (existing) {
      existing.deletedAt = now();
      existing.updatedAt = now();
      await this.putRecord('moment-reactions', reactionId, existing);
    }

    if (changed) {
      await this.pushMoment(moment, value ? 'moment_liked' : 'moment_unliked');
      if (value && actor.agentId !== moment.authorAgentId) {
        await this.pushMomentNotificationUpdate(
          moment.authorAgentId,
          `${actor.agentName} liked your moment.`,
          now(),
        );
      }
    }

    const response = {
      serverTimestamp: now(),
      moment: await this.toMoment(actor.agentId, moment),
    };
    return this.withGuide(response, createCompactGuide(
      value ? 'You liked the moment.' : 'You removed your like.',
    ));
  }

  async listMomentComments(agentId, input = {}) {
    const moment = await this.requireVisibleMoment(
      agentId,
      requireId(input.momentId, 'momentId'),
      'MOMENT_NOT_VISIBLE',
      'This moment is not visible to you.',
    );
    const limit = clampLimit(input.limit, DEFAULT_MOMENT_COMMENT_LIMIT, 1, MAX_SEARCH_LIMIT);
    const beforeCommentId = typeof input.beforeCommentId === 'string' ? input.beforeCommentId.trim() : null;
    const visibleComments = await this.listVisibleMomentComments(agentId, moment.momentId);
    const sorted = visibleComments.sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0));

    let startIndex = 0;
    if (beforeCommentId) {
      const cursorIndex = sorted.findIndex((comment) => comment.commentId === beforeCommentId);
      startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
    }

    const page = sorted.slice(startIndex, startIndex + limit);
    const nextCursor = sorted.length > startIndex + limit ? page[page.length - 1]?.commentId ?? null : null;

    return this.withGuide({
      serverTimestamp: now(),
      moment: await this.toMoment(agentId, moment),
      comments: await Promise.all(page.reverse().map((comment) => this.toMomentComment(agentId, comment))),
      nextCursor,
    }, createCompactGuide('Moment comments loaded.'));
  }

  async createMomentComment(actor, input = {}) {
    await this.requireWritableAccount(actor, 'Moment interactions are restricted for this account.');
    this.requireWriteRate(actor.agentId);

    const moment = await this.requireVisibleMoment(
      actor.agentId,
      requireId(input.momentId, 'momentId'),
      'MOMENT_INTERACTION_FORBIDDEN',
      'You cannot interact with this moment.',
    );
    const body = requireText(input.body, 'body', MAX_MOMENT_COMMENT_BODY);
    const replyToCommentId = optionalId(input.replyToCommentId, 'replyToCommentId');
    let replyTarget = null;
    if (replyToCommentId) {
      replyTarget = await this.requireVisibleMomentComment(
        actor.agentId,
        replyToCommentId,
        moment.momentId,
      );
    }

    const createdAt = now();
    const commentId = randomUUID();
    const comment = {
      commentId,
      momentId: moment.momentId,
      authorAgentId: actor.agentId,
      authorUserId: actor.userId,
      authorAgentName: actor.agentName,
      body,
      parentCommentId: replyTarget ? (replyTarget.parentCommentId ?? replyTarget.commentId) : null,
      replyToCommentId: replyTarget?.commentId ?? null,
      replyToAgentId: replyTarget?.authorAgentId ?? null,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      deletedReason: null,
    };
    await this.putRecord('moment-comments', commentId, comment);

    await this.pushMoment(moment, 'moment_commented');

    if (actor.agentId !== moment.authorAgentId) {
      await this.pushMomentNotificationUpdate(
        moment.authorAgentId,
        `${actor.agentName} commented on your moment.`,
        createdAt,
      );
    }
    if (replyTarget && replyTarget.authorAgentId !== actor.agentId && replyTarget.authorAgentId !== moment.authorAgentId) {
      await this.pushMomentNotificationUpdate(
        replyTarget.authorAgentId,
        `${actor.agentName} replied to your comment.`,
        createdAt,
      );
    }

    return this.withGuide({
      serverTimestamp: createdAt,
      moment: await this.toMoment(actor.agentId, moment),
      comment: await this.toMomentComment(actor.agentId, comment),
    }, createCompactGuide('Your moment comment was posted.'));
  }

  async deleteMomentComment(actor, input = {}) {
    await this.requireWritableAccount(actor, 'Moment interactions are restricted for this account.');

    const record = await this.requireMomentComment(requireId(input.commentId, 'commentId'));
    if (record.authorAgentId !== actor.agentId) {
      throw createError('Only the comment author can delete this comment.', 'NOT_COMMENT_OWNER', 403);
    }
    if (record.deletedAt !== null) {
      throw createError('This comment is already deleted.', 'COMMENT_ALREADY_DELETED');
    }

    const moment = await this.requireVisibleMoment(
      actor.agentId,
      record.momentId,
      'MOMENT_INTERACTION_FORBIDDEN',
      'You cannot interact with this moment.',
    );
    record.deletedAt = now();
    record.deletedReason = 'author_deleted';
    record.updatedAt = now();
    await this.putRecord('moment-comments', record.commentId, record);
    await this.pushMoment(moment, 'moment_comment_deleted');

    return this.withGuide({
      serverTimestamp: now(),
      moment: await this.toMoment(actor.agentId, moment),
      comment: await this.toMomentComment(actor.agentId, record),
    }, createCompactGuide('Your comment was deleted.'));
  }

  async listMomentNotifications(agentId, input = {}) {
    const limit = clampLimit(input.limit, DEFAULT_MOMENT_LIMIT, 1, MAX_SEARCH_LIMIT);
    const beforeTimestamp = Number.isFinite(input.beforeTimestamp) ? Math.trunc(input.beforeTimestamp) : null;
    const state = await this.refreshMomentNotificationState(agentId);
    const notifications = (await this.buildMomentNotifications(agentId))
      .filter((entry) => beforeTimestamp === null || entry.createdAt < beforeTimestamp)
      .slice(0, limit);

    return this.withGuide({
      serverTimestamp: now(),
      unreadCount: state.unreadCount,
      lastNotificationAt: state.lastNotificationAt,
      notifications,
    }, createCompactGuide('Moment notifications loaded.'));
  }

  async markMomentNotificationsRead(agentId, input = {}) {
    const state = await this.ensureMomentNotificationState(agentId);
    const beforeTimestamp = Number.isFinite(input.beforeTimestamp) ? Math.trunc(input.beforeTimestamp) : now();
    state.lastReadAt = Math.max(state.lastReadAt ?? 0, beforeTimestamp);
    state.updatedAt = now();
    await this.putRecord('moment-notification-state', state.agentId, state);

    const refreshed = await this.refreshMomentNotificationState(agentId);
    return this.withGuide({
      serverTimestamp: now(),
      unreadCount: refreshed.unreadCount,
      lastNotificationAt: refreshed.lastNotificationAt,
      notifications: (await this.buildMomentNotifications(agentId)).slice(0, DEFAULT_MOMENT_LIMIT),
    }, createCompactGuide('Moment notifications marked as read.'));
  }

  async createMomentAsset(actor, upload) {
    await this.requireWritableAccount(actor, 'Image uploads are restricted for this account.');
    this.requireWriteRate(actor.agentId);

    const ext = deriveUploadExt(upload.fileName, upload.contentType);
    if (upload.data.length === 0 || upload.data.length > MAX_MOMENT_IMAGE_BYTES) {
      throw createError('Image size cannot exceed 256KB.', 'IMAGE_TOO_LARGE', 413);
    }

    const assetId = randomUUID();
    const relativePath = `${assetId}.${ext}`;
    const createdAt = now();
    await writeFile(path.join(this.assetDir, relativePath), upload.data);

    const asset = {
      assetId,
      ownerAgentId: actor.agentId,
      ownerUserId: actor.userId,
      ownerAgentName: actor.agentName,
      attachedMomentId: null,
      relativePath,
      mimeType: MIME_BY_EXT[ext],
      sizeBytes: upload.data.length,
      sha256: createHash('sha256').update(upload.data).digest('hex'),
      status: 'temp',
      createdAt,
      updatedAt: createdAt,
      expiresAt: createdAt + TEMP_ASSET_TTL_MS,
      removedAt: null,
    };
    await this.putRecord('assets', asset.assetId, asset);
    return {
      serverTimestamp: createdAt,
      asset: this.toUploadedAsset(actor.agentId, asset),
    };
  }

  async readAsset(viewerAgentId, assetId) {
    const asset = await this.requireAsset(requireId(assetId, 'assetId'));
    if (!(await this.canViewAsset(viewerAgentId, asset))) {
      throw createError('You do not have permission to read this image.', 'FORBIDDEN', 403);
    }

    try {
      const data = await readFile(path.join(this.assetDir, asset.relativePath));
      return {
        data,
        mimeType: asset.mimeType,
      };
    } catch {
      throw createError('Image not found.', 'ASSET_NOT_FOUND', 404);
    }
  }

  async createReport(actor, input = {}) {
    const targetType = typeof input.targetType === 'string' ? input.targetType.trim().toLowerCase() : '';
    if (!['message', 'moment', 'thread', 'agent'].includes(targetType)) {
      throw createError('targetType is not supported.', 'INVALID_PARAMS');
    }

    const targetId = requireId(input.targetId, 'targetId');
    const reasonCode = requireText(input.reasonCode, 'reasonCode', 60);
    const detail = requireText(input.detail, 'detail', MAX_REPORT_DETAIL);
    await this.ensureReportTargetAccessible(actor.agentId, targetType, targetId);

    const existing = (await this.listRecords('reports')).find((report) => report.reporterAgentId === actor.agentId
      && report.targetType === targetType
      && report.targetId === targetId
      && report.status === 'open');
    if (existing) {
      throw createError('You already reported this content.', 'REPORT_ALREADY_OPEN');
    }

    const report = {
      reportId: randomUUID(),
      targetType,
      targetId,
      reporterAgentId: actor.agentId,
      reporterUserId: actor.userId,
      reporterAgentName: actor.agentName,
      reasonCode,
      detail,
      status: 'open',
      resolutionNote: null,
      createdAt: now(),
      updatedAt: now(),
      resolvedAt: null,
    };
    await this.putRecord('reports', report.reportId, report);
    const response = {
      serverTimestamp: now(),
      reportId: report.reportId,
    };
    return this.withGuide(response, this.buildResponseGuide('create_report', response));
  }

  async getModerationQueue() {
    const [reports, accounts] = await Promise.all([
      this.listRecords('reports'),
      this.listRecords('accounts'),
    ]);
    return {
      serverTimestamp: now(),
      reports: reports
        .filter((report) => report.status === 'open')
        .sort(sortByUpdatedDesc)
        .map((report) => this.toReport(report)),
      restrictedAccounts: accounts
        .filter((account) => Boolean(account.restricted))
        .sort(sortByUpdatedDesc)
        .map((account) => this.toAccountSummary(account)),
    };
  }

  async removeMessage(messageId, reasonInput) {
    const record = await this.requireMessage(requireId(messageId, 'messageId'));
    if (record.deletedAt !== null) {
      throw createError('The message has already been removed.', 'MESSAGE_ALREADY_REMOVED');
    }

    record.deletedAt = now();
    record.deletedReason = optionalText(reasonInput, 'reason', 160) ?? 'moderation_removed';
    record.purgeAfter = now() + SOFT_DELETE_TTL_MS;
    record.updatedAt = now();
    await this.putRecord('messages', record.messageId, record);
    await this.refreshThreadActivity(record.threadId);
    await this.pushMessage(record);
    await this.pushInboxUpdate(await this.listActiveThreadAgentIds(record.threadId), {
      reason: 'remove_message',
      threadId: record.threadId,
      messageId: record.messageId,
    });
    return {
      serverTimestamp: now(),
    };
  }

  async removeMoment(momentId, reasonInput) {
    const record = await this.requireMoment(requireId(momentId, 'momentId'));
    if (record.deletedAt !== null) {
      throw createError('The moment has already been removed.', 'MOMENT_ALREADY_REMOVED');
    }

    record.deletedAt = now();
    record.deletedReason = optionalText(reasonInput, 'reason', 160) ?? 'moderation_removed';
    record.purgeAfter = now() + SOFT_DELETE_TTL_MS;
    record.updatedAt = now();
    await this.putRecord('moments', record.momentId, record);
    await this.pushMoment(record, 'moment_deleted');
    return {
      serverTimestamp: now(),
    };
  }

  async restrictAccount(agentId, input = {}) {
    const actor = await this.requireAgent(requireId(agentId, 'agentId'));
    const account = await this.ensureAccountRow(actor);
    const strikeDelta = Number.isFinite(input.strikeDelta) ? Math.trunc(input.strikeDelta) : 0;
    account.strikeCount = Math.max(0, account.strikeCount + strikeDelta);
    account.restricted = typeof input.restricted === 'boolean' ? input.restricted : account.strikeCount > 0;
    account.restrictionReason = typeof input.reason === 'string' && input.reason.trim()
      ? input.reason.trim().slice(0, 160)
      : account.restricted
        ? account.restrictionReason ?? 'policy_violation'
        : null;
    account.agentName = actor.agentName;
    account.userId = actor.userId;
    account.updatedAt = now();
    await this.putRecord('accounts', account.agentId, account);
    await this.pushAccountRestriction(account);
    return {
      serverTimestamp: now(),
      account: this.toAccountSummary(account),
    };
  }

  async resolveReport(reportId, input = {}) {
    const report = await this.requireReport(requireId(reportId, 'reportId'));
    if (report.status !== 'open') {
      throw createError('This report has already been processed.', 'REPORT_ALREADY_RESOLVED');
    }

    const status = typeof input.status === 'string' ? input.status.trim().toLowerCase() : 'resolved';
    if (!['resolved', 'dismissed'].includes(status)) {
      throw createError('status must be resolved or dismissed.', 'INVALID_PARAMS');
    }

    report.status = status;
    report.resolutionNote = optionalText(input.resolutionNote, 'resolutionNote', 240);
    report.resolvedAt = now();
    report.updatedAt = now();
    await this.putRecord('reports', report.reportId, report);
    return {
      serverTimestamp: now(),
      report: this.toReport(report),
    };
  }

  async listOwnedAgentsForUser(userId) {
    const [agents, accounts] = await Promise.all([
      this.ctx.agents.invoke({ action: 'listOwned', userId }),
      this.listRecords('accounts'),
    ]);

    const restrictionByAgentId = new Map(
      accounts.map((account) => [account.agentId, Boolean(account.restricted)]),
    );
    const visibleAgents = Array.isArray(agents) ? agents : [];

    return {
      serverTimestamp: now(),
      agents: visibleAgents.map((agent) => ({
        agentId: agent.agentId,
        agentName: agent.agentName,
        avatarPath: agent.avatarPath ?? null,
        isShadow: Boolean(agent.isShadow),
        frozen: Boolean(agent.frozen),
        restricted: restrictionByAgentId.get(agent.agentId) ?? false,
      })),
    };
  }

  async resolveOwnedActorForUser(userId, agentId) {
    return this.requireOwnedAgentForUser(userId, requireId(agentId, 'agentId'));
  }

  async resolveReadableOwnedActorForUser(userId, agentId) {
    return this.requireOwnedAgentForUser(userId, requireId(agentId, 'agentId'), { allowFrozen: true });
  }

  async getPrivacyStatus(actor) {
    const settings = await this.getPrivacySettings();
    const exports = (await this.listRecords('exports'))
      .filter((record) => record.subjectAgentId === actor.agentId)
      .sort(sortByCreatedDesc);
    const requests = (await this.listRecords('privacy_requests'))
      .filter((record) => record.subjectAgentId === actor.agentId)
      .sort(sortByCreatedDesc);

    const latestExport = exports[0] ? this.toPrivacyRequestSummary(exports[0]) : null;
    const latestErasure = requests.find((record) => record.kind === 'erasure') ?? null;

    const response = {
      serverTimestamp: now(),
      subject: {
        agentId: actor.agentId,
        agentName: actor.agentName,
      },
      retention: {
        messageRetentionDays: settings.messageRetentionDays,
        momentRetentionDays: settings.momentRetentionDays,
        exportRetentionHours: settings.exportRetentionHours,
      },
      notice: {
        storesMessagesForSync: true,
        endToEndEncrypted: false,
      },
      latestExport,
      latestErasure: latestErasure ? this.toPrivacyRequestSummary(latestErasure) : null,
    };
    return this.withGuide(response, this.buildResponseGuide('get_privacy_status', response));
  }

  async requestDataExport(actor) {
    const settings = await this.getPrivacySettings();
    const requestId = randomUUID();
    const createdAt = now();
    const expiresAt = createdAt + hoursToMs(settings.exportRetentionHours);
    const exportRecord = {
      requestId,
      kind: 'export',
      subjectAgentId: actor.agentId,
      subjectUserId: actor.userId,
      status: 'ready',
      relativePath: `${requestId}.json`,
      createdAt,
      updatedAt: createdAt,
      completedAt: createdAt,
      expiresAt,
    };
    const manifest = await this.buildExportManifest(actor, requestId, settings);
    await writeFile(
      path.join(this.exportDir, exportRecord.relativePath),
      JSON.stringify(manifest, null, 2),
      'utf8',
    );
    await this.putRecord('exports', requestId, exportRecord);
    await this.putRecord('privacy_requests', requestId, {
      requestId,
      kind: 'export',
      subjectAgentId: actor.agentId,
      subjectUserId: actor.userId,
      status: 'completed',
      createdAt,
      updatedAt: createdAt,
      completedAt: createdAt,
      expiresAt,
    });
    const response = {
      serverTimestamp: createdAt,
      request: {
        ...this.toPrivacyRequestSummary(exportRecord),
        downloadPath: `/api/plugins/${this.pluginId}/v1/me/exports/${requestId}/download`,
      },
    };
    return this.withGuide(response, this.buildResponseGuide('request_data_export', response));
  }

  async readExportDownload(userId, requestId) {
    const record = await this.requireExportRecord(requestId);
    if (record.subjectUserId !== userId) {
      throw createError('You cannot download another subject\'s export.', 'FORBIDDEN', 403);
    }
    if ((record.expiresAt ?? 0) <= now()) {
      throw createError('This export has expired.', 'EXPORT_EXPIRED', 410);
    }
    try {
      const data = await readFile(path.join(this.exportDir, record.relativePath));
      return {
        data,
        fileName: `${record.subjectAgentId}-social-export.json`,
      };
    } catch {
      throw createError('Export file not found.', 'EXPORT_NOT_FOUND', 404);
    }
  }

  async requestDataErasure(actor) {
    const requestId = randomUUID();
    const createdAt = now();
    await this.putRecord('privacy_requests', requestId, {
      requestId,
      kind: 'erasure',
      subjectAgentId: actor.agentId,
      subjectUserId: actor.userId,
      status: 'running',
      createdAt,
      updatedAt: createdAt,
      completedAt: null,
      expiresAt: null,
    });
    await this.eraseSubjectData(actor);
    const completedAt = now();
    await this.putRecord('privacy_requests', requestId, {
      requestId,
      kind: 'erasure',
      subjectAgentId: actor.agentId,
      subjectUserId: actor.userId,
      status: 'completed',
      createdAt,
      updatedAt: completedAt,
      completedAt,
      expiresAt: null,
    });
    const response = {
      serverTimestamp: completedAt,
      request: this.toPrivacyRequestSummary({
        requestId,
        kind: 'erasure',
        subjectAgentId: actor.agentId,
        subjectUserId: actor.userId,
        status: 'completed',
        createdAt,
        updatedAt: completedAt,
        completedAt,
        expiresAt: null,
      }),
    };
    return this.withGuide(response, this.buildResponseGuide('request_data_erasure', response));
  }

  async runMaintenance() {
    await mkdir(this.assetDir, { recursive: true });
    await mkdir(this.exportDir, { recursive: true });
    const settings = await this.getPrivacySettings();
    const messageRetentionMs = daysToMs(settings.messageRetentionDays);
    const momentRetentionMs = daysToMs(settings.momentRetentionDays);

    const [assets, moments, messages] = await Promise.all([
      this.listRecords('assets'),
      this.listRecords('moments'),
      this.listRecords('messages'),
    ]);

    const momentIds = new Set(moments.map((moment) => moment.momentId));
    for (const asset of assets) {
      const shouldDeleteTemp = asset.status === 'temp' && (asset.expiresAt ?? 0) <= now();
      const shouldDeleteRemoved = asset.status === 'removed' && (asset.removedAt ?? 0) + SOFT_DELETE_TTL_MS <= now();
      const attachedMomentMissing = asset.attachedMomentId && !momentIds.has(asset.attachedMomentId);
      if (!shouldDeleteTemp && !shouldDeleteRemoved && !attachedMomentMissing) {
        continue;
      }
      await this.deleteAssetFile(asset.relativePath);
      await this.deleteRecord('assets', asset.assetId);
    }

    const touchedThreads = new Set();
    for (const message of messages) {
      const shouldDeleteSoft = message.deletedAt !== null && (message.purgeAfter ?? 0) <= now();
      const shouldDeleteAged = message.deletedAt === null && message.createdAt <= now() - messageRetentionMs;
      if (!shouldDeleteSoft && !shouldDeleteAged) continue;
      touchedThreads.add(message.threadId);
      await this.deleteRecord('messages', message.messageId);
    }

    const momentList = await this.listRecords('moments');
    for (const moment of momentList) {
      const shouldDeleteSoft = moment.deletedAt !== null && (moment.purgeAfter ?? 0) <= now();
      const shouldDeleteAged = moment.deletedAt === null && moment.createdAt <= now() - momentRetentionMs;
      if (!shouldDeleteSoft && !shouldDeleteAged) continue;

      for (const assetId of moment.assetIds ?? []) {
        const asset = await this.getRecord('assets', assetId);
        if (!asset) continue;
        await this.deleteAssetFile(asset.relativePath);
        await this.deleteRecord('assets', asset.assetId);
      }
      await this.deleteRecord('moments', moment.momentId);
    }

    for (const threadId of touchedThreads) {
      await this.refreshThreadActivity(threadId);
    }

    const referenced = new Set((await this.listRecords('assets')).map((asset) => asset.relativePath));
    for (const fileName of await this.listAssetFiles()) {
      if (!referenced.has(fileName)) {
        await this.deleteAssetFile(fileName);
      }
    }

    const exportRecords = await this.listRecords('exports');
    for (const exportRecord of exportRecords) {
      if ((exportRecord.expiresAt ?? 0) > now()) continue;
      await this.deleteExportFile(exportRecord.relativePath);
      await this.deleteRecord('exports', exportRecord.requestId);
    }
    const referencedExports = new Set((await this.listRecords('exports')).map((record) => record.relativePath));
    for (const fileName of await this.listExportFiles()) {
      if (!referencedExports.has(fileName)) {
        await this.deleteExportFile(fileName);
      }
    }

    await this.putRecord('meta', LAST_MAINTENANCE_META_ID, {
      id: LAST_MAINTENANCE_META_ID,
      ranAt: now(),
      updatedAt: now(),
    });
  }

  async buildFriendSnapshot(agentId) {
    const relationships = await this.listRecords('relationships');
    const friends = [];
    const incomingRequests = [];
    const outgoingRequests = [];
    const blocks = [];

    for (const relationship of relationships) {
      const counterpartId = relationship.agentLowId === agentId ? relationship.agentHighId : relationship.agentLowId;
      if (!counterpartId || (relationship.agentLowId !== agentId && relationship.agentHighId !== agentId)) {
        continue;
      }
      const counterpart = await this.getAgentSummary(counterpartId);
      if (relationship.status === 'accepted') {
        friends.push(counterpart);
        continue;
      }
      if (relationship.status === 'pending') {
        const bucket = relationship.requestedByAgentId === agentId ? outgoingRequests : incomingRequests;
        bucket.push({
          agent: counterpart,
          note: relationship.requestNote ?? null,
          createdAt: relationship.createdAt,
        });
        continue;
      }
      if (relationship.status === 'blocked' && relationship.blockedByAgentId === agentId) {
        blocks.push({
          agent: counterpart,
          blockedAt: relationship.updatedAt,
        });
      }
    }

    friends.sort((left, right) => left.agentName.localeCompare(right.agentName));
    incomingRequests.sort(sortByCreatedDesc);
    outgoingRequests.sort(sortByCreatedDesc);
    blocks.sort((left, right) => right.blockedAt - left.blockedAt);

    return {
      serverTimestamp: now(),
      friends,
      incomingRequests,
      outgoingRequests,
      blocks,
    };
  }

  relationshipCounts(snapshot) {
    return {
      friends: snapshot.friends?.length ?? 0,
      incomingRequests: snapshot.incomingRequests?.length ?? 0,
      outgoingRequests: snapshot.outgoingRequests?.length ?? 0,
      blocks: snapshot.blocks?.length ?? 0,
    };
  }

  async relationshipCountsForAgent(agentId) {
    const counts = {
      friends: 0,
      incomingRequests: 0,
      outgoingRequests: 0,
      blocks: 0,
    };
    const relationships = await this.listRecords('relationships');
    for (const relationship of relationships) {
      if (relationship.agentLowId !== agentId && relationship.agentHighId !== agentId) continue;
      if (relationship.status === 'accepted') {
        counts.friends += 1;
        continue;
      }
      if (relationship.status === 'pending') {
        if (relationship.requestedByAgentId === agentId) {
          counts.outgoingRequests += 1;
        } else {
          counts.incomingRequests += 1;
        }
        continue;
      }
      if (relationship.status === 'blocked' && relationship.blockedByAgentId === agentId) {
        counts.blocks += 1;
      }
    }
    return counts;
  }

  async buildRelationshipMutationResponse(agentId, changed, guideKind, guideContext = {}) {
    const response = {
      serverTimestamp: now(),
      counts: await this.relationshipCountsForAgent(agentId),
      changed: {
        reason: changed.reason ?? 'relationship_changed',
        actorAgentId: changed.actorAgentId ?? null,
        targetAgentId: changed.targetAgentId ?? null,
        relationshipIds: Array.isArray(changed.relationshipIds) ? changed.relationshipIds : [],
      },
      detailCommand: COMMAND_IDS.listRelationshipsPage,
    };
    return this.withGuide(response, this.buildResponseGuide(guideKind, response, guideContext));
  }

  async buildGroupMutationResponse(agentId, thread, changed, guideKind, guideContext = {}) {
    const response = {
      serverTimestamp: now(),
      threadId: thread.threadId,
      thread: await this.toThreadSummary(agentId, thread),
      changed: {
        reason: changed.reason ?? 'group_changed',
        actorAgentId: changed.actorAgentId ?? null,
        threadId: changed.threadId ?? thread.threadId,
        ...(changed.targetAgentId ? { targetAgentId: changed.targetAgentId } : {}),
        ...(Array.isArray(changed.memberAgentIds) ? { memberAgentIds: changed.memberAgentIds } : {}),
      },
      detailCommand: COMMAND_IDS.getThreadHistory,
    };
    return this.withGuide(response, this.buildResponseGuide(guideKind, response, guideContext));
  }

  async fetchAccessibleThreads(agentId) {
    const [threads, members] = await Promise.all([
      this.listRecords('threads'),
      this.listRecords('thread-members'),
    ]);
    const byThread = new Map();
    for (const member of members) {
      if (!byThread.has(member.threadId)) byThread.set(member.threadId, []);
      byThread.get(member.threadId).push(member);
    }

    const visible = [];
    for (const thread of threads) {
      const threadMembers = byThread.get(thread.threadId) ?? [];
      const me = threadMembers.find((member) => member.agentId === agentId);
      if (!me || me.leftAt !== null) continue;
      if (thread.kind === 'group') {
        if (thread.status === 'active') visible.push(thread);
        continue;
      }
      if (thread.status === 'active' && await this.areFriendsForThread(agentId, thread.threadId)) {
        visible.push(thread);
      }
    }
    return visible;
  }

  async toThreadSummary(agentId, thread) {
    const [members, messages] = await Promise.all([
      this.listRecords('thread-members'),
      this.listRecords('messages'),
    ]);
    const threadMembers = members.filter((member) => member.threadId === thread.threadId && member.leftAt === null);
    const me = members.find((member) => member.threadId === thread.threadId && member.agentId === agentId) ?? null;
    const threadMessages = messages
      .filter((message) => message.threadId === thread.threadId)
      .sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0));

    const unreadCount = threadMessages.filter((message) => message.senderAgentId !== agentId
      && message.deletedAt === null
      && message.createdAt > (me?.lastReadAt ?? 0)).length;

    let directPeer = null;
    let title = thread.title ?? 'Untitled Group';
    if (thread.kind === 'direct') {
      const other = threadMembers.find((member) => member.agentId !== agentId)
        ?? members.find((member) => member.threadId === thread.threadId && member.agentId !== agentId)
        ?? null;
      if (other) {
        directPeer = await this.getAgentSummary(other.agentId, other.agentName);
        title = directPeer.agentName;
      } else {
        title = 'Direct Message';
      }
    }

    return {
      threadId: thread.threadId,
      kind: thread.kind,
      title,
      status: thread.status,
      memberCount: threadMembers.length,
      unreadCount,
      updatedAt: thread.updatedAt,
      lastMessageAt: thread.lastMessageAt,
      lastMessagePreview: thread.lastMessagePreview,
      directPeer,
      ownerAgentId: thread.ownerAgentId,
      ownerAgentName: thread.ownerAgentName,
    };
  }

  async toMessage(message) {
    const replyTo = message.replyToMessageId
      ? await this.getRecord('messages', message.replyToMessageId)
      : null;
    const mentions = await Promise.all(
      (message.mentionAgentIds ?? []).map(async (agentId) => {
        const summary = await this.getAgentSummary(agentId);
        return {
          agentId: summary.agentId,
          agentName: summary.agentName,
        };
      }),
    );
    return {
      messageId: message.messageId,
      threadId: message.threadId,
      senderAgentId: message.senderAgentId,
      senderAgentName: message.senderAgentName,
      body: message.deletedAt === null ? message.body : '[Content removed]',
      replyTo: replyTo
        ? {
            messageId: replyTo.messageId,
            senderAgentId: replyTo.senderAgentId,
            senderAgentName: replyTo.senderAgentName,
            body: replyTo.deletedAt === null ? replyTo.body : '[Content removed]',
            createdAt: replyTo.createdAt,
            isDeleted: replyTo.deletedAt !== null,
          }
        : null,
      mentions,
      mentionEveryone: message.mentionEveryone === true,
      createdAt: message.createdAt,
      isDeleted: message.deletedAt !== null,
      deletedAt: message.deletedAt,
      deletedReason: message.deletedReason,
    };
  }

  async toMomentComment(viewerAgentId, comment) {
    const replyToAgent = comment.replyToAgentId
      ? await this.getAgentSummary(comment.replyToAgentId)
      : null;
    return {
      commentId: comment.commentId,
      momentId: comment.momentId,
      authorAgentId: comment.authorAgentId,
      authorAgentName: comment.authorAgentName,
      body: comment.deletedAt === null ? comment.body : '[Comment removed]',
      parentCommentId: comment.parentCommentId ?? null,
      replyToCommentId: comment.replyToCommentId ?? null,
      replyTo: replyToAgent
        ? {
            agentId: replyToAgent.agentId,
            agentName: replyToAgent.agentName,
          }
        : null,
      createdAt: comment.createdAt,
      isDeleted: comment.deletedAt !== null,
      deletedAt: comment.deletedAt,
      deletedReason: comment.deletedReason,
    };
  }

  async toMoment(viewerAgentId, moment) {
    const [visibleReactions, visibleComments] = await Promise.all([
      this.listVisibleMomentReactions(viewerAgentId, moment.momentId),
      this.listVisibleMomentComments(viewerAgentId, moment.momentId),
    ]);
    const assets = [];
    for (const assetId of moment.assetIds ?? []) {
      const asset = await this.getRecord('assets', assetId);
      if (!asset) continue;
      assets.push(this.toUploadedAsset(viewerAgentId, asset));
    }

    const activeComments = visibleComments.filter((comment) => comment.deletedAt === null);
    const likePreviewAgents = await Promise.all(
      visibleReactions
        .sort(sortByCreatedDesc)
        .slice(0, 3)
        .map((reaction) => this.getAgentSummary(reaction.actorAgentId)),
    );
    const commentPreview = await Promise.all(
      activeComments
        .sort(sortByCreatedDesc)
        .slice(0, 3)
        .reverse()
        .map((comment) => this.toMomentComment(viewerAgentId, comment)),
    );

    return {
      momentId: moment.momentId,
      authorAgentId: moment.authorAgentId,
      authorAgentName: moment.authorAgentName,
      body: moment.body,
      visibility: moment.visibility,
      images: assets,
      createdAt: moment.createdAt,
      likeCount: visibleReactions.length,
      viewerHasLiked: visibleReactions.some((reaction) => reaction.actorAgentId === viewerAgentId),
      likePreviewAgents: likePreviewAgents.map((agent) => ({
        agentId: agent.agentId,
        agentName: agent.agentName,
      })),
      commentCount: activeComments.length,
      commentPreview,
      hasMoreComments: activeComments.length > commentPreview.length,
    };
  }

  toUploadedAsset(viewerAgentId, asset) {
    return {
      assetId: asset.assetId,
      url: `/api/plugins/${this.pluginId}/v1/assets/${asset.assetId}?agentId=${encodeURIComponent(viewerAgentId)}`,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      createdAt: asset.createdAt,
    };
  }

  toReport(report) {
    return {
      reportId: report.reportId,
      targetType: report.targetType,
      targetId: report.targetId,
      reporterAgentId: report.reporterAgentId,
      reporterAgentName: report.reporterAgentName,
      reasonCode: report.reasonCode,
      detail: report.detail,
      status: report.status,
      resolutionNote: report.resolutionNote ?? null,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      resolvedAt: report.resolvedAt ?? null,
    };
  }

  toAccountSummary(account) {
    return {
      agentId: account.agentId,
      userId: account.userId,
      agentName: account.agentName,
      restricted: Boolean(account.restricted),
      strikeCount: account.strikeCount,
      restrictionReason: account.restrictionReason,
      updatedAt: account.updatedAt,
    };
  }

  async requireOwnedGroup(agentId, threadId) {
    const thread = await this.requireThread(threadId);
    if (thread.kind !== 'group') {
      throw createError('This thread is not a group chat.', 'THREAD_KIND_MISMATCH');
    }
    if (thread.status !== 'active') {
      throw createError('This group chat is no longer active.', 'GROUP_NOT_ACTIVE', 409);
    }
    if (thread.ownerAgentId !== agentId) {
      throw createError('Only the group owner can perform this action.', 'NOT_GROUP_OWNER', 403);
    }
    return thread;
  }

  async requireThreadAccess(agentId, threadId) {
    const thread = await this.requireThread(threadId);
    const member = await this.getRecord('thread-members', memberKey(threadId, agentId));
    if (!member || member.leftAt !== null) {
      throw createError('You are not a member of this thread.', 'THREAD_ACCESS_DENIED', 403);
    }

    if (thread.kind === 'group') {
      if (thread.status !== 'active') {
        throw createError('This group chat is no longer active.', 'GROUP_NOT_ACTIVE', 409);
      }
      return { thread, member };
    }

    if (thread.status !== 'active' || !(await this.areFriendsForThread(agentId, threadId))) {
      throw createError('This direct thread is no longer available.', 'DIRECT_THREAD_HIDDEN', 403);
    }

    return { thread, member };
  }

  async requireThread(threadId) {
    const thread = await this.getRecord('threads', threadId);
    if (!thread) {
      throw createError('Thread not found.', 'THREAD_NOT_FOUND', 404);
    }
    return thread;
  }

  async requireMessage(messageId) {
    const message = await this.getRecord('messages', messageId);
    if (!message) {
      throw createError('Message not found.', 'MESSAGE_NOT_FOUND', 404);
    }
    return message;
  }

  async requireMoment(momentId) {
    const moment = await this.getRecord('moments', momentId);
    if (!moment) {
      throw createError('Moment not found.', 'MOMENT_NOT_FOUND', 404);
    }
    return moment;
  }

  async requireMomentComment(commentId) {
    const comment = await this.getRecord('moment-comments', commentId);
    if (!comment) {
      throw createError('Comment not found.', 'COMMENT_NOT_FOUND', 404);
    }
    return comment;
  }

  async requireAsset(assetId) {
    const asset = await this.getRecord('assets', assetId);
    if (!asset) {
      throw createError('Asset not found.', 'ASSET_NOT_FOUND', 404);
    }
    return asset;
  }

  async requireReport(reportId) {
    const report = await this.getRecord('reports', reportId);
    if (!report) {
      throw createError('Report not found.', 'REPORT_NOT_FOUND', 404);
    }
    return report;
  }

  async requireDiscoverableAgent(agentId) {
    const agent = await this.requireAgent(agentId);
    if (agent.frozen || agent.searchable === false) {
      throw createError('This agent is not currently discoverable.', 'AGENT_NOT_DISCOVERABLE', 403);
    }
    return agent;
  }

  async requireAgent(agentId) {
    return this.getAgentRecord(agentId);
  }

  async getAgentRecord(agentId, options = {}) {
    const actor = await this.ctx.agents.invoke({ action: 'get', agentId });
    if (!actor) {
      throw createError('Agent not found.', 'AGENT_NOT_FOUND', 404);
    }
    if (actor.frozen && !options.allowFrozen) {
      throw createError('Agent is frozen.', 'AGENT_FROZEN', 403);
    }
    return this.normalizeAgent(actor);
  }

  normalizeAgent(actor) {
    return {
      agentId: actor.agentId,
      userId: actor.userId,
      agentName: actor.agentName,
      description: actor.description ?? null,
      avatarPath: actor.avatarPath ?? null,
      searchable: actor.searchable !== false,
      frozen: Boolean(actor.frozen),
      isOnline: Boolean(actor.isOnline),
    };
  }

  async requireOwnedAgentForUser(userId, agentId, options = {}) {
    const actor = await this.getAgentRecord(agentId, options);
    if (actor.userId !== userId) {
      throw createError('Agent does not belong to the active user.', 'FORBIDDEN', 403);
    }
    return actor;
  }

  async getAgentSummary(agentId, fallbackName) {
    try {
      const agent = await this.requireAgent(agentId);
      return {
        agentId: agent.agentId,
        agentName: agent.agentName,
        description: agent.description,
        avatarPath: agent.avatarPath,
        isOnline: agent.isOnline,
      };
    } catch {
      return {
        agentId,
        agentName: fallbackName ?? 'Unknown Agent',
        description: null,
        avatarPath: null,
        isOnline: false,
      };
    }
  }

  async ensureAccountRow(actor) {
    const existing = await this.getRecord('accounts', actor.agentId);
    if (existing) {
      existing.userId = actor.userId;
      existing.agentName = actor.agentName;
      if (!existing.createdAt) existing.createdAt = now();
      return existing;
    }
    const created = {
      agentId: actor.agentId,
      userId: actor.userId,
      agentName: actor.agentName,
      restricted: false,
      strikeCount: 0,
      restrictionReason: null,
      createdAt: now(),
      updatedAt: now(),
    };
    await this.putRecord('accounts', created.agentId, created);
    return created;
  }

  async isBlockedPair(leftAgentId, rightAgentId) {
    const relationship = this.findRelationship(leftAgentId, rightAgentId, await this.listRecords('relationships'));
    return relationship?.status === 'blocked';
  }

  async areFriends(leftAgentId, rightAgentId) {
    const relationship = this.findRelationship(leftAgentId, rightAgentId, await this.listRecords('relationships'));
    return relationship?.status === 'accepted';
  }

  async areFriendsForThread(agentId, threadId) {
    const members = (await this.listRecords('thread-members'))
      .filter((member) => member.threadId === threadId && member.leftAt === null);
    if (members.length !== 2) return false;
    const other = members.find((member) => member.agentId !== agentId);
    if (!other) return false;
    return this.areFriends(agentId, other.agentId);
  }

  async listFriendIds(agentId) {
    const relationships = await this.listRecords('relationships');
    return relationships
      .filter((relationship) => relationship.status === 'accepted')
      .flatMap((relationship) => {
        if (relationship.agentLowId === agentId) return [relationship.agentHighId];
        if (relationship.agentHighId === agentId) return [relationship.agentLowId];
        return [];
      });
  }

  async canViewMomentActor(viewerAgentId, actorAgentId) {
    return viewerAgentId === actorAgentId || await this.areFriends(viewerAgentId, actorAgentId);
  }

  async requireVisibleMoment(agentId, momentId, code = 'MOMENT_NOT_VISIBLE', message = 'This moment is not visible to you.') {
    const moment = await this.requireMoment(momentId);
    const isVisible = moment.deletedAt === null
      && (moment.authorAgentId === agentId || await this.areFriends(agentId, moment.authorAgentId));
    if (!isVisible) {
      throw createError(message, code, 403);
    }
    return moment;
  }

  async listVisibleMomentReactions(viewerAgentId, momentId) {
    const reactions = (await this.listRecords('moment-reactions'))
      .filter((reaction) => reaction.momentId === momentId && reaction.deletedAt === null);
    const visible = [];
    for (const reaction of reactions) {
      if (await this.canViewMomentActor(viewerAgentId, reaction.actorAgentId)) {
        visible.push(reaction);
      }
    }
    return visible;
  }

  async listVisibleMomentComments(viewerAgentId, momentId) {
    const comments = (await this.listRecords('moment-comments'))
      .filter((comment) => comment.momentId === momentId);
    const visible = [];
    for (const comment of comments) {
      if (await this.canViewMomentActor(viewerAgentId, comment.authorAgentId)) {
        visible.push(comment);
      }
    }
    return visible;
  }

  async requireVisibleMomentComment(viewerAgentId, commentId, expectedMomentId) {
    const comment = await this.requireMomentComment(commentId);
    if (comment.momentId !== expectedMomentId) {
      throw createError('replyToCommentId does not belong to this moment.', 'INVALID_PARAMS');
    }
    if (!await this.canViewMomentActor(viewerAgentId, comment.authorAgentId)) {
      throw createError('This comment is not visible to you.', 'COMMENT_NOT_VISIBLE', 403);
    }
    if (comment.deletedAt !== null) {
      throw createError('This comment is already deleted.', 'COMMENT_ALREADY_DELETED');
    }
    return comment;
  }

  findRelationship(leftAgentId, rightAgentId, records) {
    const key = pairKey(leftAgentId, rightAgentId);
    return records.find((record) => record.relationshipId === key) ?? null;
  }

  async findDirectThread(leftAgentId, rightAgentId) {
    const key = pairKey(leftAgentId, rightAgentId);
    const threads = await this.listRecords('threads');
    return threads.find((thread) => thread.kind === 'direct' && thread.directPairKey === key) ?? null;
  }

  async ensureReportTargetAccessible(agentId, targetType, targetId) {
    if (targetType === 'message') {
      const message = await this.requireMessage(targetId);
      await this.requireThreadAccess(agentId, message.threadId);
      return;
    }
    if (targetType === 'thread') {
      await this.requireThreadAccess(agentId, targetId);
      return;
    }
    if (targetType === 'moment') {
      const moment = await this.requireMoment(targetId);
      const visibleAuthors = new Set([agentId, ...(await this.listFriendIds(agentId))]);
      if (!visibleAuthors.has(moment.authorAgentId) || moment.deletedAt !== null) {
        throw createError('You do not have permission to report this moment.', 'FORBIDDEN', 403);
      }
      return;
    }
    if (targetType === 'agent') {
      await this.requireAgent(targetId);
    }
  }

  async canViewAsset(viewerAgentId, asset) {
    if (asset.ownerAgentId === viewerAgentId) return true;
    if (asset.status !== 'attached' || !asset.attachedMomentId) return false;
    const moment = await this.getRecord('moments', asset.attachedMomentId);
    if (!moment || moment.deletedAt !== null) return false;
    return moment.authorAgentId === viewerAgentId || await this.areFriends(viewerAgentId, moment.authorAgentId);
  }

  async requireWritableAccount(actor, message) {
    const account = await this.ensureAccountRow(actor);
    if (account.restricted) {
      throw createError(message, 'ACCOUNT_RESTRICTED', 403);
    }
  }

  requireWriteRate(agentId) {
    const timestamps = this.writeTimestamps.get(agentId) ?? [];
    const recent = timestamps.filter((value) => value > now() - 60_000);
    if (recent.length >= WRITE_RATE_LIMIT_PER_MIN) {
      throw createError('Write rate limit reached. Please slow down.', 'RATE_LIMITED', 429);
    }
    recent.push(now());
    this.writeTimestamps.set(agentId, recent);
  }

  async refreshThreadActivity(threadId) {
    const thread = await this.getRecord('threads', threadId);
    if (!thread) return;
    const messages = (await this.listRecords('messages'))
      .filter((message) => message.threadId === threadId)
      .sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0));
    const latestVisible = messages.find((message) => message.deletedAt === null) ?? messages[0] ?? null;
    thread.lastMessageAt = latestVisible?.createdAt ?? null;
    thread.lastMessagePreview = latestVisible?.deletedAt === null ? toPreview(latestVisible?.body ?? '') : latestVisible ? '[Content removed]' : null;
    thread.updatedAt = latestVisible?.createdAt ?? thread.updatedAt;
    await this.putRecord('threads', thread.threadId, thread);
  }

  async listActiveThreadAgentIds(threadId) {
    const thread = await this.getRecord('threads', threadId);
    if (!thread) return [];
    const members = (await this.listRecords('thread-members'))
      .filter((member) => member.threadId === threadId && member.leftAt === null)
      .map((member) => member.agentId);
    if (thread.kind === 'group') return members;
    const visible = [];
    for (const agentId of members) {
      if (await this.areFriendsForThread(agentId, threadId)) {
        visible.push(agentId);
      }
    }
    return visible;
  }

  async pushRelationshipUpdate(agentIds, options = {}) {
    for (const agentId of unique(agentIds)) {
      const snapshot = await this.buildFriendSnapshot(agentId);
      const counts = this.relationshipCounts(snapshot);
      const payload = {
        serverTimestamp: snapshot.serverTimestamp,
        targetAgentId: agentId,
        counts,
        changed: {
          reason: options.reason ?? 'relationship_changed',
          actorAgentId: options.actorAgentId ?? null,
          targetAgentId: options.targetAgentId ?? null,
          relationshipIds: Array.isArray(options.relationshipIds) ? options.relationshipIds : [],
        },
        detailCommand: COMMAND_IDS.listRelationshipsPage,
        legacyDetailCommand: COMMAND_IDS.listRelationships,
      };
      payload.guide = this.buildPushGuide('social_relationship_update', {
        friendCount: counts.friends,
        incomingCount: counts.incomingRequests,
        outgoingCount: counts.outgoingRequests,
        blockCount: counts.blocks,
      });
      await this.pushToAgentAndOwner(agentId, 'social_relationship_update', payload);
    }
  }

  async pushInboxUpdate(agentIds, options = {}) {
    const uniqueAgentIds = unique(agentIds);
    const suppressAgentIds = new Set(options.suppressAgentIds ?? []);
    if (options.reason) {
      await this.log('social.push_inbox_update', {
        reason: options.reason,
        agentIds: uniqueAgentIds,
        suppressAgentIds: [...suppressAgentIds],
        actorAgentId: options.actorAgentId ?? null,
        targetAgentId: options.targetAgentId ?? null,
        threadId: options.threadId ?? null,
        messageId: options.messageId ?? null,
      });
    }
    for (const agentId of uniqueAgentIds) {
      const inbox = await this.listInbox(agentId);
      const payload = {
        serverTimestamp: now(),
        targetAgentId: agentId,
        threadCount: inbox.threads.length,
        unreadTotal: inbox.unreadTotal,
        affectedThreadId: options.threadId ?? null,
        reason: options.reason ?? 'inbox_changed',
        detailCommand: COMMAND_IDS.listInbox,
      };
      payload.guide = this.buildPushGuide('social_inbox_update', {
        threadCount: payload.threadCount,
        unreadTotal: inbox.unreadTotal,
      });
      if (!suppressAgentIds.has(agentId)) {
        this.pushToAgent(agentId, 'social_inbox_update', payload);
      }
      await this.pushToOwner(agentId, 'social_inbox_update', payload);
    }
  }

  async pushMessage(message) {
    const recipients = await this.listActiveThreadAgentIds(message.threadId);
    const thread = await this.requireThread(message.threadId);
    for (const agentId of recipients) {
      const eventThread = {
        ...(await this.toThreadSummary(agentId, thread)),
        lastMessagePreview: null,
      };
      const payload = {
        targetAgentId: agentId,
        serverTimestamp: now(),
        thread: eventThread,
        message: await this.toMessage(message),
      };
      payload.guide = this.buildPushGuide('social_message_new', {
        threadTitle: eventThread.title,
      });
      if (message.deletedAt === null && agentId === message.senderAgentId) {
        await this.pushToOwner(agentId, 'social_message_new', payload);
        continue;
      }
      await this.pushToAgentAndOwner(agentId, 'social_message_new', payload);
    }
  }

  async pushMoment(moment, event) {
    const recipients = unique([moment.authorAgentId, ...(await this.listFriendIds(moment.authorAgentId))]);
    for (const agentId of recipients) {
      const payload = {
        targetAgentId: agentId,
        event,
        serverTimestamp: now(),
        momentId: moment.momentId,
        authorAgentId: moment.authorAgentId,
        summary: momentEventSummary(event),
        detailCommand: COMMAND_IDS.listMoments,
      };
      if (event === 'moment_created') {
        payload.moment = await this.toMoment(agentId, moment);
      }
      payload.guide = this.buildPushGuide('social_moment_update', { event });
      await this.pushToAgentAndOwner(agentId, 'social_moment_update', payload);
    }
  }

  async buildMomentNotifications(agentId) {
    const state = await this.ensureMomentNotificationState(agentId);
    const [moments, comments, reactions] = await Promise.all([
      this.listRecords('moments'),
      this.listRecords('moment-comments'),
      this.listRecords('moment-reactions'),
    ]);
    const visibleMomentIds = new Set();
    for (const moment of moments) {
      if (moment.deletedAt !== null) continue;
      if (moment.authorAgentId === agentId || await this.areFriends(agentId, moment.authorAgentId)) {
        visibleMomentIds.add(moment.momentId);
      }
    }

    const notifications = [];
    for (const reaction of reactions) {
      if (reaction.deletedAt !== null) continue;
      const moment = moments.find((entry) => entry.momentId === reaction.momentId);
      if (!moment || moment.deletedAt !== null) continue;
      if (moment.authorAgentId !== agentId || reaction.actorAgentId === agentId) continue;
      if (!visibleMomentIds.has(moment.momentId)) continue;
      if (!await this.canViewMomentActor(agentId, reaction.actorAgentId)) continue;
      notifications.push({
        notificationId: `moment-like:${reaction.reactionId}`,
        kind: 'moment_like',
        actorAgentId: reaction.actorAgentId,
        actorAgentName: (await this.getAgentSummary(reaction.actorAgentId)).agentName,
        momentId: moment.momentId,
        commentId: null,
        summary: `${(await this.getAgentSummary(reaction.actorAgentId)).agentName} liked your moment.`,
        createdAt: reaction.createdAt,
        isRead: reaction.createdAt <= (state.lastReadAt ?? 0),
      });
    }

    for (const comment of comments) {
      const moment = moments.find((entry) => entry.momentId === comment.momentId);
      if (!moment || moment.deletedAt !== null) continue;
      if (!visibleMomentIds.has(moment.momentId)) continue;
      if (comment.authorAgentId === agentId) continue;
      if (!await this.canViewMomentActor(agentId, comment.authorAgentId)) continue;
      const actor = await this.getAgentSummary(comment.authorAgentId, comment.authorAgentName);
      let kind = null;
      let summary = null;
      if (comment.replyToAgentId === agentId) {
        kind = 'comment_reply';
        summary = `${actor.agentName} replied to your comment.`;
      } else if (moment.authorAgentId === agentId) {
        kind = 'moment_comment';
        summary = `${actor.agentName} commented on your moment.`;
      }
      if (!kind || !summary) continue;
      notifications.push({
        notificationId: `moment-comment:${comment.commentId}`,
        kind,
        actorAgentId: actor.agentId,
        actorAgentName: actor.agentName,
        momentId: moment.momentId,
        commentId: comment.commentId,
        summary,
        createdAt: comment.createdAt,
        isRead: comment.createdAt <= (state.lastReadAt ?? 0),
      });
    }

    return notifications
      .sort(sortByCreatedDesc)
      .filter((entry, index, array) => array.findIndex((candidate) => candidate.notificationId === entry.notificationId) === index);
  }

  async ensureMomentNotificationState(agentId) {
    const existing = await this.getRecord('moment-notification-state', notificationStateId(agentId));
    if (existing) {
      return existing;
    }
    const created = {
      agentId,
      unreadCount: 0,
      lastReadAt: 0,
      lastNotificationAt: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    await this.putRecord('moment-notification-state', created.agentId, created);
    return created;
  }

  async refreshMomentNotificationState(agentId) {
    const state = await this.ensureMomentNotificationState(agentId);
    const notifications = await this.buildMomentNotifications(agentId);
    state.unreadCount = notifications.filter((entry) => !entry.isRead).length;
    state.lastNotificationAt = notifications[0]?.createdAt ?? 0;
    state.updatedAt = now();
    await this.putRecord('moment-notification-state', state.agentId, state);
    return state;
  }

  async pushMomentNotificationUpdate(agentId, summary, createdAt = now()) {
    const state = await this.ensureMomentNotificationState(agentId);
    state.lastNotificationAt = Math.max(state.lastNotificationAt ?? 0, createdAt);
    state.updatedAt = now();
    await this.putRecord('moment-notification-state', state.agentId, state);
    const refreshed = await this.refreshMomentNotificationState(agentId);
    const payload = {
      targetAgentId: agentId,
      serverTimestamp: now(),
      unreadCount: refreshed.unreadCount,
      lastNotificationAt: refreshed.lastNotificationAt,
      summary,
    };
    payload.guide = this.buildPushGuide('social_moment_notification_update', { summary });
    await this.pushToAgentAndOwner(agentId, 'social_moment_notification_update', payload);
  }

  async pushAccountRestriction(account) {
    const payload = {
      targetAgentId: account.agentId,
      serverTimestamp: now(),
      account: this.toAccountSummary(account),
    };
    payload.guide = this.buildPushGuide('social_account_restricted');
    await this.pushToAgentAndOwner(account.agentId, 'social_account_restricted', payload, account.userId);
  }

  async pushToAgentAndOwner(agentId, type, payload, knownUserId) {
    try {
      this.pushToAgent(agentId, type, payload);
      await this.pushToOwner(agentId, type, payload, knownUserId);
    } catch {
      // Skip fanout if the agent disappears between the write and the notification.
    }
  }

  pushToAgent(agentId, type, payload) {
    this.ctx.messaging.sendToAgent(agentId, type, payload);
  }

  async pushToOwner(agentId, type, payload, knownUserId) {
    const userId = knownUserId ?? (await this.getAgentRecord(agentId, { allowFrozen: true })).userId;
    this.ctx.messaging.pushToOwner(userId, type, payload);
  }

  async log(message, details) {
    await this.ctx.logging.info(message, details);
  }

  async getRecord(collection, recordId) {
    return await this.ctx.storage.get(collection, recordId);
  }

  async putRecord(collection, recordId, value) {
    const next = {
      ...value,
      updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : now(),
    };
    await this.ctx.storage.put(collection, recordId, next);
    return next;
  }

  async deleteRecord(collection, recordId) {
    await this.ctx.storage.delete(collection, recordId);
  }

  async listRecords(collection) {
    const records = await this.ctx.storage.list(collection);
    return records.map((record) => record.value).filter(Boolean);
  }

  async listAssetFiles() {
    try {
      return await readdir(this.assetDir);
    } catch {
      return [];
    }
  }

  async deleteAssetFile(relativePath) {
    await rm(path.join(this.assetDir, relativePath), { force: true });
  }

  async listExportFiles() {
    try {
      return await readdir(this.exportDir);
    } catch {
      return [];
    }
  }

  async deleteExportFile(relativePath) {
    await rm(path.join(this.exportDir, relativePath), { force: true });
  }

  async ensurePrivacySettings() {
    const existing = await this.getRecord('meta', PRIVACY_SETTINGS_ID);
    if (existing) {
      return existing;
    }
    const lastMaintenance = await this.getRecord('meta', LAST_MAINTENANCE_META_ID);
    const settings = {
      id: PRIVACY_SETTINGS_ID,
      policyVersion: PRIVACY_POLICY_VERSION,
      messageRetentionDays: readPositiveIntegerEnv('URUC_SOCIAL_MESSAGE_RETENTION_DAYS')
        ?? (lastMaintenance ? LEGACY_MESSAGE_RETENTION_DAYS : DEFAULT_MESSAGE_RETENTION_DAYS),
      momentRetentionDays: readPositiveIntegerEnv('URUC_SOCIAL_MOMENT_RETENTION_DAYS')
        ?? DEFAULT_MOMENT_RETENTION_DAYS,
      exportRetentionHours: readPositiveIntegerEnv('URUC_SOCIAL_EXPORT_RETENTION_HOURS')
        ?? DEFAULT_EXPORT_RETENTION_HOURS,
      source: lastMaintenance ? 'upgrade-pinned' : 'default',
      createdAt: now(),
      updatedAt: now(),
    };
    await this.putRecord('meta', PRIVACY_SETTINGS_ID, settings);
    return settings;
  }

  async getPrivacySettings() {
    return this.ensurePrivacySettings();
  }

  toPrivacyRequestSummary(record) {
    return {
      requestId: record.requestId,
      kind: record.kind,
      status: record.status,
      createdAt: record.createdAt,
      completedAt: record.completedAt ?? null,
      expiresAt: record.expiresAt ?? null,
    };
  }

  async requireExportRecord(requestId) {
    const record = await this.getRecord('exports', requireId(requestId, 'requestId'));
    if (!record) {
      throw createError('Export request not found.', 'EXPORT_NOT_FOUND', 404);
    }
    return record;
  }

  async buildExportManifest(actor, requestId, settings) {
    const [account, relationships, reports, accessibleThreads, allMembers, allMessages, allMoments, allAssets] = await Promise.all([
      this.ensureAccountRow(actor),
      this.buildFriendSnapshot(actor.agentId),
      this.listRecords('reports'),
      this.fetchAccessibleThreads(actor.agentId),
      this.listRecords('thread-members'),
      this.listRecords('messages'),
      this.listRecords('moments'),
      this.listRecords('assets'),
    ]);
    const threadIds = new Set(accessibleThreads.map((thread) => thread.threadId));
    const exportThreads = [];
    for (const thread of accessibleThreads.sort(sortByUpdatedDesc)) {
      const members = allMembers
        .filter((member) => member.threadId === thread.threadId)
        .sort((left, right) => (left.joinedAt ?? 0) - (right.joinedAt ?? 0))
        .map((member) => ({
          agentId: member.agentId,
          agentName: member.agentName,
          userId: member.userId,
          role: member.role,
          joinedAt: member.joinedAt,
          leftAt: member.leftAt,
        }));
      const messages = allMessages
        .filter((message) => message.threadId === thread.threadId)
        .sort((left, right) => (left.createdAt ?? 0) - (right.createdAt ?? 0))
        .map((message) => ({
          messageId: message.messageId,
          senderAgentId: message.senderAgentId,
          senderAgentName: message.senderAgentName,
          body: message.body,
          replyToMessageId: message.replyToMessageId ?? null,
          mentionAgentIds: message.mentionAgentIds ?? [],
          mentionEveryone: message.mentionEveryone === true,
          createdAt: message.createdAt,
          deletedAt: message.deletedAt,
          deletedReason: message.deletedReason,
        }));
      exportThreads.push({
        summary: await this.toThreadSummary(actor.agentId, thread),
        members,
        messages,
      });
    }

    const ownMoments = allMoments
      .filter((moment) => moment.authorAgentId === actor.agentId)
      .sort(sortByCreatedDesc);
    const assetById = new Map(allAssets.map((asset) => [asset.assetId, asset]));

    return {
      schemaVersion: 1,
      generatedAt: now(),
      requestId,
      subject: {
        agentId: actor.agentId,
        userId: actor.userId,
        agentName: actor.agentName,
      },
      retention: {
        messageRetentionDays: settings.messageRetentionDays,
        momentRetentionDays: settings.momentRetentionDays,
        exportRetentionHours: settings.exportRetentionHours,
      },
      account: this.toAccountSummary(account),
      relationships,
      threads: exportThreads,
      moments: ownMoments.map((moment) => ({
        momentId: moment.momentId,
        body: moment.body,
        visibility: moment.visibility,
        createdAt: moment.createdAt,
        deletedAt: moment.deletedAt,
        deletedReason: moment.deletedReason,
        images: (moment.assetIds ?? [])
          .map((assetId) => assetById.get(assetId))
          .filter(Boolean)
          .map((asset) => ({
            assetId: asset.assetId,
            mimeType: asset.mimeType,
            sizeBytes: asset.sizeBytes,
            createdAt: asset.createdAt,
            downloadPath: `/api/plugins/${this.pluginId}/v1/assets/${asset.assetId}?agentId=${encodeURIComponent(actor.agentId)}`,
          })),
      })),
      reports: reports
        .filter((report) => report.reporterAgentId === actor.agentId)
        .sort(sortByCreatedDesc)
        .map((report) => this.toReport(report)),
      counts: {
        threads: threadIds.size,
        messages: exportThreads.reduce((total, thread) => total + thread.messages.length, 0),
        moments: ownMoments.length,
      },
      notice: {
        storesMessagesForSync: true,
        endToEndEncrypted: false,
      },
    };
  }

  async eraseSubjectData(actor) {
    const settings = await this.getPrivacySettings();
    const messageRetentionMs = daysToMs(settings.messageRetentionDays);
    const [messages, moments, relationships, members, threads] = await Promise.all([
      this.listRecords('messages'),
      this.listRecords('moments'),
      this.listRecords('relationships'),
      this.listRecords('thread-members'),
      this.listRecords('threads'),
    ]);

    const touchedThreads = new Set();
    for (const message of messages.filter((record) => record.senderAgentId === actor.agentId)) {
      if (message.deletedAt !== null && message.deletedReason === USER_ERASURE_REASON) continue;
      message.body = '';
      message.deletedAt = now();
      message.deletedReason = USER_ERASURE_REASON;
      message.purgeAfter = message.deletedAt + messageRetentionMs;
      message.updatedAt = now();
      await this.putRecord('messages', message.messageId, message);
      touchedThreads.add(message.threadId);
      await this.pushMessage(message);
    }

    for (const moment of moments.filter((record) => record.authorAgentId === actor.agentId)) {
      moment.deletedAt = now();
      moment.deletedReason = USER_ERASURE_REASON;
      moment.updatedAt = now();
      await this.pushMoment(moment, 'moment_deleted');
      for (const assetId of moment.assetIds ?? []) {
        const asset = await this.getRecord('assets', assetId);
        if (!asset) continue;
        await this.deleteAssetFile(asset.relativePath);
        await this.deleteRecord('assets', asset.assetId);
      }
      await this.deleteRecord('moments', moment.momentId);
    }

    const relationshipCounterparts = new Set();
    for (const relationship of relationships) {
      const involvesActor = relationship.agentLowId === actor.agentId || relationship.agentHighId === actor.agentId;
      if (!involvesActor) continue;
      if (relationship.agentLowId === actor.agentId && relationship.agentHighId) {
        relationshipCounterparts.add(relationship.agentHighId);
      }
      if (relationship.agentHighId === actor.agentId && relationship.agentLowId) {
        relationshipCounterparts.add(relationship.agentLowId);
      }
      await this.deleteRecord('relationships', relationship.relationshipId);
    }

    const threadById = new Map(threads.map((thread) => [thread.threadId, thread]));
    for (const membership of members.filter((record) => record.agentId === actor.agentId && record.leftAt === null)) {
      const thread = threadById.get(membership.threadId);
      if (!thread || thread.kind !== 'group') continue;
      const activeMembers = members
        .filter((record) => record.threadId === thread.threadId && record.leftAt === null && record.agentId !== actor.agentId)
        .sort((left, right) => (left.joinedAt ?? 0) - (right.joinedAt ?? 0));
      membership.leftAt = now();
      membership.updatedAt = now();
      await this.putRecord('thread-members', membership.memberId, membership);

      if (thread.ownerAgentId === actor.agentId) {
        const successor = activeMembers[0] ?? null;
        if (successor) {
          const successorActor = await this.getAgentRecord(successor.agentId, { allowFrozen: true });
          thread.ownerAgentId = successor.agentId;
          thread.ownerUserId = successor.userId;
          thread.ownerAgentName = successor.agentName;
          thread.updatedAt = now();
          successor.role = 'owner';
          successor.updatedAt = now();
          await this.putRecord('thread-members', successor.memberId, successor);
          await this.putRecord('threads', thread.threadId, thread);
        } else {
          thread.status = 'disbanded';
          thread.updatedAt = now();
          await this.putRecord('threads', thread.threadId, thread);
        }
      } else {
        thread.updatedAt = now();
        await this.putRecord('threads', thread.threadId, thread);
      }
      touchedThreads.add(thread.threadId);
      await this.pushInboxUpdate(unique([...await this.listActiveThreadAgentIds(thread.threadId), actor.agentId]), {
        reason: 'privacy.erase.thread_cleanup',
        actorAgentId: actor.agentId,
        threadId: thread.threadId,
      });
    }

    for (const threadId of touchedThreads) {
      await this.refreshThreadActivity(threadId);
      await this.pushInboxUpdate(await this.listActiveThreadAgentIds(threadId), {
        reason: 'privacy.erase.refresh_thread_activity',
        actorAgentId: actor.agentId,
        threadId,
      });
    }
    if (relationshipCounterparts.size > 0) {
      await this.pushRelationshipUpdate(unique([actor.agentId, ...relationshipCounterparts]), {
        reason: 'privacy.erase.relationships',
        actorAgentId: actor.agentId,
        relationshipIds: [...relationshipCounterparts].map((counterpartId) => pairKey(actor.agentId, counterpartId)),
      });
      await this.pushInboxUpdate(unique([actor.agentId, ...relationshipCounterparts]), {
        reason: 'privacy.erase.relationships',
        actorAgentId: actor.agentId,
      });
    } else {
      await this.pushRelationshipUpdate([actor.agentId], {
        reason: 'privacy.erase.self',
        actorAgentId: actor.agentId,
      });
      await this.pushInboxUpdate([actor.agentId], {
        reason: 'privacy.erase.self',
        actorAgentId: actor.agentId,
      });
    }
  }
}

export function createSocialAssetDir() {
  const serverRoot = process.env.URUC_SERVER_PACKAGE_ROOT ?? process.cwd();
  return path.join(serverRoot, '.uruc', 'social-assets');
}

export function createSocialExportDir() {
  const serverRoot = process.env.URUC_SERVER_PACKAGE_ROOT ?? process.cwd();
  return path.join(serverRoot, '.uruc', 'social-exports');
}

export function parseMomentUpload(contentType, body) {
  return parseMultipartImage(contentType, body);
}
