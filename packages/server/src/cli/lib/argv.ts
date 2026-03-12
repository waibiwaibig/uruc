import type { CommandContext, UiLanguage } from './types.js';

export function parseCommandContext(argv: string[]): { command: string | undefined; context: CommandContext } {
  const args = [...argv];
  const context: CommandContext = { args: [], json: false };
  let command: string | undefined;

  while (args.length > 0) {
    const current = args.shift()!;
    if (!command && !current.startsWith('-')) {
      command = current;
      continue;
    }
    if (current === '--json') {
      context.json = true;
      continue;
    }
    if (current === '--lang') {
      const next = args.shift();
      if (next === 'zh-CN' || next === 'en' || next === 'ko') context.lang = next as UiLanguage;
      continue;
    }
    context.args.push(current);
  }

  return { command, context };
}

export function hasFlag(args: string[], ...flags: string[]): boolean {
  return args.some((arg) => flags.includes(arg));
}

export function readOption(args: string[], ...flags: string[]): string | undefined {
  for (let i = 0; i < args.length; i += 1) {
    if (flags.includes(args[i]!)) return args[i + 1];
  }
  return undefined;
}

export function stripFlags(args: string[], ...flags: string[]): string[] {
  const next: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const current = args[i]!;
    if (flags.includes(current)) continue;
    next.push(current);
  }
  return next;
}
