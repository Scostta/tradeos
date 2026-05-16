import type { ReactElement } from "react";
import { cn } from "~/utils/cn";
import { IMPORT } from "~/constants/copies/import";

type Props = {
  detected: number;
  newCount: number;
  duplicates: number;
  errors: number;
};

export function ImportMetrics(props: Props): ReactElement {
  const { detected, newCount, duplicates, errors } = props;

  const metrics = [
    {
      label: IMPORT.PREVIEW.METRIC_DETECTED,
      value: detected,
      valueClass: "text-text",
    },
    {
      label: IMPORT.PREVIEW.METRIC_NEW,
      value: newCount,
      valueClass: "text-accent",
    },
    {
      label: IMPORT.PREVIEW.METRIC_DUPLICATES,
      value: duplicates,
      valueClass: "text-text-dim",
    },
    {
      label: IMPORT.PREVIEW.METRIC_ERRORS,
      value: errors,
      valueClass: errors > 0 ? "text-loss" : "text-text-mute",
    },
  ] as const;

  return (
    <div className="grid grid-cols-4 gap-3">
      {metrics.map((metric) => (
        <div key={metric.label} className="card p-4">
          <div className="label-caps mb-1">{metric.label}</div>
          <div
            className={cn(
              "text-3xl font-mono font-semibold tracking-tight",
              metric.valueClass
            )}
          >
            {metric.value}
          </div>
        </div>
      ))}
    </div>
  );
}
