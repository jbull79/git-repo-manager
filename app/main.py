"""Flask application entry point."""
import os
from flask import Flask
from app.services import init_services, APP_VERSION
from app.routes import register_routes
from app.auth import check_api_key, unauthorized_response

# Parent of app/ (repo root)
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DATA_DIR = os.environ.get("WEB_REPO_DATA_DIR", "/app/data")
try:
    os.makedirs(DATA_DIR, exist_ok=True)
except OSError:
    pass

init_services(DATA_DIR)

app = Flask(
    __name__,
    template_folder=os.path.join(base_dir, 'templates'),
    static_folder=os.path.join(base_dir, 'static'),
)
app.config['JSONIFY_PRETTYPRINT_REGULAR'] = True

register_routes(app)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5010, debug=True)
