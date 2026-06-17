import { describe, it, expect } from "vitest"
import {
  zonedDateKey,
  zonedHour,
  zonedWeekday,
  zonedYearMonthKey,
  zonedStartOfDay,
  zonedStartOfWeek,
  zonedStartOfMonth,
  zonedStartOfYear,
} from "./tz"

// 2025-03-11T04:30:00Z — after US DST start (Mar 9, 2025), so Chicago is CDT (UTC-5).
// Locally in Chicago this is 2025-03-10 23:30 (the PREVIOUS day); in Tokyo (UTC+9)
// it is 2025-03-11 13:30 (same day).
const ISO = "2025-03-11T04:30:00Z"

describe("zonedDateKey", () => {
  it("defaults to UTC", () => {
    expect(zonedDateKey(ISO)).toBe("2025-03-11")
  })
  it("rolls back a day in Chicago (night trade)", () => {
    expect(zonedDateKey(ISO, "America/Chicago")).toBe("2025-03-10")
  })
  it("stays same day in Tokyo", () => {
    expect(zonedDateKey(ISO, "Asia/Tokyo")).toBe("2025-03-11")
  })
})

describe("zonedHour", () => {
  it("UTC", () => expect(zonedHour(ISO)).toBe(4))
  it("Chicago (UTC-5)", () => expect(zonedHour(ISO, "America/Chicago")).toBe(23))
  it("Tokyo (UTC+9)", () => expect(zonedHour(ISO, "Asia/Tokyo")).toBe(13))
})

describe("zonedWeekday", () => {
  it("Tuesday in UTC", () => expect(zonedWeekday(ISO)).toBe(2))
  it("Monday in Chicago", () => expect(zonedWeekday(ISO, "America/Chicago")).toBe(1))
})

describe("zonedYearMonthKey", () => {
  it("UTC", () => expect(zonedYearMonthKey(ISO)).toBe("2025-03"))
})

describe("zoned boundaries", () => {
  const now = new Date(ISO)

  it("start of day in Chicago is local midnight (CDT, UTC-5)", () => {
    expect(zonedStartOfDay(now, "America/Chicago")).toBe("2025-03-10T05:00:00.000Z")
  })
  it("start of day in UTC", () => {
    expect(zonedStartOfDay(now)).toBe("2025-03-11T00:00:00.000Z")
  })
  it("start of week (Monday) in Chicago", () => {
    expect(zonedStartOfWeek(now, "America/Chicago")).toBe("2025-03-10T05:00:00.000Z")
  })
  it("start of month in Chicago is Mar 1 (still CST, UTC-6)", () => {
    expect(zonedStartOfMonth(now, "America/Chicago")).toBe("2025-03-01T06:00:00.000Z")
  })
  it("start of year in Chicago is Jan 1 (CST, UTC-6)", () => {
    expect(zonedStartOfYear(now, "America/Chicago")).toBe("2025-01-01T06:00:00.000Z")
  })
})
