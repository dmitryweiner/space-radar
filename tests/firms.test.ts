import { parseFirmsCsv, fetchFirePoints } from '../src/api/firms';

const VIIRS_CSV = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
30.5,-81.2,320.1,0.4,0.4,2026-07-31,1200,N,VIIRS,n,2.0NRT,290.0,5.2,D
-12.3,45.6,367.0,0.5,0.5,2026-07-31,0100,N,VIIRS,h,2.0NRT,300.0,12.0,N`;

const MODIS_CSV = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
1.0,2.0,330.0,1.0,1.0,2026-07-31,1200,A,MODIS,80,6.1NRT,290.0,8.0,D`;

describe('parseFirmsCsv', () => {
  it('reads VIIRS rows, mapping letter confidence to a 0..1 value', () => {
    const points = parseFirmsCsv(VIIRS_CSV);
    expect(points).toEqual([
      { latitude: 30.5, longitude: -81.2, brightnessKelvin: 320.1, confidence: 0.6, acquiredAt: '2026-07-31 1200' },
      { latitude: -12.3, longitude: 45.6, brightnessKelvin: 367.0, confidence: 0.9, acquiredAt: '2026-07-31 0100' },
    ]);
  });

  it('reads MODIS rows via the brightness column and numeric confidence', () => {
    const points = parseFirmsCsv(MODIS_CSV);
    expect(points[0]).toEqual({
      latitude: 1.0,
      longitude: 2.0,
      brightnessKelvin: 330.0,
      confidence: 0.8,
      acquiredAt: '2026-07-31 1200',
    });
  });

  it('returns an empty array for a header-only or malformed body', () => {
    expect(parseFirmsCsv('')).toEqual([]);
    expect(parseFirmsCsv('latitude,longitude\n')).toEqual([]);
    expect(parseFirmsCsv('nope,nada\n1,2')).toEqual([]);
  });
});

describe('fetchFirePoints', () => {
  it('throws a helpful message when no MAP_KEY is configured', async () => {
    // FIRMS_MAP_KEY ships empty by default.
    await expect(fetchFirePoints(vi.fn())).rejects.toThrow(/MAP_KEY/i);
  });
});
