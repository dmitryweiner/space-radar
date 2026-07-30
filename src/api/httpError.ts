export function describeHttpError(source: string, status: number | undefined, url: string): string {
  if (status === 429) {
    return `${source} rate limit reached — try again later.`;
  }
  return `${source} request failed with status ${status ?? 'unknown'}: ${url}`;
}
