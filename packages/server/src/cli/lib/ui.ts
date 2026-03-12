import readline from 'readline';
import { createInterface } from 'readline/promises';

import type { UiLanguage } from './types.js';

const labels = {
  'zh-CN': {
    welcome: '欢迎来到 Uruc',
    subtitle: '主城配置与运维命令行',
    selectLang: '请选择语言',
    pressEnterDefault: '回车保留默认值',
    selectHint: '↑/↓ 选择，Enter 确认，也可直接输入数字',
    yes: '是',
    no: '否',
    invalidChoice: '无效选项，请重试。',
  },
  en: {
    welcome: 'Welcome to Uruc',
    subtitle: 'City configure and runtime CLI',
    selectLang: 'Choose language',
    pressEnterDefault: 'Press Enter to keep the default',
    selectHint: 'Use ↑/↓ to choose, Enter to confirm, or type a number',
    yes: 'Yes',
    no: 'No',
    invalidChoice: 'Invalid choice. Try again.',
  },
  ko: {
    welcome: 'Uruc에 오신 것을 환영합니다',
    subtitle: '도시 구성 및 런타임 CLI',
    selectLang: '언어를 선택하세요',
    pressEnterDefault: '기본값을 유지하려면 Enter를 누르세요',
    selectHint: '↑/↓ 로 선택하고 Enter 로 확인하거나 숫자를 입력하세요',
    yes: '예',
    no: '아니요',
    invalidChoice: '잘못된 선택입니다. 다시 시도하세요.',
  },
} as const;

export function t(lang: UiLanguage, key: keyof typeof labels['zh-CN']): string {
  return labels[lang][key];
}

export function printBanner(lang: UiLanguage, title?: string): void {
  const lines = [
    '           |>>>                    |>>>',
    '           |                        |',
    '       _  _|_  _                _  _|_  _',
    '      |;|_|;|_|;|              |;|_|;|_|;|',
    '      \\.    .  /              \\.    .  /',
    '       \\:  .  /                \\:  .  /',
    '        ||:   |                  ||:   |',
    '        ||:.  |                  ||:.  |',
    '        ||:  .|      URUC        ||:  .|',
    '        ||:   |                  ||:   |',
    '        ||: , |                  ||: , |',
    '        ||:   |                  ||:   |',
    '        ||: . |                  ||: . |',
    '       __||_   |__              __||_   |__',
    '------/____\\____/------------/____\\____/---',
  ];
  console.log(lines.join('\n'));
  console.log(`${t(lang, 'welcome')} · ${title ?? t(lang, 'subtitle')}`);
  console.log(t(lang, 'pressEnterDefault'));
  console.log('');
}

export function printSection(title: string): void {
  console.log(`== ${title} ==`);
}

export function printStatus(level: 'ok' | 'warn' | 'fail' | 'info', message: string): void {
  const badge = level === 'ok'
    ? '[ok]'
    : level === 'warn'
      ? '[warn]'
      : level === 'fail'
        ? '[fail]'
        : '[info]';
  console.log(`${badge} ${message}`);
}

export async function promptInput(
  prompt: string,
  defaultValue = '',
  options: { secret?: boolean } = {},
): Promise<string> {
  if (options.secret) {
    const secret = await promptSecret(prompt, defaultValue);
    return secret.trim() === '' ? defaultValue : secret.trim();
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultValue ? ` (${defaultValue})` : '';
  const answer = await rl.question(`${prompt}${suffix}: `);
  await rl.close();
  return answer.trim() === '' ? defaultValue : answer.trim();
}

export async function promptChoice<T extends string>(
  prompt: string,
  options: Array<{ value: T; label: string; description?: string }>,
  defaultValue: T,
  lang: UiLanguage,
): Promise<T> {
  if (process.stdin.isTTY && process.stdout.isTTY) {
    return promptChoiceTty(prompt, options, defaultValue, lang);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  while (true) {
    console.log(prompt);
    options.forEach((option, index) => {
      const marker = option.value === defaultValue ? ' *' : '  ';
      console.log(`  ${index + 1}. ${option.label}${marker}`);
      if (option.description) console.log(`     ${option.description}`);
    });
    const answer = await rl.question(`> `);
    const trimmed = answer.trim();
    if (trimmed === '') {
      await rl.close();
      return defaultValue;
    }
    const asNumber = Number.parseInt(trimmed, 10);
    if (Number.isFinite(asNumber) && asNumber >= 1 && asNumber <= options.length) {
      await rl.close();
      return options[asNumber - 1]!.value;
    }
    const direct = options.find((option) => option.value === trimmed || option.label === trimmed);
    if (direct) {
      await rl.close();
      return direct.value;
    }
    console.log(t(lang, 'invalidChoice'));
  }
}

export async function promptConfirm(prompt: string, defaultValue: boolean, lang: UiLanguage): Promise<boolean> {
  const selection = await promptChoice(
    prompt,
    [
      { value: 'yes', label: t(lang, 'yes') },
      { value: 'no', label: t(lang, 'no') },
    ],
    defaultValue ? 'yes' : 'no',
    lang,
  );
  return selection === 'yes';
}

async function promptSecret(prompt: string, defaultValue = ''): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const suffix = defaultValue ? ' (hidden default preserved)' : '';
    const answer = await rl.question(`${prompt}${suffix}: `);
    await rl.close();
    return answer;
  }

  return await new Promise<string>((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    readline.emitKeypressEvents(stdin);
    const previousRawMode = stdin.isRaw;
    const wasPaused = stdin.isPaused();
    stdin.resume();
    stdin.setRawMode?.(true);
    stdout.write(`${prompt}${defaultValue ? ' (hidden default preserved)' : ''}: `);
    let value = '';

    const onKeypress = (_char: string, key: readline.Key) => {
      if (key.name === 'return' || key.name === 'enter') {
        stdout.write('\n');
        stdin.off('keypress', onKeypress);
        stdin.setRawMode?.(previousRawMode ?? false);
        if (wasPaused) stdin.pause();
        resolve(value || defaultValue);
        return;
      }
      if (key.name === 'backspace') {
        if (value.length > 0) {
          value = value.slice(0, -1);
          stdout.write('\b \b');
        }
        return;
      }
      if (key.ctrl && key.name === 'c') {
        stdout.write('\n');
        stdin.off('keypress', onKeypress);
        stdin.setRawMode?.(previousRawMode ?? false);
        if (wasPaused) stdin.pause();
        process.exit(1);
      }
      if (key.sequence) {
        value += key.sequence;
        stdout.write('*');
      }
    };

    stdin.on('keypress', onKeypress);
  });
}

async function promptChoiceTty<T extends string>(
  prompt: string,
  options: Array<{ value: T; label: string; description?: string }>,
  defaultValue: T,
  lang: UiLanguage,
): Promise<T> {
  return await new Promise<T>((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    readline.emitKeypressEvents(stdin);
    const previousRawMode = stdin.isRaw;
    const wasPaused = stdin.isPaused();
    stdin.resume();
    stdin.setRawMode?.(true);

    let selectedIndex = Math.max(0, options.findIndex((option) => option.value === defaultValue));
    let renderedLines = 0;

    const draw = () => {
      if (renderedLines > 0) {
        readline.moveCursor(stdout, 0, -(renderedLines - 1));
      }
      readline.cursorTo(stdout, 0);
      readline.clearScreenDown(stdout);
      stdout.write(`${prompt}\n`);
      stdout.write(`${t(lang, 'selectHint')}\n`);
      renderedLines = 3;
      options.forEach((option, index) => {
        const pointer = index === selectedIndex ? '›' : ' ';
        const defaultMark = option.value === defaultValue
          ? (lang === 'zh-CN' ? ' · 默认' : lang === 'ko' ? ' · 기본값' : ' · default')
          : '';
        stdout.write(`  ${pointer} ${option.label}${defaultMark}\n`);
        renderedLines += 1;
        if (option.description) {
          stdout.write(`    ${option.description}\n`);
          renderedLines += 1;
        }
      });
      stdout.write('> ');
    };

    const cleanup = () => {
      stdin.off('keypress', onKeypress);
      stdin.setRawMode?.(previousRawMode ?? false);
      if (wasPaused) stdin.pause();
    };

    const onKeypress = (_char: string, key: readline.Key) => {
      if (key.ctrl && key.name === 'c') {
        stdout.write('\n');
        cleanup();
        process.exit(1);
      }
      if (key.name === 'up') {
        selectedIndex = selectedIndex <= 0 ? options.length - 1 : selectedIndex - 1;
        draw();
        return;
      }
      if (key.name === 'down') {
        selectedIndex = selectedIndex >= options.length - 1 ? 0 : selectedIndex + 1;
        draw();
        return;
      }
      if (key.name === 'return' || key.name === 'enter') {
        const selected = options[selectedIndex]!;
        stdout.write(`${selected.label}\n`);
        cleanup();
        resolve(selected.value);
        return;
      }
      if (key.sequence) {
        const asNumber = Number.parseInt(key.sequence, 10);
        if (Number.isFinite(asNumber) && asNumber >= 1 && asNumber <= options.length) {
          selectedIndex = asNumber - 1;
          const selected = options[selectedIndex]!;
          stdout.write(`${selected.label}\n`);
          cleanup();
          resolve(selected.value);
        }
      }
    };

    draw();
    stdin.on('keypress', onKeypress);
  });
}
