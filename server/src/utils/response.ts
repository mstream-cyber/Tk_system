export function success(data: unknown) {
  return { success: true as const, data };
}

export function error(message: string) {
  return { success: false as const, error: message };
}
