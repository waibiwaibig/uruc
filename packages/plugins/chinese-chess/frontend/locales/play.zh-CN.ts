import base from './zh-CN';

const { venue, intro, events, ...chineseChess } = base.chineseChess;

const play = {
  chineseChess,
} as const;

export default play;
