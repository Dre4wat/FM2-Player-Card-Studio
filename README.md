# FM2 Player Card Studio for GitHub Pages

This is the static GitHub Pages version of the FM2 Player Card Studio. It searches and loads current player and team data from the public NeonSportz FM2 API. Card images are copied into the Pages deployment by `build_assets.py` so the browser can export them to PNG.

The Pages workflow runs on each push and once daily to pick up new headshots. Current player ratings and contracts load directly from NeonSportz on every visit. Keep the Pages deployment source set to **GitHub Actions**. The repository can be named `FM2-Player-Card-Studio` to use `https://dre4wat.github.io/FM2-Player-Card-Studio/`.

For a local preview, run `python -m http.server 8000` from this directory. To include all images locally, install Pillow and run `python build_assets.py` first.

Madden NFL names and imagery belong to EA SPORTS. FM2 league data comes from NeonSportz.
