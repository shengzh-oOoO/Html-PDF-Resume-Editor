#!/usr/bin/env python3
"""Local resume editor server.

Serves the static app and provides a tiny same-origin persistence API so edits
and uploaded photos can be written into this project instead of only living in
browser localStorage.

    GET  /api/health  -> {"ok": true, ...}
    GET  /api/state   -> data/resume.json
    POST /api/state   -> atomically writes data/resume.json and saves the photo
                         under assets/uploads/ when the payload has a data URL.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import sys
import tempfile
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("PAPERCV_DATA_DIR", ROOT / "data")).resolve()
UPLOAD_DIR = Path(os.environ.get("PAPERCV_UPLOAD_DIR", ROOT / "assets" / "uploads")).resolve()
STATE_FILE = DATA_DIR / "resume.json"
MAX_BODY = 12 * 1024 * 1024  # 12 MB: enough for a compressed portrait + resume JSON
MAX_PHOTO = 8 * 1024 * 1024
DATA_URL_RE = re.compile(r"^data:image/(jpeg|jpg|png|webp);base64,(.+)$", re.IGNORECASE | re.DOTALL)
EXTENSIONS = {"jpeg": "jpg", "jpg": "jpg", "png": "png", "webp": "webp"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def remove_old_photos(keep: Path | None = None) -> None:
    ensure_dirs()
    for old in UPLOAD_DIR.glob("resume-photo-*"):
        if old.is_file() and (keep is None or old != keep):
            try:
                old.unlink()
            except OSError:
                pass


def save_photo(data_url: str) -> str:
    """Decode a data URL, save it with a content hash, and return its path."""
    match = DATA_URL_RE.match(data_url)
    if not match:
        raise ValueError("unsupported image data URL")
    kind = match.group(1).lower()
    try:
        raw = base64.b64decode(match.group(2), validate=True)
    except Exception as exc:  # noqa: BLE001 - report a clean API error
        raise ValueError("invalid image data") from exc
    if not raw or len(raw) > MAX_PHOTO:
        raise ValueError("image is too large")
    ensure_dirs()
    digest = hashlib.sha1(raw).hexdigest()[:12]
    filename = f"resume-photo-{digest}.{EXTENSIONS[kind]}"
    target = UPLOAD_DIR / filename
    if not target.exists():
        target.write_bytes(raw)
    remove_old_photos(keep=target)
    # Paths in the JSON are relative to the project root so the static server
    # can resolve them, including after a clone/move.
    return "assets/uploads/" + filename


def save_state(raw: dict) -> dict:
    if not isinstance(raw, dict):
        raise ValueError("state must be a JSON object")
    basics = raw.get("basics")
    if not isinstance(basics, dict):
        basics = {}
        raw["basics"] = basics

    photo = basics.get("photo") or ""
    photo_path = basics.get("photoPath") or ""
    if isinstance(photo, str) and photo.startswith("data:image/"):
        resolved = save_photo(photo)
        basics["photo"] = resolved
        basics["photoPath"] = resolved
    elif isinstance(photo, str) and photo.startswith("assets/uploads/"):
        basics["photoPath"] = photo
        candidate = (ROOT / photo).resolve()
        if candidate.is_file():
            remove_old_photos(keep=candidate)
    elif photo_path:
        basics["photoPath"] = str(photo_path)
    else:
        basics["photoPath"] = ""
        remove_old_photos(keep=None)

    raw["version"] = 1
    raw["savedAt"] = utc_now()
    ensure_dirs()
    payload = json.dumps(raw, ensure_ascii=False, indent=2) + "\n"
    fd, temp_name = tempfile.mkstemp(prefix=".resume-", suffix=".json", dir=DATA_DIR)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, STATE_FILE)
    finally:
        try:
            if os.path.exists(temp_name):
                os.unlink(temp_name)
        except OSError:
            pass
    return {"ok": True, "savedAt": raw["savedAt"], "photo": basics.get("photoPath", "")}


class Handler(SimpleHTTPRequestHandler):
    server_version = "PaperCVLocal/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 - stdlib callback name
        path = self.path.split("?", 1)[0]
        # Never expose the saved personal state or dotfiles such as .git.
        if path == "/data" or path.startswith("/data/"):
            self._json(404, {"ok": False, "reason": "not-found"})
            return
        if any(part.startswith(".") for part in path.split("/") if part):
            self._json(404, {"ok": False, "reason": "not-found"})
            return
        if path == "/api/health":
            self._json(200, {"ok": True, "app": "papercv", "state": STATE_FILE.exists()})
            return
        if path == "/api/state":
            if not STATE_FILE.exists():
                self._json(404, {"ok": False, "reason": "no-local-state"})
                return
            try:
                raw = STATE_FILE.read_text(encoding="utf-8")
                data = json.loads(raw)
                self._json(200, data)
            except Exception as exc:  # noqa: BLE001
                self._json(500, {"ok": False, "reason": "state-read-failed", "message": str(exc)})
            return
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802 - stdlib callback name
        if self.path.split("?", 1)[0] != "/api/state":
            self._json(404, {"ok": False, "reason": "not-found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._json(400, {"ok": False, "reason": "bad-content-length"})
            return
        if length <= 0 or length > MAX_BODY:
            self._json(413, {"ok": False, "reason": "body-too-large"})
            return
        try:
            raw = json.loads(self.rfile.read(length).decode("utf-8"))
            result = save_state(raw)
        except ValueError as exc:
            self._json(400, {"ok": False, "reason": str(exc)})
            return
        except Exception as exc:  # noqa: BLE001
            self._json(500, {"ok": False, "reason": "state-write-failed", "message": str(exc)})
            return
        self._json(200, result)

    def end_headers(self) -> None:
        # Keep the app shell fresh while developing; the static assets carry
        # explicit version query strings in index.html.
        if self.path.split("?", 1)[0] in ("/", "/index.html"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()


def parse_port() -> int:
    if len(sys.argv) > 1:
        try:
            return int(sys.argv[1])
        except ValueError:
            print(f"Invalid port: {sys.argv[1]}", file=sys.stderr)
            raise SystemExit(2)
    return 4173


def main() -> None:
    ensure_dirs()
    port = parse_port()
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.daemon_threads = True
    print("纸间 Resume Studio · 本地文件同步")
    print(f"  http://127.0.0.1:{port}/")
    print(f"  数据文件: {STATE_FILE}")
    print(f"  图片目录: {UPLOAD_DIR}")
    print("  按 Ctrl+C 停止服务。\n", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已停止。")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
