# Git Repository Manager - Architecture Overview

## 🏗️ Project Structure

```
Web-Repo/
├── 📁 app/                          # Backend Python Application
│   ├── main.py                     # Flask app & API routes (1058 lines)
│   ├── git_scanner.py              # Repository discovery & status detection
│   ├── git_operations.py           # Git pull operations (merge/rebase/reset)
│   ├── scheduler.py                # Scheduled update manager (APScheduler)
│   ├── activity_log.py            # Activity logging & history
│   ├── repo_groups.py              # Repository grouping & tagging
│   ├── settings.py                 # Configuration management
│   └── cache.py                    # Caching layer (TTL-based)
│
├── 📁 templates/                    # Frontend Templates
│   └── index.html                  # Main UI (705 lines, Tailwind CSS)
│
├── 📁 static/                       # Frontend Assets
│   ├── css/
│   │   └── style.css               # Custom styles & animations
│   └── js/
│       └── app.js                  # Frontend logic (2846 lines)
│
├── 📁 data/                         # Persistent Storage (mounted volume)
│   ├── settings.json               # App configuration
│   ├── schedules.json              # Scheduled tasks
│   ├── activity_log.json           # Activity history
│   └── repo_groups.json            # Groups & tags
│
├── 🐳 Docker/
│   ├── Dockerfile                  # Container image definition
│   ├── docker-compose.yml          # Local development setup
│   ├── docker-compose.pull.yml     # Production (pre-built image)
│   └── docker-entrypoint.sh        # Container startup script
│
└── 📄 Configuration Files
    ├── requirements.txt            # Python dependencies
    ├── README.md                   # Documentation
    └── build-and-push.sh           # Docker image publishing script
```

## 🔄 System Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                    Web Browser (Frontend)                     │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  index.html (Tailwind CSS UI)                          │   │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────┐      │   │
│  │  │ Repository │  │ Statistics │  │  Settings    │      │   │
│  │  │   Cards    │  │  Dashboard │  │   Modal      │      │   │
│  │  └────────────┘  └────────────┘  └──────────────┘      │   │
│  │                                                        │   │
│  │  app.js (JavaScript)                                   │   │
│  │  - Auto-refresh logic                                  │   │
│  │  - API calls                                           │   │
│  │  - Modal management                                    │   │
│  │  - Dark mode toggle                                    │   │
│  └────────────────────────────────────────────────────────┘   │
└───────────────────────┬───────────────────────────────────────┘
                        │ HTTP/REST API
┌───────────────────────▼───────────────────────────────────────┐
│              Flask Application (Backend)                      │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  main.py (Flask Routes)                                │   │
│  │  ├── GET  /api/repos              # List repos         │   │
│  │  ├── GET  /api/repos/<name>/status # Repo details      │   │
│  │  ├── POST /api/repos/<name>/pull   # Pull updates      │   │
│  │  ├── POST /api/repos/pull-all      # Bulk update       │   │
│  │  ├── GET  /api/stats               # Statistics        │   │
│  │  ├── GET  /api/activity            # Activity log      │   │
│  │  ├── GET  /api/groups              # Groups            │   │
│  │  ├── GET  /api/schedules           # Schedules         │   │
│  │  └── GET  /api/settings            # Settings          │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐        │
│  │ GitScanner   │  │GitOperations │  │ScheduleMgr    │        │
│  │              │  │              │  │               │        │
│  │ - Find repos │  │ - Pull repos │  │ - Cron jobs   │        │
│  │ - Get status │  │ - Merge/     │  │ - Auto-update │        │
│  │ - Scan batch │  │   Rebase/    │  │               │        │
│  │              │  │   Reset      │  │               │        │
│  └──────┬───────┘  └───────┬──────┘  └───────┬───────┘        │
│         │                  │                 │                │
│  ┌──────▼──────────────────▼─────────────────▼────────┐       │
│  │         CacheManager (TTL-based caching)           │       │
│  └────────────────────────────────────────────────────┘       │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐        │
│  │ActivityLog   │  │ RepoGroups   │  │  Settings     │        │
│  │              │  │              │  │               │        │
│  │ - Log ops    │  │ - Groups     │  │ - Config      │        │
│  │ - History    │  │ - Tags       │  │ - Persist     │        │
│  └──────┬───────┘  └───────┬──────┘  └───────┬───────┘        │
│         │                  │                 │                │
└─────────┼──────────────────┼─────────────────┼────────────────┘
          │                  │                 │
          ▼                  ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Persistent Storage (/app/data)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │activity_log  │  │repo_groups   │  │  settings    │       │
│  │   .json      │  │   .json      │  │   .json      │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                             │
│  ┌──────────────┐                                           │
│  │  schedules   │                                           │
│  │   .json      │                                           │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│              Git Repositories (/git)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │  Repo 1  │  │  Repo 2  │  │  Repo 3  │  │  Repo N  │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## 🧩 Component Details

### Backend Components

#### 1. **main.py** (Flask Application)
- **Purpose**: Main Flask app with all API endpoints
- **Key Features**:
  - RESTful API routes
  - Batch processing support
  - Parallel workers for performance
  - Cache integration
  - Error handling

#### 2. **git_scanner.py**
- **Purpose**: Discover and analyze git repositories
- **Key Methods**:
  - `find_repositories()` - List all repos
  - `get_repo_info()` - Get detailed repo status
  - `scan_all_repos()` - Batch scan with parallel processing
  - `get_commit_history()` - Fetch commit history

#### 3. **git_operations.py**
- **Purpose**: Perform git operations (pull, merge, rebase)
- **Key Features**:
  - Pull strategies: merge, rebase, reset
  - Error handling
  - Activity logging integration
  - Cache invalidation

#### 4. **scheduler.py**
- **Purpose**: Manage scheduled updates
- **Features**:
  - Daily/weekly/custom cron schedules
  - Group-based scheduling
  - APScheduler integration

#### 5. **cache.py**
- **Purpose**: TTL-based caching for performance
- **Features**:
  - Configurable TTL (default: 600s)
  - Cache invalidation
  - Statistics tracking

#### 6. **repo_groups.py**
- **Purpose**: Repository organization
- **Features**:
  - Groups with colors
  - Tags
  - Auto-sync "Behind" and "Diverged" groups

#### 7. **activity_log.py**
- **Purpose**: Track all git operations
- **Features**:
  - Timestamped logs
  - Operation tracking
  - History per repository

#### 8. **settings.py**
- **Purpose**: Configuration management
- **Features**:
  - Persistent settings
  - Default values
  - Reset functionality

### Frontend Components

#### 1. **index.html** (705 lines)
- **Framework**: Tailwind CSS (CDN)
- **Key Sections**:
  - Header with controls
  - Search & filter bar
  - Repository grid
  - Modals (Settings, Stats, Groups, Schedules, Activity)
  - Toast notifications

#### 2. **app.js** (2846 lines)
- **Key Features**:
  - Auto-refresh (30s default)
  - Dark mode toggle
  - Batch loading
  - Modal management
  - API integration
  - Keyboard shortcuts (R = refresh, Esc = close modals)

#### 3. **style.css** (558 lines)
- **Features**:
  - Custom animations
  - Dark mode support
  - Smooth transitions
  - Loading states
  - Responsive design

## 🔌 API Endpoints

### Repository Management
- `GET  /api/repos` - List all repositories
- `GET  /api/repos/batch` - Batch loading
- `GET  /api/repos/list` - Fast repo names list
- `GET  /api/repos/<name>/status` - Detailed repo info
- `POST /api/repos/<name>/pull` - Pull single repo
- `POST /api/repos/pull-all` - Pull all repos
- `POST /api/repos/bulk-pull` - Pull selected repos

### Groups & Tags
- `GET    /api/groups` - List groups
- `POST   /api/groups` - Create group
- `PUT    /api/groups/<id>` - Update group
- `DELETE /api/groups/<id>` - Delete group
- `POST   /api/groups/<id>/pull-all` - Pull group repos
- `GET    /api/tags` - List all tags
- `POST   /api/repos/<name>/tags` - Add tag
- `DELETE /api/repos/<name>/tags/<tag>` - Remove tag

### Scheduling
- `GET    /api/schedules` - List schedules
- `POST   /api/schedules` - Create schedule
- `PUT    /api/schedules/<id>` - Update schedule
- `DELETE /api/schedules/<id>` - Delete schedule

### Other
- `GET  /api/stats` - Statistics dashboard
- `GET  /api/activity` - Activity log
- `GET  /api/settings` - Get settings
- `PUT  /api/settings` - Update settings
- `POST /api/settings/reset` - Reset to defaults
- `POST /api/cache/clear` - Clear cache
- `GET  /api/cache/stats` - Cache statistics
- `GET  /api/health` - Health check

## 🎨 UI Features

### Main Dashboard
- **Repository Cards**: Display status, branches, last commit
- **Status Indicators**: 
  - 🟢 Up to date
  - 🟠 Behind
  - 🔵 Ahead
  - 🔴 Diverged
  - ⚪ No remote

### Controls
- Dark mode toggle
- Auto-refresh toggle
- Manual refresh button
- Statistics dashboard
- Update all button
- Schedules management
- Groups management
- Activity log
- Settings

### Filters & Search
- Search by name
- Filter by status
- Filter by group
- Filter by tag
- Sort options (name, status, date)

### Bulk Operations
- Bulk select repositories
- Bulk update
- Bulk add to group
- Bulk add tags

## 🐳 Docker Architecture

### Container Setup
- **Base Image**: `python:3.11-slim`
- **User**: `appuser` (non-root)
- **Port**: 5010
- **Server**: Gunicorn (2 workers, 120s timeout)

### Volume Mounts
- `~/git:/git` - Git repositories (read-write)
- `./data:/app/data` - Persistent data
- `~/.ssh:/home/appuser/.ssh:ro` - SSH keys (read-only)
- `~/.gitconfig:/home/appuser/.gitconfig:ro` - Git config

### Environment Variables
- `HOST_GIT_PATH` - Host git repository path
- `HOST_SSH_PATH` - Host SSH keys path
- `FLASK_ENV` - Flask environment (production)

## 🔄 Data Flow

### Repository Scanning Flow
```
1. User clicks Refresh or Auto-refresh triggers
   ↓
2. Frontend calls GET /api/repos?force_refresh=true
   ↓
3. Backend checks cache (if not force_refresh)
   ↓
4. GitScanner.scan_all_repos() with parallel workers
   ↓
5. For each repo:
   - Get repo info (branches, status, commits)
   - Check cache
   - Update cache if needed
   ↓
6. RepoGroups syncs "Behind" and "Diverged" groups
   ↓
7. Return JSON response
   ↓
8. Frontend renders repository cards
```

### Pull Operation Flow
```
1. User clicks "Update" on a repo
   ↓
2. If diverged, show strategy modal (merge/rebase/reset)
   ↓
3. Frontend calls POST /api/repos/<name>/pull
   ↓
4. GitOperations.pull_repo() with selected strategy
   ↓
5. ActivityLog records the operation
   ↓
6. Cache invalidated for that repo
   ↓
7. Fresh repo info fetched and returned
   ↓
8. Frontend updates the card
```

## 🚀 Performance Optimizations

1. **Caching**: TTL-based cache (default 600s)
2. **Batch Processing**: Process repos in batches (default 25)
3. **Parallel Workers**: Concurrent git operations (default 10)
4. **Progressive Loading**: Load repos in batches via `/api/repos/batch`
5. **Cache Statistics**: Monitor cache hit/miss rates

## 🔐 Security Features

1. **Non-root User**: Container runs as `appuser`
2. **Read-only Mounts**: SSH keys and gitconfig are read-only
3. **No Push Operations**: Only pull operations allowed
4. **Input Validation**: All API inputs validated

## 📊 Key Metrics

- **Version**: 1.0.3
- **Python**: 3.11
- **Flask**: 3.0.0
- **GitPython**: 3.1.40
- **Gunicorn**: 21.2.0
- **APScheduler**: 3.10.4
- **Lines of Code**: ~5000+ (backend + frontend)

## 🎯 Use Cases

1. **Monitor Multiple Repos**: See status of all repos at a glance
2. **Bulk Updates**: Update all repos with one click
3. **Scheduled Updates**: Automatically pull updates on schedule
4. **Organization**: Group repos and add tags
5. **Activity Tracking**: See history of all git operations
6. **Statistics**: View overview metrics and health

