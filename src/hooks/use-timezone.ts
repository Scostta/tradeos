"use client"

import { createContext, useContext } from "react"

/** The signed-in user's IANA timezone, provided by the dashboard shell. */
export const TimezoneContext = createContext<string>("UTC")

export function useTimezone(): string {
  return useContext(TimezoneContext)
}
