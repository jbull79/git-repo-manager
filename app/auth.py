"""Optional API key authentication for HTTP API routes."""
import os
from flask import request, jsonify


def get_configured_api_key() -> str:
    """Return API key from env if set (empty string means auth disabled)."""
    return (os.getenv("WEB_REPO_API_KEY") or "").strip()


def api_key_required() -> bool:
    return bool(get_configured_api_key())


def check_api_key() -> bool:
    """Return True if request is authorized or auth is disabled."""
    expected = get_configured_api_key()
    if not expected:
        return True

    header = request.headers.get("X-API-Key", "").strip()
    if header and header == expected:
        return True

    auth = request.headers.get("Authorization", "").strip()
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
        if token == expected:
            return True

    return False


def unauthorized_response():
    return jsonify({
        "success": False,
        "error": "Unauthorized. Provide X-API-Key or Authorization: Bearer <key>."
    }), 401
