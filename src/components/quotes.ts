/**
 * The lines the Quote panel offers.
 *
 * Written to sit next to the two already printed on the card — "you are a work
 * in progress" and "Act like the Girl you want to be !" — so anything picked
 * here can be dropped straight into a heading without changing the card's
 * voice: second person, lowercase, warm, a little defiant. Kept short, because
 * a heading is one line across 541 units and a long one has nowhere to go.
 */
export const QUOTES = [
  "you are a work in progress",
  "act like the girl you want to be",
  "small things, done anyway",
  "done is softer than perfect",
  "you are allowed to take up space",
  "start before you feel ready",
  "one line at a time",
  "your pace is the right pace",
  "be the friend you keep looking for",
  "finish what you start, gently",
  "tiny wins count twice",
  "you have done harder things",
  "make it, then make it good",
  "nothing has to be forever",
  "rest is part of the work",
  "keep the promises you make yourself",
  "the boring bits still count",
  "you are not behind, you are here",
  "do it badly, but do it",
  "collect proof that you tried",
  "today gets to be enough",
  "future you is watching, kindly",
  "the day is not a test",
  "cross one thing off and see",
];

/**
 * A different line from the one showing. Falls back to the current when there
 * is only one to choose from, so shuffling a single favourite is a no-op rather
 * than an empty panel.
 */
export const shuffleFrom = (pool: string[], current: string) => {
  const others = pool.filter((quote) => quote !== current);
  if (!others.length) return current;
  return others[Math.floor(Math.random() * others.length)];
};
