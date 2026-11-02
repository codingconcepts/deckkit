/* Number and time formatting, for labels that have no axis to lean on.

   A figure printed next to a mark has to carry its own units and its own
   precision, because there's no gridline nearby to read it against. */

/* A magnitude, short enough to sit beside a mark. 13933 -> '13.9k'.

   One decimal above a thousand and none below it: the point of the label is
   the order of magnitude, and a chart that reads '13,933 qps' has spent four
   characters on digits nobody is going to compare. */
export const compact = (v) => {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  return v.toFixed(0);
};

/* The same magnitude with a unit welded on. `qps = unit(compact, 'qps')`.

   Curried, because a chart passes one formatter down to its grid, its
   counters and its captions, and the three of them disagreeing about
   whether to print the unit is the usual way a slide ends up saying
   "9.4k qps qps". */
export const unit = (format, suffix) => (v) => `${format(v)} ${suffix}`;

/* A fractional hour as clock time. 19.25 -> '19:15'.

   Wraps at midnight, so hour 24 and hour 0 both read '00:00' - which is
   correct for a day that closes where it opened. */
export const clock = (hour) => {
  const minutes = Math.round(hour * 60) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};

/* An hour of the day as an axis tick. 6 -> '06'.

   Bare numbers rather than clock times on the axis itself: the ticks are
   evenly spaced landmarks, and ':00' on every one of them is four characters
   of noise repeated five times. */
export const hourTick = (h) => String(h).padStart(2, "0");

/* A fraction as a percentage. 0.4812 -> '48%'. */
export const percent = (fraction, places = 0) => `${(fraction * 100).toFixed(places)}%`;

/* Bytes, binary. 1572864 -> '1.5 MiB'. */
export const bytes = (v) => {
  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  let i = 0;
  let n = v;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${i ? n.toFixed(1) : n.toFixed(0)} ${units[i]}`;
};

/* Seconds as a duration. 95 -> '1m 35s'. */
export const duration = (seconds) => {
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m < 60 ? `${m}m ${s}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

/* Grouped digits, for the one figure a deck wants in full. 13933 -> '13,933'. */
export const thousands = (v) => v.toLocaleString("en-GB", { maximumFractionDigits: 0 });

/* A signed delta, where the sign is the message. -0.12 -> '-12%'. */
export const signed = (format) => (v) => `${v > 0 ? "+" : ""}${format(v)}`;
