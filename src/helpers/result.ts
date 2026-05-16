export type ResultType<T, E = string> =
  | { success: true; data: T }
  | { success: false; error: E }

export function createDataResult<T>(data: T): ResultType<T, never> {
  return { success: true, data }
}

export function createErrorResult<E>(error: E): ResultType<never, E> {
  return { success: false, error }
}
