import base from './en';

const { venue, intro, events, ...chess } = base.chess;

const play = {
  chess,
} as const;

export default play;
