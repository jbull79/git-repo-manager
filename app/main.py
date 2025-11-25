"""Flask application main entry point."""
import os
from flask import Flask, render_template, jsonify, request
from app.git_scanner import GitScanner
from app.git_operations import GitOperations
from app.scheduler import ScheduleManager
from app.activity_log import ActivityLog
from app.repo_groups import RepoGroups
from app.settings import Settings
from app.cache import CacheManager

# Get the base directory (parent of app/)
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

app = Flask(__name__, 
            template_folder=os.path.join(base_dir, 'templates'),
            static_folder=os.path.join(base_dir, 'static'))
app.config['JSONIFY_PRETTYPRINT_REGULAR'] = True

# Initialize all services
# Use /app/data for persistent storage (mounted as volume)
# This directory persists across container restarts
DATA_DIR = "/app/data"
try:
    os.makedirs(DATA_DIR, exist_ok=True)
except OSError:
    # Directory might already exist or be mounted, continue anyway
    pass

# Load settings first
settings = Settings(config_file=f"{DATA_DIR}/settings.json")
# Get git path from settings, or use environment variable, or default
git_path = settings.get("git_path", os.getenv("GIT_PATH", "/git"))
# Store host path from environment for display
host_git_path = os.getenv("HOST_GIT_PATH", settings.get("host_git_path", "~/git"))
if host_git_path and host_git_path != settings.get("host_git_path"):
    settings.set("host_git_path", host_git_path)
# Store host SSH path from environment for display
host_ssh_path = os.getenv("HOST_SSH_PATH", settings.get("host_ssh_path", "~/.ssh"))
if host_ssh_path and host_ssh_path != settings.get("host_ssh_path"):
    settings.set("host_ssh_path", host_ssh_path)

# Initialize cache manager with TTL from settings
cache_ttl = settings.get("cache_ttl_seconds", 600)
cache_manager = CacheManager(ttl_seconds=cache_ttl)

# Initialize services with configurable git path
scanner = GitScanner(base_path=git_path)
activity_log = ActivityLog(log_file=f"{DATA_DIR}/activity_log.json")
operations = GitOperations(base_path=git_path, activity_log=activity_log, cache_manager=cache_manager)
schedule_manager = ScheduleManager(base_path=git_path, config_file=f"{DATA_DIR}/schedules.json", activity_log=activity_log, cache_manager=cache_manager)
repo_groups = RepoGroups(config_file=f"{DATA_DIR}/repo_groups.json")


@app.route('/')
def index():
    """Serve the main web interface."""
    return render_template('index.html')


@app.route('/api/health')
def health():
    """Health check endpoint."""
    return jsonify({"status": "healthy"})


@app.route('/api/repos', methods=['GET'])
def list_repos():
    """List all repositories with their status."""
    try:
        # Check for force_refresh parameter
        force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
        
        # Get batch processing settings
        batch_size = settings.get("batch_size", 10)
        parallel_workers = settings.get("parallel_workers", 5)
        
        # Use cache if available
        repos = scanner.scan_all_repos(
            force_refresh=force_refresh, 
            cache_manager=cache_manager,
            batch_size=batch_size,
            parallel_workers=parallel_workers
        )
        
        # Automatically sync behind repos to default "Behind" group
        repo_groups.sync_behind_repos_to_default_group(repos)
        
        # Add groups and tags to each repo
        for repo in repos:
            repo['groups'] = repo_groups.get_repo_groups(repo['name'])
            repo['tags'] = repo_groups.get_tags(repo['name'])
        
        # Apply filters
        search = request.args.get('search', '').lower()
        status_filter = request.args.get('status')
        group_filter = request.args.get('group')
        tag_filter = request.args.get('tag')
        
        if search:
            repos = [r for r in repos if search in r['name'].lower()]
        
        if status_filter:
            repos = [r for r in repos if r.get('status', {}).get('state') == status_filter]
        
        if group_filter:
            repos = [r for r in repos if group_filter in r.get('groups', [])]
        
        if tag_filter:
            repos = [r for r in repos if tag_filter in r.get('tags', [])]
        
        # Sort options
        sort_by = request.args.get('sort', 'name')
        if sort_by == 'name':
            repos.sort(key=lambda x: x['name'])
        elif sort_by == 'status':
            repos.sort(key=lambda x: x.get('status', {}).get('state', ''))
        elif sort_by == 'date':
            repos.sort(key=lambda x: x.get('last_commit', {}).get('date', ''), reverse=True)
        
        return jsonify({
            "success": True,
            "repos": repos,
            "count": len(repos)
        }), 200, {'Content-Type': 'application/json'}
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/repos/batch', methods=['GET'])
def list_repos_batch():
    """List repositories in batches for progressive loading."""
    try:
        # Get batch parameters
        batch_index = int(request.args.get('batch', 0))
        batch_size = int(request.args.get('batch_size', settings.get("batch_size", 10)))
        force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
        
        # Get all repository names first (fast operation)
        all_repo_names = scanner.find_repositories()
        total_repos = len(all_repo_names)
        
        # Calculate batch range
        start_idx = batch_index * batch_size
        end_idx = min(start_idx + batch_size, total_repos)
        
        if start_idx >= total_repos:
            return jsonify({
                "success": True,
                "repos": [],
                "batch": batch_index,
                "total": total_repos,
                "has_more": False
            })
        
        # Get batch of repo names
        batch_repo_names = all_repo_names[start_idx:end_idx]
        
        # Scan this batch
        repos = scanner.scan_repos_batch(
            batch_repo_names, 
            force_refresh=force_refresh, 
            cache_manager=cache_manager
        )
        
        # Automatically sync behind repos to default "Behind" group
        repo_groups.sync_behind_repos_to_default_group(repos)
        
        # Add groups and tags to each repo
        for repo in repos:
            repo['groups'] = repo_groups.get_repo_groups(repo['name'])
            repo['tags'] = repo_groups.get_tags(repo['name'])
        
        return jsonify({
            "success": True,
            "repos": repos,
            "batch": batch_index,
            "total": total_repos,
            "loaded": end_idx,
            "has_more": end_idx < total_repos
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/repos/list', methods=['GET'])
def list_repo_names():
    """Get just the list of repository names (fast, for batch loading)."""
    try:
        repo_names = scanner.find_repositories()
        return jsonify({
            "success": True,
            "repos": repo_names,
            "total": len(repo_names)
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/repos/<repo_name>/status', methods=['GET'])
def repo_status(repo_name):
    """Get detailed status for a specific repository."""
    try:
        # Check for force_refresh parameter
        force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
        
        # Check cache first if not forcing refresh
        info = None
        if not force_refresh and cache_manager:
            cached_info = cache_manager.get(repo_name)
            if cached_info is not None:
                info = cached_info
        
        # If not in cache or forcing refresh, get fresh info
        if info is None:
            info = scanner.get_repo_info(repo_name)
            if info and cache_manager:
                # Cache the result
                cache_manager.set(repo_name, info)
        
        if info is None:
            return jsonify({
                "success": False,
                "error": f"Repository {repo_name} not found"
            }), 404
        
        # Add groups, tags, and commit history
        info['groups'] = repo_groups.get_repo_groups(repo_name)
        info['tags'] = repo_groups.get_tags(repo_name)
        info['commit_history'] = scanner.get_commit_history(repo_name, limit=20)
        info['activity_history'] = activity_log.get_repo_history(repo_name, limit=10)
        
        return jsonify({
            "success": True,
            "repo": info
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/repos/<repo_name>/pull', methods=['POST'])
def pull_repo(repo_name):
    """Pull updates for a specific repository."""
    try:
        result = operations.pull_repo(repo_name)
        status_code = 200 if result["success"] else 400
        
        # If pull was successful, get updated repo info and sync behind group
        if result["success"]:
            # Get fresh repo info (bypasses cache since we just invalidated it)
            repo_info = scanner.get_repo_info(repo_name)
            if repo_info:
                # Sync the behind group with this single repo update
                repo_groups.sync_behind_repos_to_default_group([repo_info])
                
                # Add groups and tags
                repo_info['groups'] = repo_groups.get_repo_groups(repo_name)
                repo_info['tags'] = repo_groups.get_tags(repo_name)
                result['repo'] = repo_info
        
        return jsonify(result), status_code
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/repos/pull-all', methods=['POST'])
def pull_all_repos():
    """Pull updates for all repositories."""
    try:
        # Get list of all repos
        repo_names = scanner.find_repositories()
        result = operations.pull_all_repos(repo_names)
        status_code = 200 if result["success"] else 207  # Multi-status
        
        # After pulling all repos, rescan and sync the behind group
        if result["success"]:
            # Rescan all repos to get updated status
            repos = scanner.scan_all_repos(
                force_refresh=True,  # Force refresh to get latest status
                cache_manager=cache_manager,
                batch_size=settings.get("batch_size", 10),
                parallel_workers=settings.get("parallel_workers", 5)
            )
            # Sync the behind group with all repos
            repo_groups.sync_behind_repos_to_default_group(repos)
        
        return jsonify(result), status_code
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# Schedule management endpoints
@app.route('/api/schedules', methods=['GET'])
def list_schedules():
    """List all schedules."""
    try:
        # Always get fresh schedules from the manager (no caching)
        schedules = schedule_manager.get_schedules()
        # Ensure we return a list, not a dict
        if not isinstance(schedules, list):
            schedules = list(schedules) if schedules else []
        return jsonify({
            "success": True,
            "schedules": schedules
        })
    except Exception as e:
        print(f"Error listing schedules: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/schedules', methods=['POST'])
def create_schedule():
    """Create a new schedule."""
    try:
        data = request.get_json()
        name = data.get('name')
        repos = data.get('repos', [])
        groups = data.get('groups', [])
        schedule_type = data.get('type', 'daily')
        value = data.get('value')
        
        if not name or (not repos and not groups):
            return jsonify({
                "success": False,
                "error": "Name and at least one repository or group is required"
            }), 400
        
        # Resolve groups to repositories
        resolved_repos = list(repos)  # Start with direct repos
        for group_name in groups:
            # Find the group and add its repositories
            all_groups = repo_groups.get_groups()
            group = next((g for g in all_groups if g['name'] == group_name), None)
            if group:
                resolved_repos.extend(group.get('repos', []))
        
        # Remove duplicates while preserving order
        resolved_repos = list(dict.fromkeys(resolved_repos))
        
        schedule = schedule_manager.create_schedule(
            name=name,
            repos=resolved_repos,  # Store resolved repos
            schedule_type=schedule_type,
            value=value,
            hour=data.get('hour', 0),
            minute=data.get('minute', 0),
            day_of_week=data.get('day_of_week', 'mon'),
            cron=data.get('cron'),
            groups=groups  # Also store groups for display
        )
        
        return jsonify({
            "success": True,
            "schedule": schedule
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/schedules/<schedule_id>', methods=['PUT'])
def update_schedule(schedule_id):
    """Update an existing schedule."""
    try:
        data = request.get_json()
        repos = data.get('repos', [])
        groups = data.get('groups', [])
        
        # Resolve groups to repositories if groups are provided
        if groups:
            resolved_repos = list(repos)  # Start with direct repos
            for group_name in groups:
                # Find the group and add its repositories
                all_groups = repo_groups.get_groups()
                group = next((g for g in all_groups if g['name'] == group_name), None)
                if group:
                    resolved_repos.extend(group.get('repos', []))
            
            # Remove duplicates while preserving order
            resolved_repos = list(dict.fromkeys(resolved_repos))
            data['repos'] = resolved_repos
        
        schedule = schedule_manager.update_schedule(schedule_id, **data)
        
        if schedule is None:
            return jsonify({
                "success": False,
                "error": "Schedule not found"
            }), 404
        
        return jsonify({
            "success": True,
            "schedule": schedule
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/schedules/<schedule_id>', methods=['DELETE'])
def delete_schedule(schedule_id):
    """Delete a schedule."""
    try:
        success = schedule_manager.delete_schedule(schedule_id)
        if not success:
            return jsonify({
                "success": False,
                "error": "Schedule not found"
            }), 404
        
        return jsonify({
            "success": True
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# Statistics endpoint
@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get overall statistics."""
    try:
        repos = scanner.scan_all_repos()
        
        status_counts = {
            'behind': 0,
            'ahead': 0,
            'up_to_date': 0,
            'diverged': 0,
            'no_remote': 0,
            'error': 0
        }
        
        total_repos = len(repos)
        repos_with_changes = sum(1 for r in repos if r.get('is_dirty', False))
        
        for repo in repos:
            status = repo.get('status', {}).get('state', 'unknown')
            if status in status_counts:
                status_counts[status] += 1
        
        activity_stats = activity_log.get_stats()
        
        return jsonify({
            "success": True,
            "stats": {
                "total_repos": total_repos,
                "repos_with_changes": repos_with_changes,
                "status_counts": status_counts,
                "activity": activity_stats
            }
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# Activity log endpoints
@app.route('/api/activity', methods=['GET'])
def get_activity_log():
    """Get activity log."""
    try:
        limit = int(request.args.get('limit', 100))
        repo = request.args.get('repo')
        operation = request.args.get('operation')
        
        logs = activity_log.get_logs(limit=limit, repo=repo, operation=operation)
        return jsonify({
            "success": True,
            "logs": logs,
            "count": len(logs)
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# Repository groups endpoints
@app.route('/api/groups', methods=['GET'])
def list_groups():
    """List all groups."""
    try:
        groups = repo_groups.get_groups()
        return jsonify({
            "success": True,
            "groups": groups
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/groups', methods=['POST'])
def create_group():
    """Create a new group."""
    try:
        data = request.get_json()
        name = data.get('name')
        repos = data.get('repos', [])
        color = data.get('color')
        
        if not name:
            return jsonify({
                "success": False,
                "error": "Group name is required"
            }), 400
        
        group = repo_groups.create_group(name, repos, color)
        return jsonify({
            "success": True,
            "group": group
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/groups/<group_id>', methods=['PUT'])
def update_group(group_id):
    """Update a group."""
    try:
        data = request.get_json()
        group = repo_groups.update_group(group_id, **data)
        
        if group is None:
            return jsonify({
                "success": False,
                "error": "Group not found"
            }), 404
        
        return jsonify({
            "success": True,
            "group": group
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/groups/<group_id>', methods=['DELETE'])
def delete_group(group_id):
    """Delete a group."""
    try:
        success = repo_groups.delete_group(group_id)
        if not success:
            return jsonify({
                "success": False,
                "error": "Group not found"
            }), 404
        
        return jsonify({
            "success": True
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/groups/<group_id>/repos', methods=['POST'])
def add_repo_to_group(group_id):
    """Add a repository to a group."""
    try:
        data = request.get_json()
        repo_name = data.get('repo')
        
        if not repo_name:
            return jsonify({
                "success": False,
                "error": "Repository name is required"
            }), 400
        
        success = repo_groups.add_repo_to_group(group_id, repo_name)
        if not success:
            return jsonify({
                "success": False,
                "error": "Group not found"
            }), 404
        
        return jsonify({
            "success": True
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/groups/<group_id>/repos/<repo_name>', methods=['DELETE'])
def remove_repo_from_group(group_id, repo_name):
    """Remove a repository from a group."""
    try:
        success = repo_groups.remove_repo_from_group(group_id, repo_name)
        if not success:
            return jsonify({
                "success": False,
                "error": "Group not found"
            }), 404
        
        return jsonify({
            "success": True
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# Tags endpoints
@app.route('/api/tags', methods=['GET'])
def list_tags():
    """Get all tags."""
    try:
        tags = repo_groups.get_all_tags()
        return jsonify({
            "success": True,
            "tags": tags
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/repos/<repo_name>/tags', methods=['POST'])
def add_tag(repo_name):
    """Add a tag to a repository."""
    try:
        data = request.get_json()
        tag = data.get('tag')
        
        if not tag:
            return jsonify({
                "success": False,
                "error": "Tag is required"
            }), 400
        
        repo_groups.add_tag(repo_name, tag)
        return jsonify({
            "success": True
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/repos/<repo_name>/tags/<tag>', methods=['DELETE'])
def remove_tag(repo_name, tag):
    """Remove a tag from a repository."""
    try:
        repo_groups.remove_tag(repo_name, tag)
        return jsonify({
            "success": True
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# Bulk operations
@app.route('/api/repos/bulk-pull', methods=['POST'])
def bulk_pull():
    """Pull updates for selected repositories."""
    try:
        data = request.get_json()
        repo_names = data.get('repos', [])
        
        if not repo_names:
            return jsonify({
                "success": False,
                "error": "No repositories specified"
            }), 400
        
        result = operations.pull_all_repos(repo_names)
        status_code = 200 if result["success"] else 207
        
        # After bulk pull, rescan updated repos and sync the behind group
        if result["success"]:
            # Rescan the updated repos to get latest status
            updated_repos = []
            for repo_name in repo_names:
                repo_info = scanner.get_repo_info(repo_name)
                if repo_info:
                    updated_repos.append(repo_info)
            # Sync the behind group with updated repos
            if updated_repos:
                repo_groups.sync_behind_repos_to_default_group(updated_repos)
        
        return jsonify(result), status_code
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# Settings endpoints
@app.route('/api/settings', methods=['GET'])
def get_settings():
    """Get all settings."""
    try:
        all_settings = settings.get_all()
        # Add environment variable info for host paths
        all_settings['HOST_GIT_PATH'] = os.getenv("HOST_GIT_PATH", "Not set")
        all_settings['HOST_SSH_PATH'] = os.getenv("HOST_SSH_PATH", "Not set")
        return jsonify({
            "success": True,
            "settings": all_settings
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/settings', methods=['PUT'])
def update_settings():
    """Update settings."""
    try:
        data = request.get_json()
        
        # Validate git_path if provided (container path)
        if 'git_path' in data:
            new_path = data['git_path']
            if not os.path.exists(new_path):
                return jsonify({
                    "success": False,
                    "error": f"Container path does not exist: {new_path}. Make sure the volume is mounted correctly."
                }), 400
        
        # Update settings
        settings.update(**data)
        
        # If cache_ttl_seconds changed, update cache manager
        if 'cache_ttl_seconds' in data:
            new_ttl = settings.get("cache_ttl_seconds", 600)
            cache_manager.update_ttl(new_ttl)
        
        # If git_path changed, reinitialize services
        if 'git_path' in data:
            global scanner, operations, schedule_manager
            new_git_path = settings.get("git_path")
            scanner = GitScanner(base_path=new_git_path)
            operations = GitOperations(base_path=new_git_path, activity_log=activity_log, cache_manager=cache_manager)
            schedule_manager = ScheduleManager(
                base_path=new_git_path, 
                config_file=f"{DATA_DIR}/schedules.json", 
                activity_log=activity_log,
                cache_manager=cache_manager
            )
        
        # Note: host_git_path and host_ssh_path are informational only - actual mounts are in docker-compose.yml
        # We store them so users can see what they configured
        
        return jsonify({
            "success": True,
            "settings": settings.get_all(),
            "message": "Settings saved. If you changed the host git path or SSH path, update HOST_GIT_PATH or HOST_SSH_PATH in .env or docker-compose.yml and restart the container."
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/settings/reset', methods=['POST'])
def reset_settings():
    """Reset settings to defaults."""
    try:
        settings.reset()
        # Update cache TTL to default
        cache_manager.update_ttl(settings.get("cache_ttl_seconds", 600))
        return jsonify({
            "success": True,
            "settings": settings.get_all()
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/cache/clear', methods=['POST'])
def clear_cache():
    """Clear the cache and return statistics."""
    try:
        stats_before = cache_manager.get_stats()
        cache_manager.invalidate_all()
        stats_after = cache_manager.get_stats()
        
        return jsonify({
            "success": True,
            "message": "Cache cleared successfully",
            "stats_before": stats_before,
            "stats_after": stats_after
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/cache/stats', methods=['GET'])
def cache_stats():
    """Get cache statistics."""
    try:
        stats = cache_manager.get_stats()
        return jsonify({
            "success": True,
            "stats": stats
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5010, debug=True)

