#!/usr/bin/env node

import { appendFile, mkdir } from 'fs/promises';
import path from 'path';

function parseArgs(argv) {
  const values = {
    width: 11,
    height: 11,
    timeout: 15000,
    delay: 0,
    ruleset: 'standard',
    map: 'standard',
    output: '',
    names: [],
    urls: [],
    port: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === 'play') continue;
    if (token === '-W' || token === '--width') values.width = Number(argv[++index] ?? values.width);
    else if (token === '-H' || token === '--height') values.height = Number(argv[++index] ?? values.height);
    else if (token === '-t' || token === '--timeout') values.timeout = Number(argv[++index] ?? values.timeout);
    else if (token === '-d' || token === '--delay' || token === '--turn-delay') values.delay = Number(argv[++index] ?? values.delay);
    else if (token === '-g' || token === '--gametype' || token === '--ruleset') values.ruleset = String(argv[++index] ?? values.ruleset);
    else if (token === '-m' || token === '--map') values.map = String(argv[++index] ?? values.map);
    else if (token === '-o' || token === '--output') values.output = String(argv[++index] ?? values.output);
    else if (token === '--port') values.port = Number(argv[++index] ?? values.port);
    else if (token === '--name' || token === '-n') values.names.push(String(argv[++index] ?? 'Snake'));
    else if (token === '--url' || token === '-u') values.urls.push(String(argv[++index] ?? ''));
  }

  return values;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`request failed ${response.status} for ${url}`);
  }
  const text = await response.text();
  return text.trim() === '' ? {} : JSON.parse(text);
}

async function appendJsonLine(filePath, payload) {
  await appendFile(filePath, `${JSON.stringify(payload)}\n`, 'utf8');
}

function buildSnake(id, name, body, health = 100) {
  return {
    id,
    name,
    latency: '0',
    health,
    body,
    head: body[0],
    length: body.length,
    shout: '',
    customizations: {
      color: id === 'snake-1' ? '#51f6cd' : '#ff8a3d',
      head: 'beluga',
      tail: 'bolt',
    },
  };
}

function makeRequest(game, turn, board, you) {
  return {
    game,
    turn,
    board,
    you,
  };
}

function moveSnake(snake, move) {
  const head = snake.body[0];
  const delta = move === 'down'
    ? { x: 0, y: -1 }
    : move === 'left'
      ? { x: -1, y: 0 }
      : move === 'right'
        ? { x: 1, y: 0 }
        : { x: 0, y: 1 };
  const nextHead = {
    x: head.x + delta.x,
    y: head.y + delta.y,
  };
  const nextBody = [nextHead, ...snake.body.slice(0, -1)];
  return buildSnake(snake.id, snake.name, nextBody, snake.health - 1);
}

const args = parseArgs(process.argv.slice(2));

if (!args.output) {
  console.error('missing output path');
  process.exit(1);
}

await mkdir(args.output, { recursive: true });
const outputPath = path.join(args.output, 'state.jsonl');

const game = {
  id: 'fake-battlesnake-match',
  ruleset: {
    name: args.ruleset,
    version: 'fake-cli',
    settings: {
      hazardMap: args.map,
    },
  },
  timeout: args.timeout,
  source: 'fake-cli',
};

const snakes = [
  buildSnake('snake-1', args.names[0] ?? 'Alpha', [{ x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 0 }]),
  buildSnake('snake-2', args.names[1] ?? 'Bravo', [{ x: args.width - 2, y: 1 }, { x: args.width - 2, y: 0 }, { x: args.width - 3, y: 0 }]),
];

const board0 = {
  width: args.width,
  height: args.height,
  food: [{ x: Math.floor(args.width / 2), y: Math.floor(args.height / 2) }],
  hazards: [],
  snakes,
};

await appendJsonLine(outputPath, {
  game,
  turn: 0,
  board: board0,
});

await Promise.all(args.urls.map((url, index) => postJson(`${url}/start`, makeRequest(game, 0, board0, snakes[index]))));

if (args.delay > 0) {
  await new Promise((resolve) => setTimeout(resolve, args.delay));
}

const moveResponses = await Promise.all(args.urls.map((url, index) => postJson(
  `${url}/move`,
  makeRequest(game, 1, board0, snakes[index]),
)));

const nextAlpha = moveSnake(snakes[0], String(moveResponses[0]?.move ?? 'up'));
const nextBravo = moveSnake(snakes[1], String(moveResponses[1]?.move ?? 'left'));

const board1 = {
  width: args.width,
  height: args.height,
  food: [],
  hazards: [],
  snakes: [nextAlpha],
};

await appendJsonLine(outputPath, {
  game,
  turn: 1,
  board: board1,
});

await Promise.all(args.urls.map((url, index) => postJson(
  `${url}/end`,
  makeRequest(game, 1, board1, index === 0 ? nextAlpha : nextBravo),
)));

