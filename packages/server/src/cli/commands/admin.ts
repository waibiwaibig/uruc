import {
  banUser,
  createAdmin,
  freezeAgent,
  kickAgent,
  listAdmins,
  listAgents,
  listUsers,
  promoteUser,
  resetAdminPassword,
} from '../lib/admin.js';
import { promptInput } from '../lib/ui.js';
import { readOption } from '../lib/argv.js';
import type { CommandContext } from '../lib/types.js';

function requireTarget(value: string | undefined, label: string): string {
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

export async function runAdminCommand(context: CommandContext): Promise<void> {
  const [subcommand, ...rest] = context.args;

  switch (subcommand) {
    case 'create': {
      const username = rest[0] ?? await promptInput('Admin username', 'admin');
      const password = readOption(rest, '--password') ?? await promptInput('Admin password', '', { secret: true });
      const email = readOption(rest, '--email') ?? await promptInput('Admin email', 'admin@localhost');
      const result = await createAdmin(username, password, email);
      if (context.json) {
        console.log(JSON.stringify({ username, email, ...result }, null, 2));
        return;
      }
      if (!result.created) throw new Error(result.reason ?? 'Failed to create admin');
      console.log(`Created admin ${username}.`);
      return;
    }
    case 'list': {
      const rows = await listAdmins();
      if (context.json) {
        console.log(JSON.stringify(rows, null, 2));
        return;
      }
      rows.forEach((row) => console.log(`${row.username}\t${row.id}\t${row.email ?? '-'}\t${row.createdAt.toISOString()}`));
      return;
    }
    case 'promote': {
      const target = requireTarget(rest[0], 'user');
      const result = await promoteUser(target);
      if (context.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(`Promoted ${result.username} (${result.id}) to admin.`);
      return;
    }
    case 'reset-password': {
      const target = requireTarget(rest[0], 'user');
      const password = readOption(rest, '--password') ?? await promptInput('New password', '', { secret: true });
      const result = await resetAdminPassword(target, password);
      if (context.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(`Reset password for ${result.username}.`);
      return;
    }
    case 'users': {
      const search = readOption(rest, '--search');
      const result = await listUsers(search);
      if (context.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(`Total users: ${result.total}`);
      result.users.forEach((user) => {
        console.log(`${user.username}\t${user.id}\trole=${user.role}\tbanned=${user.banned ? 'yes' : 'no'}`);
      });
      return;
    }
    case 'ban':
    case 'unban': {
      const target = requireTarget(rest[0], 'user');
      const result = await banUser(target, subcommand === 'ban');
      if (context.json) {
        console.log(JSON.stringify({ ...result, banned: subcommand === 'ban' }, null, 2));
        return;
      }
      console.log(`${subcommand === 'ban' ? 'Banned' : 'Unbanned'} ${result.username}.`);
      return;
    }
    case 'agents': {
      const rows = await listAgents();
      if (context.json) {
        console.log(JSON.stringify(rows, null, 2));
        return;
      }
      rows.forEach((agent) => {
        console.log(`${agent.name}\t${agent.id}\towner=${agent.ownerName ?? '-'}\tfrozen=${agent.frozen ? 'yes' : 'no'}\tonline=${agent.isOnline ? 'yes' : 'no'}`);
      });
      return;
    }
    case 'freeze':
    case 'unfreeze': {
      const target = requireTarget(rest[0], 'agent');
      const result = await freezeAgent(target, subcommand === 'freeze');
      if (context.json) {
        console.log(JSON.stringify({ ...result, frozen: subcommand === 'freeze' }, null, 2));
        return;
      }
      console.log(`${subcommand === 'freeze' ? 'Froze' : 'Unfroze'} ${result.name}.`);
      return;
    }
    case 'kick': {
      const target = requireTarget(rest[0], 'agent');
      const result = await kickAgent(target);
      if (context.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      if (!result.success) throw new Error(result.message);
      console.log(result.message);
      return;
    }
    default:
      throw new Error('Unknown admin command. Use `uruc help` for the supported subcommands.');
  }
}
