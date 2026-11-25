import { describe, expect, it } from 'vitest';
import { buildDailyMapUrl, normalizeDailyMapRawUrl } from '../lib/dailyPzoMapUrl.js';

describe('dailyPzoMapUrl', () => {
    const jjpRawOld =
        'http://map.gis-div.com:8080/geoserver/pub_pzo/wms?service=WMS&version=1.1.0&request=GetMap&layers=pub_pzo%3APZO_Pemantauan_PT&bbox=100.66,1.894,100.833,2.023&width=600&height=447&srs=EPSG%3A4326&styles=&format=image/png&viewparams=idWeek:533;company:JJP&CQL_FILTER=CompanyFil%20LIKE%20%27%25JJP%25%27';

    const jjpExpectedProxied =
        'https://app.gis-div.com/PZO/Content/GambarProxy.ashx?url=http%3A%2F%2Fmap.gis-div.com%3A8080%2Fgeoserver%2Fpub_pzo%2Fwms%3Fservice%3DWMS%26version%3D1.1.0%26request%3DGetMap%26layers%3Dpub_pzo%253Atemp_pzo_layout%26bbox%3D100.66%2C1.894%2C100.833%2C2.023%26width%3D600%26height%3D447%26srs%3DEPSG%253A4326%26styles%3D%26format%3Dimage%2Fpng%26viewparams%3DidWeek%3A533';

    it('transforms PT.JJP URL to exact target proxied URL', () => {
        expect(buildDailyMapUrl(jjpRawOld, 'PT.JJP')).toBe(jjpExpectedProxied);
    });

    it('preserves dynamic idWeek for previous/current weeks and handles case/whitespace', () => {
        const w1Raw = jjpRawOld.replace('idWeek:533', 'idWeek:532');
        const normalized = normalizeDailyMapRawUrl(w1Raw, ' pt.jjp ');
        expect(normalized).toContain('layers=pub_pzo%3Atemp_pzo_layout');
        expect(normalized).toContain('viewparams=idWeek:532');
        expect(normalized).not.toContain('company:');
        expect(normalized).not.toContain('CQL_FILTER');
    });

    it('keeps non-JJP company URLs unchanged', () => {
        const ptwRaw =
            'http://map.gis-div.com:8080/geoserver/pub_pzo/wms?service=WMS&version=1.1.0&request=GetMap&layers=pub_pzo%3APZO_Pemantauan_PT&bbox=100.1,1.1,100.2,1.2&width=600&height=447&srs=EPSG%3A4326&styles=&format=image/png&viewparams=idWeek:533;company:PTW&CQL_FILTER=CompanyFil%20LIKE%20%27%25PTW%25%27';
        expect(normalizeDailyMapRawUrl(ptwRaw, 'PT.PTW')).toBe(ptwRaw);
    });

    it('returns empty string for empty input', () => {
        expect(buildDailyMapUrl('', 'PT.JJP')).toBe('');
        expect(buildDailyMapUrl(null, 'PT.JJP')).toBe('');
    });
});
