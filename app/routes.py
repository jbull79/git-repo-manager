"""HTTP API and page routes."""
import os
import traceback
from flask import Blueprint, render_template, jsonify, request
from app.services import get_services, APP_VERSION
from app.auth import api_key_required, check_api_key, unauthorized_response
from app.guards import is_read_only, read_only_response

bp = Blueprint('git_repo_manager', __name__)



@bp.route('/')
def index():
    """Serve the main web interface."""
    return render_template(
        'index.html',
        version=APP_VERSION,
        require_api_key=api_key_required(),
    )


@bp.route('/api/health')
def health():
    """Health check endpoint."""
    s = get_services()
    gp = s.git_path
    git_ok = os.path.isdir(gp)
    status = "healthy" if git_ok else "degraded"
    return jsonify({
        "status": status,
        "git_path": gp,
        "git_path_ok": git_ok,
        "read_only": bool(s.settings.get("read_only", False)),
    })


@bp.route('/api/config')
def public_config():
    """Public client config (no auth)."""
    s = get_services()
    return jsonify({
        "version": APP_VERSION,
        "api_key_required": api_key_required(),
        "read_only": bool(s.settings.get("read_only", False)),
        "block_pull_on_dirty": bool(s.settings.get("block_pull_on_dirty", True)),
    })


@bp.route('/api/repos', methods=['GET'])
def list_repos():
    """List all repositories with their status."""
    try:
        # Check for force_refresh parameter
        force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
        
        # Get batch processing settings
        batch_size = get_services().settings.get("batch_size", 10)
        parallel_workers = get_services().settings.get("parallel_workers", 5)
        
        # Use cache if available
        repos = get_services().scanner.scan_all_repos(
            force_refresh=force_refresh, 
            cache_manager=get_services().cache_manager,
            batch_size=batch_size,
            parallel_workers=parallel_workers
        )
        
        # Automatically sync behind repos to default "Behind" group
        get_services().repo_groups.sync_behind_repos_to_default_group(repos)
        # Automatically sync diverged repos to default "Diverged" group
        get_services().repo_groups.sync_diverged_repos_to_default_group(repos)
        
        # Add groups and tags to each repo
        for repo in repos:
            repo['groups'] = get_services().repo_groups.get_repo_groups(repo['name'])
            repo['tags'] = get_services().repo_groups.get_tags(repo['name'])
        
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


@bp.route('/api/repos/batch', methods=['GET'])
def list_repos_batch():
    """List repositories in batches for progressive loading."""
    try:
        # Get batch parameters
        batch_index = int(request.args.get('batch', 0))
        batch_size = int(request.args.get('batch_size', get_services().settings.get("batch_size", 10)))
        force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
        
        # Get all repository names first (fast operation)
        all_repo_names = get_services().scanner.find_repositories()
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
        
        # Get parallel workers setting for batch processing
        parallel_workers = get_services().settings.get("parallel_workers", 10)
        
        # Scan this batch with parallel processing
        repos = get_services().scanner.scan_repos_batch(
            batch_repo_names, 
            force_refresh=force_refresh, 
            cache_manager=get_services().cache_manager,
            parallel_workers=parallel_workers
        )
        
        # Automatically sync behind repos to default "Behind" group
        get_services().repo_groups.sync_behind_repos_to_default_group(repos)
        # Automatically sync diverged repos to default "Diverged" group
        get_services().repo_groups.sync_diverged_repos_to_default_group(repos)
        
        # Add groups and tags to each repo
        for repo in repos:
            repo['groups'] = get_services().repo_groups.get_repo_groups(repo['name'])
            repo['tags'] = get_services().repo_groups.get_tags(repo['name'])
        
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


@bp.route('/api/repos/list', methods=['GET'])
def list_repo_names():
    """Get just the list of repository names (fast, for batch loading)."""
    try:
        repo_names = get_services().scanner.find_repositories()
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


@bp.route('/api/repos/<repo_name>/status', methods=['GET'])
def repo_status(repo_name):
    """Get detailed status for a specific repository."""
    try:
        # Check for force_refresh parameter
        force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
        
        # Check cache first if not forcing refresh
        info = None
        if not force_refresh and get_services().cache_manager:
            cached_info = get_services().cache_manager.get(repo_name)
            if cached_info is not None:
                info = cached_info
        
        # If not in cache or forcing refresh, get fresh info
        if info is None:
            info = get_services().scanner.get_repo_info(repo_name)
            if info and get_services().cache_manager:
                # Cache the result
                get_services().cache_manager.set(repo_name, info)
        
        if info is None:
            return jsonify({
                "success": False,
                "error": f"Repository {repo_name} not found"
            }), 404
        
        # Add groups, tags, and commit history
        info['groups'] = get_services().repo_groups.get_repo_groups(repo_name)
        info['tags'] = get_services().repo_groups.get_tags(repo_name)
        info['commit_history'] = get_services().scanner.get_commit_history(repo_name, limit=20)
        info['activity_history'] = get_services().activity_log.get_repo_history(repo_name, limit=10)
        
        return jsonify({
            "success": True,
            "repo": info
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@bp.route('/api/repos/<repo_name>/pull', methods=['POST'])
def pull_repo(repo_name):
    """Pull updates for a specific repository."""
    try:
        if is_read_only(get_services().settings.get):
            return read_only_response()
        # Get pull strategy from request or settings (default: merge)
        pull_strategy = None
        force = False
        if request.is_json and request.json:
            pull_strategy = request.json.get('pull_strategy')
            force = bool(request.json.get('force', False))
        if not pull_strategy:
            pull_strategy = get_services().settings.get('pull_strategy', 'merge')
        block_on_dirty = bool(get_services().settings.get('block_pull_on_dirty', True))

        result = get_services().operations.pull_repo(
            repo_name,
            pull_strategy=pull_strategy,
            force=force,
            block_on_dirty=block_on_dirty,
        )
        if result.get("code") == "dirty_worktree":
            return jsonify(result), 409
        status_code = 200 if result["success"] else 400
        
        # If pull was successful, get updated repo info and sync behind group
        if result["success"]:
            # Get fresh repo info (bypasses cache since we just invalidated it)
            repo_info = get_services().scanner.get_repo_info(repo_name)
            if repo_info:
                # Sync the behind group with this single repo update
                get_services().repo_groups.sync_behind_repos_to_default_group([repo_info])
                # Sync the diverged group with this single repo update
                get_services().repo_groups.sync_diverged_repos_to_default_group([repo_info])
                
                # Add groups and tags
                repo_info['groups'] = get_services().repo_groups.get_repo_groups(repo_name)
                repo_info['tags'] = get_services().repo_groups.get_tags(repo_name)
                result['repo'] = repo_info
        
        return jsonify(result), status_code
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@bp.route('/api/repos/pull-all', methods=['POST'])
def pull_all_repos():
    """Pull updates for all repositories."""
    try:
        if is_read_only(get_services().settings.get):
            return read_only_response()
        # Get pull strategy from request or settings (default: merge)
        pull_strategy = None
        force = False
        if request.is_json and request.json:
            pull_strategy = request.json.get('pull_strategy')
            force = bool(request.json.get('force', False))
        if not pull_strategy:
            pull_strategy = get_services().settings.get('pull_strategy', 'merge')
        block_on_dirty = bool(get_services().settings.get('block_pull_on_dirty', True))

        # Get list of all repos
        repo_names = get_services().scanner.find_repositories()
        result = get_services().operations.pull_all_repos(
            repo_names,
            pull_strategy=pull_strategy,
            force=force,
            block_on_dirty=block_on_dirty,
        )
        status_code = 200 if result["success"] else 207  # Multi-status
        
        # After pulling all repos, rescan and sync the behind group
        if result["success"]:
            # Rescan all repos to get updated status
            repos = get_services().scanner.scan_all_repos(
                force_refresh=True,  # Force refresh to get latest status
                cache_manager=get_services().cache_manager,
                batch_size=get_services().settings.get("batch_size", 10),
                parallel_workers=get_services().settings.get("parallel_workers", 5)
            )
            get_services().repo_groups.sync_behind_repos_to_default_group(repos)
            get_services().repo_groups.sync_diverged_repos_to_default_group(repos)
        
        return jsonify(result), status_code
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@bp.route('/api/repos/<repo_name>/fetch', methods=['POST'])
def fetch_repo_remote(repo_name):
    """Fetch remote refs only (no merge)."""
    try:
        result = get_services().operations.fetch_repo(repo_name)
        if result.get("success"):
            info = get_services().scanner.get_repo_info(repo_name)
            if info:
                result["repo"] = info
        code = 200 if result.get("success") else 400
        return jsonify(result), code
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route('/api/repos/fetch-all', methods=['POST'])
def fetch_all_repos_remote():
    """Fetch all remotes (optional JSON body: {\"repos\": [\"a\",\"b\"]} — default all)."""
    try:
        data = request.get_json(silent=True) or {}
        repo_names = data.get("repos")
        if repo_names is None:
            repo_names = get_services().scanner.find_repositories()
        result = get_services().operations.fetch_repos(repo_names)
        code = 200 if result.get("success") else 207
        return jsonify(result), code
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# Schedule management endpoints
@bp.route('/api/schedules', methods=['GET'])
def list_schedules():
    """List all schedules."""
    try:
        # Always get fresh schedules from the manager (no caching)
        schedules = get_services().schedule_manager.get_schedules()
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


@bp.route('/api/schedules', methods=['POST'])
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
            all_groups = get_services().repo_groups.get_groups()
            group = next((g for g in all_groups if g['name'] == group_name), None)
            if group:
                resolved_repos.extend(group.get('repos', []))
        
        # Remove duplicates while preserving order
        resolved_repos = list(dict.fromkeys(resolved_repos))
        
        schedule = get_services().schedule_manager.create_schedule(
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


@bp.route('/api/schedules/<schedule_id>', methods=['PUT'])
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
                all_groups = get_services().repo_groups.get_groups()
                group = next((g for g in all_groups if g['name'] == group_name), None)
                if group:
                    resolved_repos.extend(group.get('repos', []))
            
            # Remove duplicates while preserving order
            resolved_repos = list(dict.fromkeys(resolved_repos))
            data['repos'] = resolved_repos
        
        schedule = get_services().schedule_manager.update_schedule(schedule_id, **data)
        
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


@bp.route('/api/schedules/<schedule_id>', methods=['DELETE'])
def delete_schedule(schedule_id):
    """Delete a schedule."""
    try:
        success = get_services().schedule_manager.delete_schedule(schedule_id)
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
@bp.route('/api/stats', methods=['GET'])
def get_stats():
    """Get overall statistics. Uses cached data only for fast response."""
    try:
        # Prefer full-list cache; fall back to per-repo cache (e.g. when using batch loading)
        cached_repos = get_services().cache_manager.get('all')
        partial = False
        total_repo_count = 0

        if cached_repos is None:
            # Build stats from per-repo cache so batch-loaded repos still contribute to stats
            try:
                repo_names = get_services().scanner.find_repositories()  # Fast: lists directories only
                total_repo_count = len(repo_names)
                cached_repos = []
                for name in repo_names:
                    info = get_services().cache_manager.get(name)
                    if info is not None and isinstance(info, dict) and 'name' in info:
                        cached_repos.append(info)
                partial = len(cached_repos) < total_repo_count
            except Exception:
                total_repo_count = 0
                cached_repos = []
        else:
            total_repo_count = len(cached_repos)

        repos = cached_repos

        status_counts = {
            'behind': 0,
            'ahead': 0,
            'up_to_date': 0,
            'diverged': 0,
            'no_remote': 0,
            'error': 0
        }
        total_repos = total_repo_count if total_repo_count else (len(repos) if repos else 0)
        repos_with_changes = sum(1 for r in repos if r.get('is_dirty', False)) if repos else 0

        if repos:
            for repo in repos:
                status = repo.get('status', {}).get('state', 'unknown')
                if status in status_counts:
                    status_counts[status] += 1

        activity_stats = get_services().activity_log.get_stats()
        message = None
        if partial and total_repo_count:
            message = f"Stats based on {len(repos)} of {total_repo_count} repositories (load more to update)."
        elif not repos and total_repo_count:
            message = "No cached data yet. Load or refresh repositories to see stats."

        result_stats = {
            "total_repos": total_repos,
            "repos_with_changes": repos_with_changes,
            "status_counts": status_counts,
            "activity": activity_stats,
            "cached": bool(repos),
            "partial": partial
        }
        if message:
            result_stats["message"] = message

        return jsonify({
            "success": True,
            "stats": result_stats
        })
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"Error in get_stats: {error_trace}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# Activity log endpoints
@bp.route('/api/activity', methods=['GET'])
def get_activity_log():
    """Get activity log."""
    try:
        limit = int(request.args.get('limit', 100))
        repo = request.args.get('repo')
        operation = request.args.get('operation')
        status = request.args.get('status')
        include_debug = request.args.get('include_debug', 'true').lower() == 'true'
        
        logs = get_services().activity_log.get_logs(
            limit=limit, 
            repo=repo, 
            operation=operation,
            status=status,
            include_debug=include_debug
        )
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


@bp.route('/api/activity/debug', methods=['POST'])
def add_debug_log():
    """Add a debug log entry."""
    try:
        data = request.get_json()
        message = data.get('message', 'Debug message')
        repo = data.get('repo', 'system')
        details = data.get('details', {})
        
        log_entry = get_services().activity_log.log_debug(message=message, repo=repo, details=details)
        
        return jsonify({
            "success": True,
            "log": log_entry
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# Repository groups endpoints
@bp.route('/api/groups', methods=['GET'])
def list_groups():
    """List all groups."""
    try:
        # Check for force_refresh parameter
        force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
        
        # Check cache first if not forcing refresh
        groups = None
        if not force_refresh and get_services().cache_manager:
            cached_groups = get_services().cache_manager.get('groups')
            if cached_groups is not None:
                groups = cached_groups
        
        # If not in cache or forcing refresh, get fresh groups
        if groups is None:
            groups = get_services().repo_groups.get_groups()
            if get_services().cache_manager:
                # Cache the result
                get_services().cache_manager.set('groups', groups)
        
        return jsonify({
            "success": True,
            "groups": groups
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@bp.route('/api/groups', methods=['POST'])
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
        
        group = get_services().repo_groups.create_group(name, repos, color)
        
        # Invalidate groups cache
        if get_services().cache_manager:
            get_services().cache_manager.invalidate('groups')
        
        return jsonify({
            "success": True,
            "group": group
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@bp.route('/api/groups/<group_id>', methods=['PUT'])
def update_group(group_id):
    """Update a group."""
    try:
        data = request.get_json()
        group = get_services().repo_groups.update_group(group_id, **data)
        
        if group is None:
            return jsonify({
                "success": False,
                "error": "Group not found"
            }), 404
        
        # Invalidate groups cache
        if get_services().cache_manager:
            get_services().cache_manager.invalidate('groups')
        
        return jsonify({
            "success": True,
            "group": group
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@bp.route('/api/groups/<group_id>', methods=['DELETE'])
def delete_group(group_id):
    """Delete a group."""
    try:
        success = get_services().repo_groups.delete_group(group_id)
        if not success:
            return jsonify({
                "success": False,
                "error": "Group not found"
            }), 404
        
        # Invalidate groups cache
        if get_services().cache_manager:
            get_services().cache_manager.invalidate('groups')
        
        return jsonify({
            "success": True
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@bp.route('/api/groups/<group_id>/repos', methods=['POST'])
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
        
        success = get_services().repo_groups.add_repo_to_group(group_id, repo_name)
        if not success:
            return jsonify({
                "success": False,
                "error": "Group not found"
            }), 404
        
        # Invalidate groups cache
        if get_services().cache_manager:
            get_services().cache_manager.invalidate('groups')
        
        return jsonify({
            "success": True
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@bp.route('/api/groups/<group_id>/repos/<repo_name>', methods=['DELETE'])
def remove_repo_from_group(group_id, repo_name):
    """Remove a repository from a group."""
    try:
        success = get_services().repo_groups.remove_repo_from_group(group_id, repo_name)
        if not success:
            return jsonify({
                "success": False,
                "error": "Group not found"
            }), 404
        
        # Invalidate groups cache
        if get_services().cache_manager:
            get_services().cache_manager.invalidate('groups')
        
        return jsonify({
            "success": True
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@bp.route('/api/groups/<group_id>/pull-all', methods=['POST'])
def pull_all_group_repos(group_id):
    """Pull updates for all repositories in a group."""
    try:
        if is_read_only(get_services().settings.get):
            return read_only_response()
        # Get the group
        groups = get_services().repo_groups.get_groups()
        group = next((g for g in groups if g.get('id') == group_id), None)
        
        if not group:
            return jsonify({
                "success": False,
                "error": "Group not found"
            }), 404
        
        # Get repositories in the group
        repo_names = group.get('repos', [])
        
        if not repo_names:
            return jsonify({
                "success": True,
                "message": "No repositories in group",
                "results": []
            })
        
        # Pull all repos in the group
        results = []
        updated_repos = []
        
        # Get pull strategy from request or settings (default: merge)
        pull_strategy = None
        force = False
        if request.is_json and request.json:
            pull_strategy = request.json.get('pull_strategy')
            force = bool(request.json.get('force', False))
        if not pull_strategy:
            pull_strategy = get_services().settings.get('pull_strategy', 'merge')
        block_on_dirty = bool(get_services().settings.get('block_pull_on_dirty', True))

        for repo_name in repo_names:
            result = get_services().operations.pull_repo(
                repo_name,
                pull_strategy=pull_strategy,
                force=force,
                block_on_dirty=block_on_dirty,
            )
            entry = {
                "repo": repo_name,
                "success": result.get("success", False),
                "message": result.get("message") or result.get("error", "Unknown error"),
            }
            if result.get("code"):
                entry["code"] = result["code"]
            results.append(entry)
            
            if result.get("success"):
                # Get updated repo info (bypasses cache since we just invalidated it)
                repo_info = get_services().scanner.get_repo_info(repo_name)
                if repo_info:
                    # Add groups and tags
                    repo_info['groups'] = get_services().repo_groups.get_repo_groups(repo_name)
                    repo_info['tags'] = get_services().repo_groups.get_tags(repo_name)
                    updated_repos.append(repo_info)
        
        # Sync the behind group after updates
        if updated_repos:
            get_services().repo_groups.sync_behind_repos_to_default_group(updated_repos)
            # Sync the diverged group after updates
            get_services().repo_groups.sync_diverged_repos_to_default_group(updated_repos)
        
        # Determine overall success
        all_success = all(r["success"] for r in results)
        status_code = 200 if all_success else 207  # Multi-status if some failed
        
        return jsonify({
            "success": all_success,
            "message": f"Updated {sum(1 for r in results if r['success'])} of {len(results)} repositories",
            "results": results,
            "updated_repos": updated_repos
        }), status_code
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# Tags endpoints
@bp.route('/api/tags', methods=['GET'])
def list_tags():
    """Get all tags."""
    try:
        tags = get_services().repo_groups.get_all_tags()
        return jsonify({
            "success": True,
            "tags": tags
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@bp.route('/api/repos/<repo_name>/tags', methods=['POST'])
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
        
        get_services().repo_groups.add_tag(repo_name, tag)
        return jsonify({
            "success": True
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@bp.route('/api/repos/<repo_name>/tags/<tag>', methods=['DELETE'])
def remove_tag(repo_name, tag):
    """Remove a tag from a repository."""
    try:
        get_services().repo_groups.remove_tag(repo_name, tag)
        return jsonify({
            "success": True
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# Bulk operations
@bp.route('/api/repos/bulk-pull', methods=['POST'])
def bulk_pull():
    """Pull updates for selected repositories."""
    try:
        if is_read_only(get_services().settings.get):
            return read_only_response()
        data = request.get_json()
        repo_names = data.get('repos', [])
        
        if not repo_names:
            return jsonify({
                "success": False,
                "error": "No repositories specified"
            }), 400
        
        # Get pull strategy from request or settings (default: merge)
        pull_strategy = None
        force = False
        if request.is_json and request.json:
            pull_strategy = request.json.get('pull_strategy')
            force = bool(request.json.get('force', False))
        if not pull_strategy:
            pull_strategy = get_services().settings.get('pull_strategy', 'merge')
        block_on_dirty = bool(get_services().settings.get('block_pull_on_dirty', True))

        result = get_services().operations.pull_all_repos(
            repo_names,
            pull_strategy=pull_strategy,
            force=force,
            block_on_dirty=block_on_dirty,
        )
        status_code = 200 if result["success"] else 207
        
        # After bulk pull, rescan updated repos and sync the behind group
        if result["success"]:
            # Rescan the updated repos to get latest status
            updated_repos = []
            for repo_name in repo_names:
                repo_info = get_services().scanner.get_repo_info(repo_name)
                if repo_info:
                    updated_repos.append(repo_info)
            # Sync the behind group with updated repos
            if updated_repos:
                get_services().repo_groups.sync_behind_repos_to_default_group(updated_repos)
                # Sync the diverged group with updated repos
                get_services().repo_groups.sync_diverged_repos_to_default_group(updated_repos)
        
        return jsonify(result), status_code
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# Settings endpoints
@bp.route('/api/settings', methods=['GET'])
def get_settings():
    """Get all settings."""
    try:
        s = get_services()
        all_settings = s.settings.get_all()
        # Effective scan path (may differ from saved git_path when /git is used only in Docker)
        all_settings['git_path_active'] = s.git_path
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


@bp.route('/api/settings', methods=['PUT'])
def update_settings():
    """Update settings."""
    try:
        s = get_services()
        data = request.get_json()
        prev_git_path = s.git_path

        # Validate git_path if provided (container path)
        if 'git_path' in data:
            new_path = data['git_path']
            if not os.path.exists(new_path):
                return jsonify({
                    "success": False,
                    "error": f"Container path does not exist: {new_path}. Make sure the volume is mounted correctly."
                }), 400

        s.activity_log.log_debug(
            "Updating settings with data",
            repo="system",
            details={
                "data_keys": list(data.keys()),
                "git_path": data.get('git_path'),
                "host_ssh_path": data.get('host_ssh_path')
            }
        )

        s.settings.update(**data)

        saved_git_path = s.settings.get("git_path")
        s.activity_log.log_debug(
            "Settings updated - verifying saved values",
            repo="system",
            details={
                "saved_git_path": saved_git_path,
                "requested_git_path": data.get('git_path')
            }
        )

        if 'cache_ttl_seconds' in data:
            s.cache_manager.update_ttl(s.settings.get("cache_ttl_seconds", 600))

        if 'fetch_max_per_minute' in data:
            s.update_fetch_rate_from_settings()

        if 'git_path' in data:
            new_git_path = s.settings.get("git_path")
            if new_git_path != prev_git_path:
                s.cache_manager.invalidate_all()
                s.activity_log.log_debug(
                    f"Git path changed to {new_git_path}",
                    repo="system",
                    details={
                        "old_path": prev_git_path,
                        "new_path": new_git_path
                    }
                )
                s.reconfigure_git_path(new_git_path)

        message = "Settings saved successfully."

        if 'git_path' in data:
            new_git_path = s.settings.get("git_path")
            if new_git_path != prev_git_path:
                message = f"Settings saved. Container path changed to {new_git_path} - cache cleared and repositories reloaded."

        if 'host_ssh_path' in data:
            message += " " if message != "Settings saved successfully." else ""
            message += "Note: SSH path changes require updating docker-compose.yml and restarting the container."

        return jsonify({
            "success": True,
            "settings": s.settings.get_all(),
            "message": message
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@bp.route('/api/settings/reset', methods=['POST'])
def reset_settings():
    """Reset settings to defaults."""
    try:
        s = get_services()
        s.settings.reset()
        s.cache_manager.update_ttl(s.settings.get("cache_ttl_seconds", 600))
        s.update_fetch_rate_from_settings()
        return jsonify({
            "success": True,
            "settings": s.settings.get_all()
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@bp.route('/api/cache/clear', methods=['POST'])
def clear_cache():
    """Clear the cache and return statistics."""
    try:
        stats_before = get_services().cache_manager.get_stats()
        get_services().cache_manager.invalidate_all()
        stats_after = get_services().cache_manager.get_stats()
        
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


@bp.route('/api/cache/stats', methods=['GET'])
def cache_stats():
    """Get cache statistics."""
    try:
        stats = get_services().cache_manager.get_stats()
        return jsonify({
            "success": True,
            "stats": stats
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


def register_routes(app):
    """Attach blueprint and optional API key check for /api/*."""
    @app.before_request
    def _require_api_key():
        from flask import request as rq
        p = rq.path
        if not p.startswith('/api'):
            return None
        if p in ('/api/health', '/api/config'):
            return None
        if not check_api_key():
            return unauthorized_response()

    app.register_blueprint(bp)
