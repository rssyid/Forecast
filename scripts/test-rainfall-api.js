async function test() {
    const API_URL = "https://app.gis-div.com/iot/Service/webservice.asmx/GetArsStation4WeeksRequest";
    
    const variations = [
        { 
            name: "Original (Lowercase, rain as string)",
            payload: { companycode: "PT.THIP", endingdate: "2026-04-24", arsiran: "7" }
        },
        { 
            name: "Arsiran as Number (Integer 7)",
            payload: { companycode: "PT.THIP", endingdate: "2026-04-24", arsiran: 7 }
        },
        { 
            name: "No PT prefix (THIP only)",
            payload: { companycode: "THIP", endingdate: "2026-04-24", arsiran: "7" }
        },
        { 
            name: "Date with slashes (YYYY/MM/DD)",
            payload: { companycode: "PT.THIP", endingdate: "2026/04/24", arsiran: "7" }
        },
        { 
            name: "PascalCase + Number Arsiran",
            payload: { CompanyCode: "PT.THIP", EndingDate: "2026-04-24", Arsiran: 7 }
        }
    ];

    for (const v of variations) {
        console.log(`--- Testing: ${v.name} ---`);
        try {
            const urls = [
                API_URL,
                API_URL.replace("Request", "") // Mencoba tanpa suffix Request
            ];

            for (const url of urls) {
                console.log(`  Trying URL: ${url}`);
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json; charset=utf-8',
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://app.gis-div.com/',
                        'Origin': 'https://app.gis-div.com'
                    },
                    body: JSON.stringify(v.payload)
                });
                
                console.log("  Status:", response.status);
                if (response.status === 200) {
                    console.log("  ✅ SUCCESS with URL:", url);
                    const json = await response.json();
                    console.log("  Data sample:", JSON.stringify(json).slice(0, 200));
                    return;
                }
            }
        } catch (err) {
            console.error("  Fetch Error:", err.message);
        }
        console.log("\n");
        await new Promise(r => setTimeout(r, 500));
    }
}

test();
