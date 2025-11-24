# Git Repository Manager.

A Dockerized web application that monitors and manages git repositories, providing a professional web interface to view repository status, branches, and perform git pull operations.

**Docker Image**: Available on Docker Hub - `your-username/git-repo-manager:latest` (see Publishing section)

## Features

- **Repository Scanning**: Automatically discovers all git repositories in the configured directory
- **Status Detection**: Shows if repositories are behind, ahead, up-to-date, or diverged from remote
- **Branch Information**: Displays local and remote branches for each repository
- **Individual Updates**: Pull updates for specific repositories with a single click
- **Bulk Updates**: Update all repositories at once
- **Auto-refresh**: Optional automatic refresh of repository status
- **Scheduled Updates**: Configure automatic updates on a schedule (daily, weekly, or custom cron)
- **Activity Logging**: Track all git operations with timestamps and status
- **Repository Grouping**: Organize repositories into groups and add tags
- **Statistics Dashboard**: View overview metrics and repository health
- **Settings Page**: Configure git repository path and other application settings
- **Dark Mode**: Toggle between light and dark themes
- **Modern UI**: Clean, responsive web interface built with Tailwind CSS

## Requirements

- Docker and Docker Compose
- Git repositories located in `~/git/*` directory

## Quick Start

### Option 1: Using Pre-built Docker Image (Recommended)

1. **Pull and run the Docker image**:
   ```bash
   docker pull your-username/git-repo-manager:latest
   docker run -d \
     --name git-repo-manager \
     -p 5010:5010 \
     -v ~/git:/git \
     -v $(pwd)/data:/app/data \
     -e HOST_GIT_PATH=~/git \
     your-username/git-repo-manager:latest
   ```

   Or use docker-compose with the published image:
   ```bash
   # Edit docker-compose.pull.yml and replace 'your-username' with your Docker Hub username
   docker-compose -f docker-compose.pull.yml up -d
   ```

2. **Access the web interface**:
   Open your browser and navigate to `http://localhost:5010`

### Option 2: Build from Source

1. **Build and run with Docker Compose**:
   ```bash
   cd ~/Git/Web-Repo
   docker-compose up --build
   ```

2. **Access the web interface**:
   Open your browser and navigate to `http://localhost:5010`

## Usage

### Web Interface

The web interface provides:

- **Repository Cards**: Each repository is displayed in a card showing:
  - Repository name
  - Current branch
  - Status indicator (behind/ahead/up-to-date/diverged)
  - Remote URL
  - Last commit information
  - Local and remote branches (collapsible)
  - Update button

- **Header Controls**:
  - **Dark Mode Toggle**: Switch between light and dark themes
  - **Auto-refresh Toggle**: Enable/disable automatic refresh (default: 30 seconds)
  - **Refresh Button**: Manually refresh repository status
  - **Stats Button**: View statistics dashboard
  - **Update All Button**: Pull updates for all repositories at once
  - **Schedules Button**: Manage automatic update schedules
  - **Activity Button**: View activity log
  - **Settings Button**: Configure application settings (including git repository path)

### Status Indicators

- 🟢 **Up to date**: Local and remote are in sync
- 🟠 **Behind**: Local branch is behind remote (commits to pull)
- 🔵 **Ahead**: Local branch has unpushed commits
- 🔴 **Diverged**: Local and remote have diverged
- ⚪ **No remote**: Repository has no remote configured

## Docker Configuration

### Volume Mounting

The container mounts two volumes:

1. **Git Repositories**: `~/git` from your host to `/git` in the container with read-write access. This allows the application to scan, access, and update your git repositories (git pull operations require write access).

   **Note**: You can change the git repository path in the Settings page. If your repositories are in a different location, update the volume mount in `docker-compose.yml` and then configure the path in Settings.

2. **Persistent Data**: `./data` from the project directory to `/app/data` in the container. This stores:
   - Settings (`settings.json`)
   - Schedules configuration (`schedules.json`)
   - Activity logs (`activity_log.json`)
   - Repository groups and tags (`repo_groups.json`)

**Important**: The `data/` directory persists across container restarts, so your settings, schedules, activity history, and repository groups will be preserved.

### Configuring Git Repository Path

By default, the application looks for repositories at `/git` (which maps to `~/git` on your host). To use a different location on your host machine:

**Option 1: Using Environment Variable (Recommended)**

1. Create a `.env` file in the project directory:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set your host git path:
   ```
   HOST_GIT_PATH=/path/to/your/git/repos
   ```
   Examples:
   - `HOST_GIT_PATH=~/git`
   - `HOST_GIT_PATH=/Users/username/projects`
   - `HOST_GIT_PATH=/home/user/repos`

3. Restart the container:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

**Option 2: Using Settings Page**

1. Click the **Settings** button in the web interface
2. Update the "Host Git Repository Path" field with your host path
3. **Important**: After saving, you must update the `HOST_GIT_PATH` environment variable in your `.env` file or `docker-compose.yml` and restart the container for the change to take effect

**Option 3: Direct docker-compose.yml Edit**

Edit `docker-compose.yml` and change the volume mount:
```yaml
volumes:
  - /your/host/path:/git
```

Then restart: `docker-compose up -d`

### Permissions

The container runs as a non-root user (`appuser`) for security. If you encounter permission issues, you may need to adjust file permissions on your git repositories.

### SSH Keys (for private repositories)

**SSH keys are now automatically mounted** in the default `docker-compose.yml` configuration. This allows the container to authenticate with private git repositories using your host's SSH keys.

If you're using `docker-compose.pull.yml` or a custom setup, ensure these volumes are mounted:

```yaml
volumes:
  - ~/.ssh:/home/appuser/.ssh:ro
  - ~/.gitconfig:/home/appuser/.gitconfig:ro
```

**Important**: Ensure your SSH keys have the correct permissions on the host:

```bash
# Check and fix SSH key permissions
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_rsa          # or id_ed25519, etc.
chmod 644 ~/.ssh/id_rsa.pub      # or id_ed25519.pub, etc.
chmod 644 ~/.ssh/known_hosts
```

**Troubleshooting SSH Authentication**:

If you get "exit code 128" or "could not read from remote repository" errors:

1. **Verify SSH keys are mounted**: Check container logs or exec into the container:
   ```bash
   docker exec -it git-repo-manager ls -la /home/appuser/.ssh
   ```

2. **Test SSH connection from container**:
   ```bash
   docker exec -it git-repo-manager ssh -T git@github.com
   ```

3. **Check SSH key permissions on host** (must be 600 for private keys)

4. **Verify git remote URLs**: Ensure your repos use SSH URLs (`git@github.com:user/repo.git`) not HTTPS URLs

## API Endpoints

The application provides a REST API:

- `GET /api/health` - Health check
- `GET /api/repos` - List all repositories with status
- `GET /api/repos/<name>/status` - Get detailed status for a repository
- `POST /api/repos/<name>/pull` - Pull updates for a specific repository
- `POST /api/repos/pull-all` - Pull updates for all repositories

## Development

### Running Locally (without Docker)

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Set environment variable:
   ```bash
   export GIT_BASE_PATH=/path/to/your/git/repos
   ```

3. Run the application:
   ```bash
   python -m app.main
   ```

### Project Structure

```
~/Git/Web-Repo/
├── Dockerfile              # Docker image definition
├── docker-compose.yml      # Docker Compose configuration
├── requirements.txt        # Python dependencies
├── README.md              # This file
├── data/                  # Persistent data directory (mounted as volume)
│   ├── settings.json      # Application settings (git path, etc.)
│   ├── schedules.json     # Scheduled update configurations
│   ├── activity_log.json  # Activity history
│   └── repo_groups.json   # Repository groups and tags
├── app/
│   ├── __init__.py
│   ├── main.py            # Flask application entry point
│   ├── git_scanner.py     # Repository scanning logic
│   ├── git_operations.py  # Git pull operations
│   ├── scheduler.py       # Scheduled update manager
│   ├── activity_log.py    # Activity logging
│   └── repo_groups.py     # Repository grouping and tagging
├── static/
│   ├── css/
│   │   └── style.css      # Custom styles
│   └── js/
│       └── app.js         # Frontend JavaScript
└── templates/
    └── index.html         # Main web interface
```

## Troubleshooting

### Repositories not showing up

- Verify that repositories are in `~/git/*` directory
- Check that each repository has a `.git` folder
- Ensure Docker volume mount is correct in `docker-compose.yml`

### Git pull fails

- Check if repository has a remote configured
- For private repos, ensure SSH keys are mounted (see SSH Keys section)
- Verify network connectivity
- Check Docker logs: `docker-compose logs git-repo-manager`

### Permission errors

- Ensure git repositories are readable by the container
- If using SSH keys, verify key permissions (should be 600)
- Check that the mounted volume has correct permissions

### Port already in use

If port 5010 is already in use, modify `docker-compose.yml`:

```yaml
ports:
  - "8080:5010"  # Use port 8080 on host instead
```

## Security Considerations

- The container runs as a non-root user
- Git repositories are mounted read-only by default
- SSH keys are optional and should only be mounted if needed
- The application only performs `git pull` operations (no push/delete)

## Publishing Docker Image

To publish this image to Docker Hub (or another container registry):

### Quick Publish

1. **Build and push using the provided script**:
   ```bash
   ./build-and-push.sh your-username 1.0.0 --push
   ```

### Manual Steps

1. **Build the image**:
   ```bash
   docker build -t your-username/git-repo-manager:latest .
   ```

2. **Tag with version** (optional):
   ```bash
   docker tag your-username/git-repo-manager:latest your-username/git-repo-manager:1.0.0
   ```

3. **Login to Docker Hub**:
   ```bash
   docker login
   ```

4. **Push the image**:
   ```bash
   docker push your-username/git-repo-manager:latest
   docker push your-username/git-repo-manager:1.0.0
   ```

### Using the Published Image

Once published, others can pull and use your image:

```bash
docker pull your-username/git-repo-manager:latest
docker run -d \
  --name git-repo-manager \
  -p 5010:5010 \
  -v ~/git:/git \
  -v $(pwd)/data:/app/data \
  your-username/git-repo-manager:latest
```

Or use the provided `docker-compose.pull.yml` file (after updating the image name).

For detailed publishing instructions, see [DOCKER.md](DOCKER.md).

## License

This project is provided as-is for personal use.

## Contributing

Feel free to submit issues or pull requests for improvements.

