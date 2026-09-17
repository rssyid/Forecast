export async function POST(request) {
    try {
        const body = await request.json();
        const { date } = body;

        if (!date) {
            return Response.json({ error: 'Date is required' }, { status: 400 });
        }

        if (!process.env.GITHUB_PAT) {
            return Response.json({ error: 'GITHUB_PAT environment variable is not configured' }, { status: 500 });
        }

        const githubResponse = await fetch(
            'https://api.github.com/repos/rssyid/Forecast/actions/workflows/ecmwf-download.yml/dispatches',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.GITHUB_PAT}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                    'User-Agent': 'Forecast-App',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ref: 'main',
                    inputs: {
                        forecast_date: date
                    }
                })
            }
        );

        if (githubResponse.status === 204) {
            return Response.json({ triggered: true, date });
        }

        const errorText = await githubResponse.text();
        return Response.json(
            {
                error: `GitHub API error: ${githubResponse.statusText || 'Failed to trigger workflow'}`,
                details: errorText
            },
            { status: githubResponse.status }
        );
    } catch (err) {
        console.error('Error in POST /api/ecmwf-forecast/trigger:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
