import os
import sys
import json
import argparse
import tempfile
import time
import warnings
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import xarray as xr
import geopandas as gpd
from shapely.geometry import box as shapely_box
from ecmwf.opendata import Client
import requests

# Suppress warnings
warnings.filterwarnings('ignore')

# Fixed configuration
EXTENT = [89, 142, -16, 28]  # [lon_min, lon_max, lat_min, lat_max]
STEP = 162
MODEL = 'aifs-single'
PARAM = ['tp']
MASK_THRESHOLD = 0.1

LEVELS = [0.1, 1, 2, 5, 10, 15, 20, 30, 40, 50, 100, 300, 1000]
COLORS = [
    "#e6d7b6", "#a8e89a", "#72e467", "#addbe6", "#78addf", "#4e92df",
    "#2f6ee8", "#e9d96c", "#f7a600", "#ff0d0d", "#a32323", "#ef23ff"
]
CATEGORY_LABELS = [
    "0.1-1", "1-2", "2-5", "5-10", "10-15", "15-20",
    "20-30", "30-40", "40-50", "50-100", "100-300", "300-1000+"
]

def log(msg):
    """Print progress logs to stderr"""
    print(msg, file=sys.stderr, flush=True)

def get_last_wednesday():
    """Get the most recent Wednesday date"""
    today = datetime.utcnow().date()
    days_since_wed = (today.weekday() - 2) % 7
    return today - timedelta(days=days_since_wed)

def centers_to_edges(values):
    values = np.asarray(values, dtype=float)
    mids = (values[:-1] + values[1:]) / 2.0
    first = values[0] - (mids[0] - values[0])
    last = values[-1] + (values[-1] - mids[-1])
    return np.concatenate(([first], mids, [last]))

def categorize_tp(values):
    bins = LEVELS[:-1] + [np.inf]
    cat = pd.cut(values, bins=bins, labels=CATEGORY_LABELS, right=False, include_lowest=True)
    return cat.astype(str), cat.cat.codes + 1

def main():
    parser = argparse.ArgumentParser(description='Download ECMWF AIFS forecast and convert to GeoJSON')
    parser.add_argument('--date', type=str, help='Forecast date (YYYY-MM-DD), must be Wednesday')
    parser.add_argument('--output', type=str, default='', help='Path to save output GeoJSON file')
    parser.add_argument('--upload', action='store_true', help='Upload directly to Vercel API')
    args = parser.parse_args()

    if args.date:
        forecast_date = datetime.strptime(args.date, '%Y-%m-%d').date()
    else:
        forecast_date = get_last_wednesday()

    log(f'Forecast date: {forecast_date}')
    log(f'Day of week: {forecast_date.strftime("%A")}')

    start_time = time.time()

    # Download GRIB
    with tempfile.TemporaryDirectory() as tmpdir:
        target_grib = os.path.join(tmpdir, 'aifs_tp.grib2')
        
        log('Downloading GRIB from ECMWF...')
        client = Client(source='ecmwf', beta=False)
        
        request = {
            'step': STEP,
            'stream': 'oper',
            'type': 'fc',
            'levtype': 'sfc',
            'model': MODEL,
            'param': PARAM,
            'target': target_grib,
            'date': str(forecast_date),
            'time': 0,
        }
        
        try:
            client.retrieve(**request)
        except Exception as e:
            log(f'Error downloading specific date: {e}')
            log('Retrying with latest available ECMWF operational data...')
            del request['date']
            client.retrieve(**request)
        
        log(f'GRIB downloaded: {target_grib}')

        # Read with xarray
        log('Reading GRIB data...')
        ds = xr.open_dataset(target_grib, engine='cfgrib', backend_kwargs={'indexpath': ''})
        tp = ds['tp']

        # Standardize longitude
        if float(tp.longitude.max()) > 180:
            tp = tp.assign_coords(longitude=((tp.longitude + 180) % 360) - 180).sortby('longitude')
        if tp.latitude.values[0] < tp.latitude.values[-1]:
            tp = tp.sortby('latitude', ascending=False)

        # Convert m to mm if needed
        units = str(tp.attrs.get('GRIB_units', tp.attrs.get('units', ''))).strip().lower()
        if units in {'m', 'meter', 'metre', 'm of water equivalent'}:
            tp = tp * 1000.0

        # Clip to extent
        lon_min, lon_max, lat_min, lat_max = EXTENT
        lat_slice = slice(lat_max, lat_min) if float(tp.latitude.values[0]) > float(tp.latitude.values[-1]) else slice(lat_min, lat_max)
        subset = tp.sel(longitude=slice(lon_min, lon_max), latitude=lat_slice)

        lon = subset.longitude.values
        lat = subset.latitude.values
        arr = subset.values
        lon_edges = centers_to_edges(lon)
        lat_edges = centers_to_edges(lat)
        extent_poly = shapely_box(lon_min, lat_min, lon_max, lat_max)

        # Convert grid to polygons
        log('Converting grid to polygons...')
        rows = []
        geoms = []

        for i in range(arr.shape[0]):
            for j in range(arr.shape[1]):
                val = arr[i, j]
                if np.isnan(val) or val < MASK_THRESHOLD:
                    continue
                x0, x1 = sorted([lon_edges[j], lon_edges[j + 1]])
                y0, y1 = sorted([lat_edges[i], lat_edges[i + 1]])
                geom = shapely_box(x0, y0, x1, y1).intersection(extent_poly)
                if not geom.is_empty:
                    geoms.append(geom)
                    rows.append({'tp_mm': round(float(val), 2)})

        if not rows:
            log('ERROR: No valid precipitation data found above threshold')
            sys.exit(1)

        log(f'Found {len(rows)} grid cells with precipitation')

        # Create GeoDataFrame and categorize
        df = pd.DataFrame(rows)
        df['cat_lbl'], df['cat_code'] = categorize_tp(df['tp_mm'])

        lbl_to_min = {lbl: low for lbl, low in zip(CATEGORY_LABELS, LEVELS[:-1])}
        lbl_to_color = {lbl: col for lbl, col in zip(CATEGORY_LABELS, COLORS)}
        df['min_mm'] = df['cat_lbl'].map(lbl_to_min).astype(float)
        df['color'] = df['cat_lbl'].map(lbl_to_color)

        gdf = gpd.GeoDataFrame(df, geometry=geoms, crs='EPSG:4326')

        # Dissolve by category
        log('Dissolving polygons by category...')
        dissolved = gdf.dissolve(
            by='cat_lbl', as_index=False,
            aggfunc={'cat_code': 'first', 'min_mm': 'first', 'color': 'first'}
        )

        elapsed = round(time.time() - start_time, 1)
        feature_count = len(dissolved)
        log(f'Processing complete in {elapsed}s. Features: {feature_count}')

        # Convert to python dict directly (avoids any string encoding / JSON escaping issues)
        geojson_dict = json.loads(dissolved.to_json())

        # Save to file if requested
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(geojson_dict, f)
            log(f'GeoJSON saved to file: {args.output}')

        # Direct upload to Vercel API if requested or env vars exist
        vercel_url = os.environ.get('VERCEL_APP_URL', '').rstrip('/')
        api_secret = os.environ.get('ECMWF_API_SECRET', '')

        if args.upload or (vercel_url and api_secret):
            if not vercel_url or not api_secret:
                log('ERROR: VERCEL_APP_URL and ECMWF_API_SECRET must be set for upload')
                sys.exit(1)

            upload_url = f'{vercel_url}/api/ecmwf-forecast'
            log(f'Uploading data directly to: {upload_url}')
            
            payload = {
                'date': str(forecast_date),
                'geojson': geojson_dict,
                'processing_time_sec': elapsed
            }

            headers = {
                'Content-Type': 'application/json',
                'x-api-key': api_secret
            }

            resp = requests.post(upload_url, json=payload, headers=headers, timeout=60)
            log(f'Vercel API Response Code: {resp.status_code}')
            log(f'Vercel API Response Body: {resp.text}')

            if resp.status_code != 200:
                log(f'ERROR: Upload failed with status {resp.status_code}: {resp.text}')
                sys.exit(1)
            
            log(f'SUCCESS: Forecast data for {forecast_date} successfully uploaded to DB!')
        else:
            # Print to stdout if not uploaded
            print(json.dumps(geojson_dict))

if __name__ == '__main__':
    main()
