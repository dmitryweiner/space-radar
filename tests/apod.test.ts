import { parseApod, fetchApod } from '../src/api/apod';

const IMAGE_SAMPLE = {
  date: '2026-07-31',
  title: 'NGC 4372 and the Dark Doodad',
  media_type: 'image',
  url: 'https://apod.nasa.gov/apod/image/x_1024.jpg',
  hdurl: 'https://apod.nasa.gov/apod/image/x_2048.jpg',
  copyright: 'Some Astronomer',
};

const VIDEO_SAMPLE = {
  date: '2026-07-30',
  title: 'A Video Day',
  media_type: 'video',
  url: 'https://www.youtube.com/embed/abc',
  thumbnail_url: 'https://img.youtube.com/vi/abc/0.jpg',
};

describe('parseApod', () => {
  it('uses the image url for image days and hdurl as the link', () => {
    expect(parseApod(IMAGE_SAMPLE)).toEqual({
      date: '2026-07-31',
      title: 'NGC 4372 and the Dark Doodad',
      mediaType: 'image',
      imageUrl: 'https://apod.nasa.gov/apod/image/x_1024.jpg',
      linkUrl: 'https://apod.nasa.gov/apod/image/x_2048.jpg',
      copyright: 'Some Astronomer',
    });
  });

  it('falls back to the thumbnail for video days', () => {
    const parsed = parseApod(VIDEO_SAMPLE);
    expect(parsed?.imageUrl).toBe('https://img.youtube.com/vi/abc/0.jpg');
    expect(parsed?.copyright).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(parseApod(null)).toBeNull();
    expect(parseApod({ title: 'no date' })).toBeNull();
  });
});

describe('fetchApod', () => {
  it('fetches the APOD endpoint with thumbs enabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(IMAGE_SAMPLE) });
    const info = await fetchApod(fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('thumbs=true'));
    expect(info.title).toBe('NGC 4372 and the Dark Doodad');
  });

  it('throws on a malformed body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ nope: true }) });
    await expect(fetchApod(fetchMock)).rejects.toThrow(/unexpected response shape/i);
  });

  it('throws when the request is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve(null) });
    await expect(fetchApod(fetchMock)).rejects.toThrow();
  });
});
