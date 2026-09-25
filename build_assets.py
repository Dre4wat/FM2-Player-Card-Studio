"""Fetch FM2 image assets for a same-origin GitHub Pages PNG export."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
import json
import os
from pathlib import Path
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from PIL import Image

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / 'assets'
API = 'https://neonsportz.com/api/leagues/FM2'
SOURCES = {
    'portrait': 'https://ratings-images-prod.pulse.ea.com/madden-nfl-27/portraits/{}.png',
    'team': 'https://cdn.neonsportz.com/teamlogos/256/{}.png',
    'dev': 'https://cdn.neonsportz.com/devtraits/{}.png',
}

def get(url):
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={'User-Agent': 'FM2-Player-Card-Studio/1.0', 'Accept': '*/*'}), timeout=25) as response:
                return response.read()
        except (HTTPError, URLError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(1.5 * (attempt + 1))

def images_to_fetch():
    first = json.loads(get(f'{API}/players/?size=100&page=1'))
    count = first['count']
    pages = (count + 99) // 100
    players = list(first['results'])
    # Limit page concurrency so the league API isn't flooded.
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = [pool.submit(get, f'{API}/players/?size=100&page={page}') for page in range(2, pages + 1)]
        for future in as_completed(futures):
            players += json.loads(future.result())['results']
    if len(players) < count:
        raise RuntimeError(f'Incomplete FM2 player snapshot: {len(players)} of {count}')
    teams = json.loads(get(f'{API}/teams/?size=100'))
    teams = teams['results'] if isinstance(teams, dict) else teams
    return (
        {('portrait', str(p['portraitId'])) for p in players if p.get('portraitId') is not None}
        | {('team', str(t['logoId'])) for t in teams if t.get('logoId') is not None}
        | {('dev', str(n)) for n in range(4)}
    )

def save_asset(item):
    kind, id_ = item
    dest = ASSETS / kind / f'{id_}.webp'
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        return True
    try:
        raw = get(SOURCES[kind].format(id_))
        with Image.open(BytesIO(raw)) as image:
            image.save(dest, 'WEBP', quality=79, method=5)
        return True
    except (HTTPError, URLError, TimeoutError, OSError) as error:
        print(f'Missing {kind} {id_}: {error}', flush=True)
        return False

if __name__ == '__main__':
    items = sorted(images_to_fetch())
    print(f'Collecting {len(items)} FM2 images', flush=True)
    with ThreadPoolExecutor(max_workers=12) as pool:
        complete = sum(pool.map(save_asset, items))
    print(f'Saved {complete} / {len(items)} images', flush=True)
    if complete < len(items) * 0.9:
        raise SystemExit('Too many headshots were unavailable; Pages was not deployed.')
