export const PROXY_BASE = "https://app.gis-div.com/PZO/Content/GambarProxy.ashx?url=";

function isJjpCompany(ptName) {
    const normalized = String(ptName || '').trim().toUpperCase();
    return normalized === 'PT.JJP' || normalized === 'JJP';
}

export function normalizeDailyMapRawUrl(rawUrl, ptName) {
    if (!rawUrl) return '';
    if (!isJjpCompany(ptName)) return rawUrl;

    const queryIndex = rawUrl.indexOf('?');
    if (queryIndex === -1) return rawUrl;

    const baseUrl = rawUrl.slice(0, queryIndex);
    const queryString = rawUrl.slice(queryIndex + 1);

    const updatedParams = queryString
        .split('&')
        .filter((segment) => {
            const [key] = segment.split('=');
            return key.toUpperCase() !== 'CQL_FILTER';
        })
        .map((segment) => {
            const eqIndex = segment.indexOf('=');
            if (eqIndex === -1) return segment;

            const key = segment.slice(0, eqIndex);
            const value = segment.slice(eqIndex + 1);

            if (key.toLowerCase() === 'layers') {
                return `${key}=${value.replace(
                    /pub_pzo(%3A|:)PZO_Pemantauan_PT/i,
                    'pub_pzo%3Atemp_pzo_layout'
                )}`;
            }

            if (key.toLowerCase() === 'viewparams') {
                const cleanedViewParams = value
                    .split(';')
                    .filter((part) => !/^company:/i.test(part))
                    .join(';');
                return `${key}=${cleanedViewParams}`;
            }

            return segment;
        });

    return `${baseUrl}?${updatedParams.join('&')}`;
}

export function buildDailyMapUrl(rawUrl, ptName) {
    if (!rawUrl) return '';
    return PROXY_BASE + encodeURIComponent(normalizeDailyMapRawUrl(rawUrl, ptName));
}
