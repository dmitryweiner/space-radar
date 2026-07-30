import { describeHttpError } from '../src/api/httpError';

describe('describeHttpError', () => {
  it('gives a specific, URL-free message for 429 rather than a raw status code', () => {
    const message = describeHttpError('NASA DONKI', 429, 'https://api.nasa.gov/DONKI/FLR');
    expect(message).toMatch(/rate limit/i);
    expect(message).not.toMatch(/https:\/\//);
  });

  it('falls back to a generic status message for other errors', () => {
    const message = describeHttpError('NASA DONKI', 500, 'https://api.nasa.gov/DONKI/FLR');
    expect(message).toBe('NASA DONKI request failed with status 500: https://api.nasa.gov/DONKI/FLR');
  });

  it('handles a missing status', () => {
    const message = describeHttpError('NASA DONKI', undefined, 'https://api.nasa.gov/DONKI/FLR');
    expect(message).toBe('NASA DONKI request failed with status unknown: https://api.nasa.gov/DONKI/FLR');
  });
});
