import {
  parseNasaImages,
  nasaImagesSearchUrl,
  fetchNasaImages,
  fetchNasaImagesForTopics,
} from '../src/api/nasaImages';

function item(id: string, href = `https://images-assets.nasa.gov/image/${id}/${id}~medium.jpg`) {
  return {
    data: [{ nasa_id: id, title: `Title ${id}`, description: `About ${id}`, date_created: '2011-08-10T21:00:09Z' }],
    links: [{ href, rel: 'preview', render: 'image' }],
  };
}

const RESULT = { collection: { items: [item('PIA1'), item('PIA2')] } };

describe('nasaImagesSearchUrl', () => {
  it('builds an encoded image search URL', () => {
    expect(nasaImagesSearchUrl('deep space')).toBe(
      'https://images-api.nasa.gov/search?q=deep%20space&media_type=image',
    );
  });
});

describe('parseNasaImages', () => {
  it('extracts id, title, description and image url', () => {
    const images = parseNasaImages(RESULT);
    expect(images).toHaveLength(2);
    expect(images[0]).toEqual({
      id: 'PIA1',
      title: 'Title PIA1',
      description: 'About PIA1',
      dateCreated: '2011-08-10T21:00:09Z',
      imageUrl: 'https://images-assets.nasa.gov/image/PIA1/PIA1~medium.jpg',
    });
  });

  it('skips items without a usable image link', () => {
    const images = parseNasaImages({ collection: { items: [{ data: [{ nasa_id: 'x' }], links: [] }] } });
    expect(images).toEqual([]);
  });

  it('returns an empty array for malformed input', () => {
    expect(parseNasaImages(null)).toEqual([]);
    expect(parseNasaImages({ collection: {} })).toEqual([]);
  });
});

describe('fetchNasaImages', () => {
  it('fetches and parses a single query', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(RESULT) });
    const images = await fetchNasaImages('nebula', fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('q=nebula'));
    expect(images).toHaveLength(2);
  });

  it('throws when the request is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve(null) });
    await expect(fetchNasaImages('nebula', fetchMock)).rejects.toThrow();
  });
});

describe('fetchNasaImagesForTopics', () => {
  it('merges topics and dedups by id', async () => {
    const first = { collection: { items: [item('PIA1'), item('PIA2')] } };
    const second = { collection: { items: [item('PIA2'), item('PIA3')] } };
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(url.includes('mars') ? second : first) }),
    );
    const images = await fetchNasaImagesForTopics(['nebula', 'mars'], fetchMock);
    expect(images.map((image) => image.id).sort()).toEqual(['PIA1', 'PIA2', 'PIA3']);
  });

  it('tolerates one failing topic', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      url.includes('mars')
        ? Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve(null) })
        : Promise.resolve({ ok: true, json: () => Promise.resolve(RESULT) }),
    );
    const images = await fetchNasaImagesForTopics(['nebula', 'mars'], fetchMock);
    expect(images).toHaveLength(2);
  });

  it('throws when every topic fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve(null) });
    await expect(fetchNasaImagesForTopics(['nebula'], fetchMock)).rejects.toThrow(/unavailable/i);
  });
});
