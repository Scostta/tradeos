"use client"

import { useEffect } from "react"
import { markRunReviewed } from "~/actions/invest"

// §4.6: visitar Screen con el run vigente cuenta como revisión del mes.
// Sin UI: si falla, el mes queda sin revisión y se reintenta en la próxima visita.
export function MarkReviewed({ runId }: { runId: string }): null {
  useEffect(() => {
    void markRunReviewed({ runId })
  }, [runId])
  return null
}
