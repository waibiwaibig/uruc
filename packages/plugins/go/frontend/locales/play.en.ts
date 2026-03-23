import base from './en';

const { venue, intro, events, ...go } = base.go;

const play = {
  go,
} as const;

export default play;
