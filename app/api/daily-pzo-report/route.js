import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const ptName = searchParams.get('ptName');
    const weekId = searchParams.get('weekId');

    if (!ptName || !weekId) {
        return NextResponse.json({ error: 'ptName and weekId are required' }, { status: 400 });
    }

    const API_URL = "https://app.gis-div.com/PZO/Service/MapService.asmx/getPetaPerbandinganPetaGo";
    const PROXY_BASE = "https://app.gis-div.com/PZO/Content/GambarProxy.ashx?url=";

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Origin': 'https://app.gis-div.com',
                'Referer': 'https://app.gis-div.com/'
            },
            body: JSON.stringify({
                pt: String(ptName),
                weekId: String(weekId)
            })
        });

        if (!response.ok) {
            throw new Error(`External API responded with status ${response.status}`);
        }

        const json = await response.json();
        const rawList = json.d || [];

        // Parse each item in the raw list (they are JSON strings)
        const data = rawList.map(item => {
            try {
                return JSON.parse(item);
            } catch (e) {
                return null;
            }
        });

        if (data.length < 10) {
            throw new Error('Incomplete data received from external service.');
        }

        const processMapUrl = (rawUrl) => {
            if (!rawUrl) return '';
            return PROXY_BASE + encodeURIComponent(rawUrl);
        };

        const result = {
            w1: {
                legend: data[0],
                meta: data[2] ? data[2][0] : null,
                imgUrl: data[3] ? processMapUrl(data[3][0]?.urlGeoAndika) : '',
                stats: data[8]
            },
            w2: {
                legend: data[4],
                meta: data[6] ? data[6][0] : null,
                imgUrl: data[7] ? processMapUrl(data[7][0]?.urlGeoAndika) : '',
                stats: data[9]
            }
        };

        return NextResponse.json({ data: result });

    } catch (error) {
        console.error('[Daily Report API Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
