import { FIRMS_MAP_KEY } from './firmsMapKey';

// Error text is shown in the card, so keep API keys out of the URL it quotes.
function redactKeys(url: string): string {
  const withoutQueryKey = url.replace(/([?&]api_key=)[^&]*/g, '$1…');
  return FIRMS_MAP_KEY ? withoutQueryKey.split(FIRMS_MAP_KEY).join('…') : withoutQueryKey;
}

export function describeHttpError(source: string, status: number | undefined, url: string): string {
  if (status === 429) {
    return `${source} rate limit reached — try again later.`;
  }
  return `${source} request failed with status ${status ?? 'unknown'}: ${redactKeys(url)}`;
}
