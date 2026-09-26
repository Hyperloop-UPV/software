#!/usr/bin/env python3
"""Analyze a backend trace-*.jsonl file.

Finds the two fault events logged by the transport layer:
  - discarded packets  -> "Ring buffer full, overwriting oldest UDP packet"
  - time limit exceeded -> "packet interval exceeded, propagating fault"

Produces a timeline plot (PNG + interactive window) and a .txt summary
next to the trace file.

Usage:
  python3 analyze_trace.py [trace.jsonl | logger-date-dir]
If no argument is given, the oldest date directory under cmd/logger is used.
"""

import json
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

import matplotlib.pyplot as plt

DISCARD_MSG = "Ring buffer full"
INTERVAL_MSG = "packet interval exceeded"

COLOR_DISCARD = "#c5373c"   # red-ish: packets lost
COLOR_INTERVAL = "#e0a020"  # amber: timing fault


def find_trace(arg: str | None) -> Path:
    logger_dir = Path(__file__).resolve().parents[1] / "cmd" / "logger"
    if arg is None:
        dirs = sorted(d for d in logger_dir.iterdir() if d.is_dir())
        if not dirs:
            sys.exit(f"no date directories under {logger_dir}")
        target = dirs[0]
    else:
        target = Path(arg)
    if target.is_file():
        return target
    traces = sorted(target.rglob("trace-*.jsonl"))
    if not traces:
        sys.exit(f"no trace-*.jsonl found under {target}")
    return traces[0]


def parse(trace: Path):
    discards, intervals = [], []
    with trace.open() as f:
        for line in f:
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            msg = rec.get("message", "")
            t = rec.get("time")
            if t is None:
                continue
            ts = t / 1e9  # ns -> s epoch
            if DISCARD_MSG in msg:
                discards.append((ts, rec))
            elif INTERVAL_MSG in msg:
                intervals.append((ts, rec))
    return discards, intervals


def fmt(ts: float) -> str:
    return datetime.fromtimestamp(ts).strftime("%H:%M:%S.%f")[:-3]


def write_summary(out: Path, trace: Path, discards, intervals):
    lines = [f"Trace analysis: {trace.name}", "=" * 60, ""]

    for name, events in (("DISCARDED PACKETS (ring buffer full)", discards),
                         ("TIME LIMIT EXCEEDED (packet interval)", intervals)):
        lines += [name, "-" * len(name)]
        if not events:
            lines += ["  no events", ""]
            continue
        t0, t1 = events[0][0], events[-1][0]
        lines += [
            f"  total events : {len(events)}",
            f"  first        : {fmt(t0)}",
            f"  last         : {fmt(t1)}",
            f"  span         : {t1 - t0:.1f} s",
        ]
        ids = Counter(r.get("id") for _, r in events if r.get("id") is not None)
        if ids:
            lines.append("  top packet ids:")
            for pid, n in ids.most_common(10):
                lines.append(f"    id {pid}: {n} events")
        ivals = [r["interval"] for _, r in events if "interval" in r]
        if ivals:
            lines.append(f"  interval (s) : min {min(ivals):.3f}  "
                         f"max {max(ivals):.3f}  "
                         f"avg {sum(ivals) / len(ivals):.3f}  "
                         f"(threshold {events[0][1].get('threshold', '?')})")
        lines.append("")

    lines += ["EVENT LOG (per second)", "-" * 22]
    per_sec = Counter()
    for ts, _ in discards:
        per_sec[(int(ts), "discarded")] += 1
    for ts, _ in intervals:
        per_sec[(int(ts), "time limit exceeded")] += 1
    for (sec, kind) in sorted(per_sec):
        n = per_sec[(sec, kind)]
        lines.append(f"  {fmt(sec)}  {kind:<20} x{n}")
    if not per_sec:
        lines.append("  (none)")

    out.write_text("\n".join(lines) + "\n")


def plot(trace: Path, discards, intervals, png: Path):
    fig, ax = plt.subplots(figsize=(11, 4.5))
    all_ts = [ts for ts, _ in discards] + [ts for ts, _ in intervals]
    if not all_ts:
        ax.text(0.5, 0.5, "No discard / time-limit events in this trace",
                ha="center", va="center", transform=ax.transAxes)
    else:
        t0 = min(all_ts)
        for events, color, label in (
            (intervals, COLOR_INTERVAL, "time limit exceeded"),
            (discards, COLOR_DISCARD, "packet discarded"),
        ):
            if not events:
                continue
            per_sec = Counter(int(ts - t0) for ts, _ in events)
            xs = sorted(per_sec)
            ax.plot(xs, [per_sec[x] for x in xs], color=color, lw=2,
                    label=f"{label} ({len(events)})")
        ax.set_xlabel(f"seconds since {fmt(t0)}")
        ax.set_ylabel("events / second")
        ax.legend(frameon=False)
    ax.set_title(f"Packet faults — {trace.name}")
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(axis="y", color="#dddddd", lw=0.5)
    fig.tight_layout()
    fig.savefig(png, dpi=150)
    print(f"plot   -> {png}")
    plt.show()


def main():
    trace = find_trace(sys.argv[1] if len(sys.argv) > 1 else None)
    print(f"trace  -> {trace}")
    discards, intervals = parse(trace)
    print(f"found  -> {len(discards)} discarded, {len(intervals)} time-limit exceeded")
    txt = trace.with_name(trace.stem + "-resume.txt")
    write_summary(txt, trace, discards, intervals)
    print(f"resume -> {txt}")
    plot(trace, discards, intervals, trace.with_name(trace.stem + "-faults.png"))


if __name__ == "__main__":
    main()
