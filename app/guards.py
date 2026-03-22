"""Route guards (read-only mode, etc.)."""
from flask import jsonify


def read_only_response():
    return jsonify({
        "success": False,
        "error": "Read-only mode is enabled. Pull (merge/rebase) and scheduled pulls are disabled; fetch-only is still allowed.",
        "code": "read_only",
    }), 403


def is_read_only(settings_get) -> bool:
    return bool(settings_get("read_only", False))
