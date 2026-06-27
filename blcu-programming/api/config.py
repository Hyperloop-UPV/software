import json
from pathlib import Path

_ROOT = Path(__file__).parent.parent
_CONFIG_PATH = _ROOT / "BLCU-config.json"


def load() -> dict:
    with _CONFIG_PATH.open(encoding="utf-8") as f:
        return json.load(f)
