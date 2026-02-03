import { COLORS } from "../constants/chartsColors";
import type { WorkspaceChartSeries } from "../types/charts";

export const createTooltipPlugin = (series: WorkspaceChartSeries[]) => {
  let tooltip: HTMLDivElement,
    header: HTMLDivElement,
    rows: HTMLDivElement[],
    vals: HTMLSpanElement[];

  return {
    hooks: {
      init: (u: uPlot) => {
        tooltip = document.createElement("div");

        tooltip.className =
          "pointer-events-none absolute z-20 hidden rounded-lg border border-border bg-popover p-2 shadow-lg font-archivo text-[11px] text-popover-foreground will-change-transform";

        // Initial position to prevent jump
        tooltip.style.left = "0";
        tooltip.style.top = "0";

        tooltip.innerHTML = `
            <div class="t-header mb-1 text-[10px] font-bold uppercase text-muted-foreground"></div>
            ${series
              .map(
                (p, i) => `
              <div class="t-row mt-0.5 flex justify-between gap-3">
                <span class="text-muted-foreground">${p.variable}:</span>
                <span class="t-val font-bold tabular-nums" style="color: ${COLORS[i % COLORS.length]}"></span>
              </div>
            `,
              )
              .join("")}
          `;

        header = tooltip.querySelector(".t-header")!;
        rows = Array.from(tooltip.querySelectorAll(".t-row"));
        vals = Array.from(tooltip.querySelectorAll(".t-val"));
        u.root.querySelector(".u-over")?.appendChild(tooltip);
      },
      destroy: () => tooltip?.remove(),
      setCursor: (u: uPlot) => {
        const { idx, left, top } = u.cursor;
        if (idx == null || left == null || top == null)
          return tooltip.classList.add("hidden");

        let anyVisible = false;
        rows.forEach((row, i) => {
          if (u.series[i + 1].show) {
            row.classList.remove("hidden");
            row.classList.add("flex");
            vals[i].textContent = u.data[i + 1][idx]?.toFixed(2) ?? "0.00";
            anyVisible = true;
          } else {
            row.classList.add("hidden");
            row.classList.remove("flex");
          }
        });

        if (!anyVisible) return tooltip.classList.add("hidden");

        tooltip.classList.remove("hidden");
        header.textContent = `PACKET #${u.data[0][idx]}`;

        const isRight = left > u.bbox.width * 0.65;
        const x = isRight ? left - 15 : left + 15;

        tooltip.style.transform = `translate(${x}px, ${top - 40}px) ${isRight ? "translateX(-100%)" : ""}`;
      },
    },
  };
};
