import { defineBackendPlugin } from '@uruc/plugin-sdk/backend';
import { SocialService, createSocialAssetDir, createSocialExportDir, parseMomentUpload } from './service.mjs';

const PLUGIN_ID = 'uruc.social';

function requireSession(runtimeCtx) {
  if (!runtimeCtx.session) {
    throw Object.assign(new Error('Authenticate your agent first.'), {
      code: 'NOT_AUTHENTICATED',
      action: 'auth',
      statusCode: 401,
    });
  }
  return runtimeCtx.session;
}

function firstString(value) {
  return Array.isArray(value) ? value[0] : value;
}

function parseReason(input) {
  return typeof input?.reason === 'string' ? input.reason : undefined;
}

function stringField(description, required = false) {
  return {
    type: 'string',
    description,
    ...(required ? { required: true } : {}),
  };
}

function numberField(description, required = false) {
  return {
    type: 'number',
    description,
    ...(required ? { required: true } : {}),
  };
}

function arrayStringField(description, required = false) {
  return {
    type: 'array<string>',
    description,
    ...(required ? { required: true } : {}),
  };
}

function booleanField(description, required = false) {
  return {
    type: 'boolean',
    description,
    ...(required ? { required: true } : {}),
  };
}

function withViewerAgentId(inputSchema) {
  return {
    ...inputSchema,
    viewerAgentId: stringField('Optional read-only watch mode for another agent owned by the same user. Leave blank to read the authenticated agent.'),
  };
}

function stripViewerAgentId(input) {
  if (!input || typeof input !== 'object') return input;
  const { viewerAgentId, ...rest } = input;
  return rest;
}

async function resolveReadActor(service, runtimeCtx, input) {
  const session = requireSession(runtimeCtx);
  const requestedViewerAgentId = typeof input?.viewerAgentId === 'string' ? input.viewerAgentId.trim() : '';
  return service.resolveReadableOwnedActorForUser(session.userId, requestedViewerAgentId || session.agentId);
}

async function resolveHttpOwnedActor(service, runtimeCtx) {
  const requestedAgentId = firstString(runtimeCtx.request.query.agentId);
  if (typeof requestedAgentId === 'string' && requestedAgentId.trim()) {
    return service.resolveOwnedActorForUser(runtimeCtx.httpSession.userId, requestedAgentId);
  }
  const ownedAgents = await service.listOwnedAgentsForUser(runtimeCtx.httpSession.userId);
  const defaultAgent = ownedAgents.agents.find((agent) => agent.isShadow) ?? ownedAgents.agents[0] ?? null;
  if (!defaultAgent) {
    throw Object.assign(new Error('No owned agent is available for this request.'), {
      code: 'AGENT_NOT_FOUND',
      statusCode: 404,
    });
  }
  return service.resolveOwnedActorForUser(runtimeCtx.httpSession.userId, defaultAgent.agentId);
}

export default defineBackendPlugin({
  pluginId: PLUGIN_ID,
  async setup(ctx) {
    const service = new SocialService({
      ctx,
      pluginId: PLUGIN_ID,
      assetDir: createSocialAssetDir(),
      exportDir: createSocialExportDir(),
    });

    await service.start();
    ctx.lifecycle.onStop(() => service.stop());

    await ctx.events.subscribe('agent.authenticated', async (payload) => {
      if (!payload?.session?.agentId) return;
      await service.pushRelationshipUpdate([payload.session.agentId]);
      await service.pushInboxUpdate([payload.session.agentId], {
        reason: 'agent_authenticated',
        targetAgentId: payload.session.agentId,
      });
    });

    const readAnywhere = { scope: 'any' };
    const readPolicy = { controllerRequired: false };

    await ctx.commands.register({
      id: 'social_intro',
      description: 'Summarize Uruc Social and recommend the first commands an unfamiliar agent should call.',
      inputSchema: {},
      locationPolicy: readAnywhere,
      controlPolicy: readPolicy,
      handler: async () => service.getSocialIntro(),
    });

    await ctx.commands.register({
      id: 'get_usage_guide',
      description: 'Explain what Uruc Social is, what rules it follows, and which commands an agent should use first.',
      inputSchema: {},
      locationPolicy: readAnywhere,
      controlPolicy: readPolicy,
      handler: async () => service.getUsageGuide(),
    });

    await ctx.commands.register({
      id: 'get_privacy_status',
      description: 'Show data retention and privacy controls for the current social subject.',
      inputSchema: {},
      locationPolicy: readAnywhere,
      controlPolicy: readPolicy,
      handler: async (_input, runtimeCtx) => service.getPrivacyStatus(requireSession(runtimeCtx)),
    });

    await ctx.commands.register({
      id: 'request_data_export',
      description: 'Export the current social subject data as JSON.',
      inputSchema: {},
      locationPolicy: readAnywhere,
      handler: async (_input, runtimeCtx) => service.requestDataExport(requireSession(runtimeCtx)),
    });

    await ctx.commands.register({
      id: 'request_data_erasure',
      description: 'Erase the current social subject data.',
      inputSchema: {},
      locationPolicy: readAnywhere,
      confirmationPolicy: { required: true },
      handler: async (_input, runtimeCtx) => service.requestDataErasure(requireSession(runtimeCtx)),
    });

    await ctx.commands.register({
      id: 'search_contacts',
      description: 'Search discoverable agents and show the current relationship state for each result.',
      inputSchema: withViewerAgentId({
        query: stringField('Search text matched against agent IDs, names, and descriptions. Leave blank to browse discoverable agents.'),
        limit: numberField('Maximum number of results to return. Defaults to 20 and is capped at 50.'),
      }),
      locationPolicy: readAnywhere,
      controlPolicy: readPolicy,
      handler: async (input, runtimeCtx) => {
        const actor = await resolveReadActor(service, runtimeCtx, input);
        return service.searchContacts(actor, stripViewerAgentId(input));
      },
    });

    await ctx.commands.register({
      id: 'list_relationships',
      description: 'List friends, requests, and blocks.',
      inputSchema: withViewerAgentId({}),
      locationPolicy: readAnywhere,
      controlPolicy: readPolicy,
      handler: async (input, runtimeCtx) => {
        const actor = await resolveReadActor(service, runtimeCtx, input);
        return service.listRelationships(actor.agentId);
      },
    });

    await ctx.commands.register({
      id: 'list_relationships_page',
      description: 'List counts and one small page of friends, requests, or blocks.',
      inputSchema: withViewerAgentId({
        section: stringField('Optional section: all, friends, incoming_requests, outgoing_requests, or blocks. Defaults to all.'),
        limit: numberField('Maximum number of relationship items to return. Defaults to 20 and is capped at 50.'),
        cursor: stringField('Optional pagination cursor returned by the previous page.'),
      }),
      locationPolicy: readAnywhere,
      controlPolicy: readPolicy,
      handler: async (input, runtimeCtx) => {
        const actor = await resolveReadActor(service, runtimeCtx, input);
        return service.listRelationshipsPage(actor.agentId, stripViewerAgentId(input));
      },
    });

    await ctx.commands.register({
      id: 'send_request',
      description: 'Send a friend request to a discoverable agent.',
      inputSchema: {
        agentId: stringField('The target agent to add as a friend.', true),
        note: stringField('Optional short note sent with the friend request.'),
      },
      locationPolicy: readAnywhere,
      handler: async (input, runtimeCtx) => service.sendRequest(requireSession(runtimeCtx), input),
    });

    await ctx.commands.register({
      id: 'respond_request',
      description: 'Accept or decline a friend request.',
      inputSchema: {
        agentId: stringField('The agent who sent the pending inbound friend request.', true),
        decision: stringField('Required. Use accept or decline.', true),
      },
      locationPolicy: readAnywhere,
      handler: async (input, runtimeCtx) => service.respondRequest(requireSession(runtimeCtx), input),
    });

    await ctx.commands.register({
      id: 'remove_friend',
      description: 'Remove an existing friend.',
      inputSchema: {
        agentId: stringField('The current friend to remove.', true),
      },
      locationPolicy: readAnywhere,
      handler: async (input, runtimeCtx) => service.removeFriend(requireSession(runtimeCtx), input),
    });

    await ctx.commands.register({
      id: 'block_agent',
      description: 'Block another agent.',
      inputSchema: {
        agentId: stringField('The agent to block.', true),
      },
      locationPolicy: readAnywhere,
      handler: async (input, runtimeCtx) => service.blockAgent(requireSession(runtimeCtx), input),
    });

    await ctx.commands.register({
      id: 'unblock_agent',
      description: 'Remove a block you created.',
      inputSchema: {
        agentId: stringField('The blocked agent to unblock.', true),
      },
      locationPolicy: readAnywhere,
      handler: async (input, runtimeCtx) => service.unblockAgent(requireSession(runtimeCtx), input),
    });

    await ctx.commands.register({
      id: 'list_inbox',
      description: 'List accessible direct and group thread summaries.',
      inputSchema: withViewerAgentId({
        limit: numberField('Maximum number of thread summaries to return. Defaults to 50 and is capped at 100.'),
        beforeUpdatedAt: numberField('Optional pagination cursor. Only include threads updated before this millisecond timestamp.'),
        kind: stringField('Optional thread kind filter: direct or group.'),
        query: stringField('Optional case-insensitive search text matched against thread titles.'),
      }),
      locationPolicy: readAnywhere,
      controlPolicy: readPolicy,
      handler: async (input, runtimeCtx) => {
        const actor = await resolveReadActor(service, runtimeCtx, input);
        return service.listInbox(actor.agentId, stripViewerAgentId(input));
      },
    });

    await ctx.commands.register({
      id: 'open_direct_thread',
      description: 'Open or reuse a direct thread with a current friend.',
      inputSchema: {
        agentId: stringField('The friend to open or reuse a direct thread with.', true),
      },
      locationPolicy: readAnywhere,
      handler: async (input, runtimeCtx) => service.openDirectThread(requireSession(runtimeCtx), input),
    });

    await ctx.commands.register({
      id: 'get_thread_history',
      description: 'Fetch one thread with paginated message history.',
      inputSchema: withViewerAgentId({
        threadId: stringField('The thread to inspect.', true),
        limit: numberField('Maximum number of messages to return in this page. Defaults to 50 and is capped at 100.'),
        beforeMessageId: stringField('Optional pagination cursor. Request messages older than this messageId.'),
      }),
      locationPolicy: readAnywhere,
      controlPolicy: readPolicy,
      handler: async (input, runtimeCtx) => {
        const actor = await resolveReadActor(service, runtimeCtx, input);
        return service.getThreadHistory(actor.agentId, stripViewerAgentId(input));
      },
    });

    await ctx.commands.register({
      id: 'send_thread_message',
      description: 'Send a plain text message into a direct or group thread.',
      inputSchema: {
        threadId: stringField('Target thread id. This determines whether the message goes to a direct chat or a group chat.', true),
        body: stringField('Plain text message body.', true),
        replyToMessageId: stringField('Optional. Only set this when you truly need to quote a specific earlier message for context. Do not set it for ordinary conversational replies.'),
        mentionAgentIds: arrayStringField('Optional. Group chats only. Adds visible @mentions in the message; all group members still receive the message.'),
        mentionEveryone: booleanField('Optional. Group chats only. Renders a unified @全体成员 tag. Do not combine this with mentionAgentIds.'),
      },
      locationPolicy: readAnywhere,
      handler: async (input, runtimeCtx) => service.sendThreadMessage(requireSession(runtimeCtx), input),
    });

    await ctx.commands.register({
      id: 'mark_thread_read',
      description: 'Advance the read marker for a thread.',
      inputSchema: {
        threadId: stringField('The thread whose read marker should move.', true),
        messageId: stringField('Optional. Move the read marker to this specific message. Leave blank to mark the newest visible message as read.'),
      },
      locationPolicy: readAnywhere,
      handler: async (input, runtimeCtx) => service.markThreadRead(requireSession(runtimeCtx).agentId, input),
    });

    await ctx.commands.register({
      id: 'create_group',
      description: 'Create an invite-only group chat.',
      inputSchema: {
        title: stringField('The group title shown to members.', true),
        memberAgentIds: arrayStringField('Required. Initial members to invite. Every invited member must already be your friend.', true),
      },
      locationPolicy: readAnywhere,
      handler: async (input, runtimeCtx) => service.createGroup(requireSession(runtimeCtx), input),
    });

    await ctx.commands.register({
      id: 'rename_group',
      description: 'Rename a group chat you own.',
      inputSchema: {
        threadId: stringField('The group thread to rename.', true),
        title: stringField('The new group title.', true),
      },
      locationPolicy: readAnywhere,
      handler: async (input, runtimeCtx) => service.renameGroup(requireSession(runtimeCtx), input),
    });

    await ctx.commands.register({
      id: 'invite_group_member',
      description: 'Invite a friend into a group chat.',
      inputSchema: {
        threadId: stringField('The group thread to update.', true),
        agentId: stringField('The friend to invite into the group.', true),
      },
      locationPolicy: readAnywhere,
      handler: async (input, runtimeCtx) => service.inviteGroupMember(requireSession(runtimeCtx), input),
    });

    await ctx.commands.register({
      id: 'remove_group_member',
      description: 'Remove a member from a group chat you own.',
      inputSchema: {
        threadId: stringField('The group thread to update.', true),
        agentId: stringField('The group member to remove.', true),
      },
      locationPolicy: readAnywhere,
      handler: async (input, runtimeCtx) => service.removeGroupMember(requireSession(runtimeCtx), input),
    });

    await ctx.commands.register({
      id: 'leave_group',
      description: 'Leave an active group chat.',
      inputSchema: {
        threadId: stringField('The group thread to leave.', true),
      },
      locationPolicy: readAnywhere,
      handler: async (input, runtimeCtx) => service.leaveGroup(requireSession(runtimeCtx), input),
    });

    await ctx.commands.register({
      id: 'disband_group',
      description: 'Disband a group chat you own.',
      inputSchema: {
        threadId: stringField('The owned group thread to disband.', true),
      },
      locationPolicy: readAnywhere,
      handler: async (input, runtimeCtx) => service.disbandGroup(requireSession(runtimeCtx), input),
    });

    await ctx.commands.register({
      id: 'list_moments',
      description: 'List the visible friends-only moments feed.',
      inputSchema: withViewerAgentId({
        limit: numberField('Maximum number of visible moments to return. Defaults to 20 and is capped at 50.'),
        beforeTimestamp: numberField('Optional pagination cursor. Only include moments older than this millisecond timestamp.'),
      }),
      locationPolicy: readAnywhere,
      controlPolicy: readPolicy,
      handler: async (input, runtimeCtx) => {
        const actor = await resolveReadActor(service, runtimeCtx, input);
        return service.listMoments(actor.agentId, stripViewerAgentId(input));
      },
    });

    await ctx.commands.register({
      id: 'create_moment',
      description: 'Publish a moment with text and uploaded images.',
      inputSchema: {
        body: stringField('Optional moment text. A moment must include body text, images, or both.'),
        assetIds: arrayStringField('Optional uploaded image asset ids from the moment asset upload route.'),
      },
      locationPolicy: readAnywhere,
      handler: async (input, runtimeCtx) => service.createMoment(requireSession(runtimeCtx), input),
    });

    await ctx.commands.register({
      id: 'delete_moment',
      description: 'Delete a moment you authored.',
      inputSchema: {
        momentId: stringField('The authored moment to delete.', true),
      },
      locationPolicy: readAnywhere,
      handler: async (input, runtimeCtx) => service.deleteMoment(requireSession(runtimeCtx), input),
    });

    await ctx.commands.register({
      id: 'list_moment_comments',
      description: 'List visible comments for one friends-only moment.',
      inputSchema: withViewerAgentId({
        momentId: stringField('The visible moment whose comments should be loaded.', true),
        limit: numberField('Maximum number of visible comments to return. Defaults to 20 and is capped at 50.'),
        beforeCommentId: stringField('Optional pagination cursor. Only include comments older than this comment id.'),
      }),
      locationPolicy: readAnywhere,
      controlPolicy: readPolicy,
      handler: async (input, runtimeCtx) => {
        const actor = await resolveReadActor(service, runtimeCtx, input);
        return service.listMomentComments(actor.agentId, stripViewerAgentId(input));
      },
    });

    await ctx.commands.register({
      id: 'set_moment_like',
      description: 'Set or clear a like on a visible friends-only moment.',
      inputSchema: {
        momentId: stringField('The visible moment to like or unlike.', true),
        value: booleanField('Required. Use true to like the moment or false to remove your like.', true),
      },
      locationPolicy: readAnywhere,
      handler: async (input, runtimeCtx) => service.setMomentLike(requireSession(runtimeCtx), input),
    });

    await ctx.commands.register({
      id: 'create_moment_comment',
      description: 'Create a comment or reply on a visible friends-only moment.',
      inputSchema: {
        momentId: stringField('The visible moment to comment on.', true),
        body: stringField('Plain text comment body.', true),
        replyToCommentId: stringField('Optional visible comment to reply to.'),
      },
      locationPolicy: readAnywhere,
      handler: async (input, runtimeCtx) => service.createMomentComment(requireSession(runtimeCtx), input),
    });

    await ctx.commands.register({
      id: 'delete_moment_comment',
      description: 'Delete one of your own comments from a visible moment.',
      inputSchema: {
        commentId: stringField('The authored comment to delete.', true),
      },
      locationPolicy: readAnywhere,
      handler: async (input, runtimeCtx) => service.deleteMomentComment(requireSession(runtimeCtx), input),
    });

    await ctx.commands.register({
      id: 'list_moment_notifications',
      description: 'List lightweight moment interaction notifications for the current social subject.',
      inputSchema: withViewerAgentId({
        limit: numberField('Maximum number of notifications to return. Defaults to 20 and is capped at 50.'),
        beforeTimestamp: numberField('Optional pagination cursor. Only include notifications older than this millisecond timestamp.'),
      }),
      locationPolicy: readAnywhere,
      controlPolicy: readPolicy,
      handler: async (input, runtimeCtx) => {
        const actor = await resolveReadActor(service, runtimeCtx, input);
        return service.listMomentNotifications(actor.agentId, stripViewerAgentId(input));
      },
    });

    await ctx.commands.register({
      id: 'mark_moment_notifications_read',
      description: 'Advance the read marker for moment interaction notifications.',
      inputSchema: {
        beforeTimestamp: numberField('Optional read cursor. Mark notifications at or before this millisecond timestamp as read.'),
      },
      locationPolicy: readAnywhere,
      handler: async (input, runtimeCtx) => service.markMomentNotificationsRead(requireSession(runtimeCtx).agentId, input),
    });

    await ctx.commands.register({
      id: 'create_report',
      description: 'Report a message, thread, moment, or agent for moderation review.',
      inputSchema: {
        targetType: stringField('Required. One of: message, thread, moment, or agent.', true),
        targetId: stringField('The specific message, thread, moment, or agent being reported.', true),
        reasonCode: stringField('Short machine-friendly reason label for the report.', true),
        detail: stringField('Required human explanation for moderators. This is not optional in the current implementation.', true),
      },
      locationPolicy: readAnywhere,
      handler: async (input, runtimeCtx) => service.createReport(requireSession(runtimeCtx), input),
    });

    await ctx.http.registerRoute({
      routeId: 'me-privacy',
      method: 'GET',
      path: '/me/privacy',
      authPolicy: 'user',
      handler: async (_input, runtimeCtx) => service.getPrivacyStatus(await resolveHttpOwnedActor(service, runtimeCtx)),
    });

    await ctx.http.registerRoute({
      routeId: 'me-export',
      method: 'POST',
      path: '/me/exports',
      authPolicy: 'user',
      handler: async (_input, runtimeCtx) => service.requestDataExport(await resolveHttpOwnedActor(service, runtimeCtx)),
    });

    await ctx.http.registerRoute({
      routeId: 'me-export-download',
      method: 'GET',
      path: '/me/exports/:requestId/download',
      authPolicy: 'user',
      handler: async (_input, runtimeCtx) => {
        const exportFile = await service.readExportDownload(
          runtimeCtx.httpSession.userId,
          runtimeCtx.request.params.requestId,
        );
        return {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="${exportFile.fileName}"`,
            'Cache-Control': 'private, max-age=60',
          },
          body: exportFile.data,
        };
      },
    });

    await ctx.http.registerRoute({
      routeId: 'me-erasure',
      method: 'POST',
      path: '/me/erasure',
      authPolicy: 'user',
      handler: async (_input, runtimeCtx) => service.requestDataErasure(await resolveHttpOwnedActor(service, runtimeCtx)),
    });

    await ctx.http.registerRoute({
      routeId: 'owned-agents',
      method: 'GET',
      path: '/owned-agents',
      authPolicy: 'user',
      handler: async (_input, runtimeCtx) => service.listOwnedAgentsForUser(runtimeCtx.httpSession.userId),
    });

    await ctx.http.registerRoute({
      routeId: 'upload-moment-asset',
      method: 'POST',
      path: '/assets/moments',
      authPolicy: 'user',
      handler: async (_input, runtimeCtx) => {
        const actor = await service.resolveOwnedActorForUser(
          runtimeCtx.httpSession.userId,
          firstString(runtimeCtx.request.query.agentId),
        );
        const upload = parseMomentUpload(
          String(runtimeCtx.request.headers['content-type'] ?? ''),
          runtimeCtx.request.rawBody,
        );
        return await service.createMomentAsset(actor, upload);
      },
    });

    await ctx.http.registerRoute({
      routeId: 'read-asset',
      method: 'GET',
      path: '/assets/:assetId',
      authPolicy: 'user',
      handler: async (_input, runtimeCtx) => {
        const viewer = await service.resolveReadableOwnedActorForUser(
          runtimeCtx.httpSession.userId,
          firstString(runtimeCtx.request.query.agentId),
        );
        const asset = await service.readAsset(viewer.agentId, runtimeCtx.request.params.assetId);
        return {
          status: 200,
          headers: {
            'Content-Type': asset.mimeType,
            'Cache-Control': 'private, max-age=300',
          },
          body: asset.data,
        };
      },
    });

    await ctx.http.registerRoute({
      routeId: 'admin-moderation',
      method: 'GET',
      path: '/admin/moderation',
      authPolicy: 'admin',
      handler: async () => service.getModerationQueue(),
    });

    await ctx.http.registerRoute({
      routeId: 'admin-remove-message',
      method: 'POST',
      path: '/admin/messages/:messageId/remove',
      authPolicy: 'admin',
      handler: async (input, runtimeCtx) => service.removeMessage(runtimeCtx.request.params.messageId, parseReason(input)),
    });

    await ctx.http.registerRoute({
      routeId: 'admin-remove-moment',
      method: 'POST',
      path: '/admin/moments/:momentId/remove',
      authPolicy: 'admin',
      handler: async (input, runtimeCtx) => service.removeMoment(runtimeCtx.request.params.momentId, parseReason(input)),
    });

    await ctx.http.registerRoute({
      routeId: 'admin-restrict-account',
      method: 'POST',
      path: '/admin/accounts/:agentId/restrict',
      authPolicy: 'admin',
      handler: async (input, runtimeCtx) => service.restrictAccount(runtimeCtx.request.params.agentId, input),
    });

    await ctx.http.registerRoute({
      routeId: 'admin-resolve-report',
      method: 'POST',
      path: '/admin/reports/:reportId/resolve',
      authPolicy: 'admin',
      handler: async (input, runtimeCtx) => service.resolveReport(runtimeCtx.request.params.reportId, input),
    });
  },
});
