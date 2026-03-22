"""Helpers for remote URLs and display."""
import re
from typing import Optional


def remote_url_to_web(url: Optional[str]) -> Optional[str]:
    """Best-effort HTTPS URL to open a repo in the browser (GitHub, GitLab, Bitbucket, etc.)."""
    if not url or not isinstance(url, str):
        return None
    url = url.strip()
    if not url:
        return None
    # Already a web URL
    if url.startswith("https://"):
        return re.sub(r"\.git$", "", url).rstrip("/")
    if url.startswith("http://"):
        return re.sub(r"\.git$", "", url).rstrip("/")
    # git@host:path.git
    m = re.match(r"git@([^:]+):(.+?)(?:\.git)?$", url)
    if m:
        host, path = m.group(1), m.group(2)
        if "github.com" in host:
            return f"https://github.com/{path}"
        if "gitlab" in host:
            return f"https://{host}/{path}"
        if "bitbucket.org" in host:
            return f"https://bitbucket.org/{path}"
        return f"https://{host}/{path}"
    # ssh://git@github.com/user/repo.git
    m = re.match(r"ssh://(?:git@)?([^/]+)/(.+?)(?:\.git)?$", url)
    if m:
        host, path = m.group(1), m.group(2)
        return f"https://{host}/{path}"
    return None
