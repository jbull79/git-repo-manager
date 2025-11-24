"""Scheduler for automatic git pull operations."""
import json
import os
from pathlib import Path
from typing import List, Dict, Optional
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from app.git_operations import GitOperations
from app.activity_log import ActivityLog


class ScheduleManager:
    """Manages scheduled git pull operations."""
    
    def __init__(self, base_path: str = "/git", config_file: str = "/app/schedules.json", activity_log=None, cache_manager=None):
        """Initialize scheduler manager."""
        self.base_path = base_path
        self.config_file = config_file
        self.scheduler = BackgroundScheduler()
        self.activity_log = activity_log
        self.cache_manager = cache_manager
        self.operations = GitOperations(base_path=base_path, activity_log=activity_log, cache_manager=cache_manager)
        self.schedules = self._load_schedules()
        self._start_scheduler()
    
    def _load_schedules(self) -> Dict:
        """Load schedules from config file."""
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r') as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}
    
    def _save_schedules(self):
        """Save schedules to config file."""
        try:
            with open(self.config_file, 'w') as f:
                json.dump(self.schedules, f, indent=2)
        except Exception as e:
            print(f"Error saving schedules: {e}")
    
    def _start_scheduler(self):
        """Start the scheduler and load existing schedules."""
        if not self.scheduler.running:
            self.scheduler.start()
            self._reload_jobs()
    
    def _reload_jobs(self):
        """Reload all scheduled jobs."""
        # Remove all existing jobs
        self.scheduler.remove_all_jobs()
        
        # Add jobs from schedules
        for schedule_id, schedule in self.schedules.items():
            if schedule.get('enabled', True):
                self._add_job(schedule_id, schedule)
    
    def _add_job(self, schedule_id: str, schedule: Dict):
        """Add a job to the scheduler."""
        repos = schedule.get('repos', [])
        if not repos:
            return
        
        schedule_type = schedule.get('type', 'interval')
        schedule_value = schedule.get('value')
        
        try:
            if schedule_type == 'daily':
                # Run once a day at specified time (default midnight)
                hour = schedule.get('hour', 0)
                minute = schedule.get('minute', 0)
                trigger = CronTrigger(hour=hour, minute=minute)
            elif schedule_type == 'weekly':
                # Run once a week on specified day (default Monday)
                day_of_week = schedule.get('day_of_week', 'mon')
                hour = schedule.get('hour', 0)
                minute = schedule.get('minute', 0)
                trigger = CronTrigger(day_of_week=day_of_week, hour=hour, minute=minute)
            elif schedule_type == 'custom':
                # Custom cron expression
                cron_expr = schedule.get('cron', '0 0 * * *')  # Default: daily at midnight
                try:
                    # Parse cron expression (minute hour day month day-of-week)
                    # APScheduler CronTrigger accepts parameters directly, not as string
                    parts = cron_expr.strip().split()
                    if len(parts) == 5:
                        # Build trigger with proper parameter handling
                        trigger_params = {}
                        if parts[0] != '*':
                            trigger_params['minute'] = parts[0]
                        if parts[1] != '*':
                            trigger_params['hour'] = parts[1]
                        if parts[2] != '*':
                            trigger_params['day'] = parts[2]
                        if parts[3] != '*':
                            trigger_params['month'] = parts[3]
                        if parts[4] != '*':
                            trigger_params['day_of_week'] = parts[4]
                        trigger = CronTrigger(**trigger_params)
                    else:
                        print(f"Invalid cron expression format: {cron_expr}")
                        return
                except Exception as e:
                    print(f"Invalid cron expression: {cron_expr}: {e}")
                    return
            else:
                # Interval (hours)
                hours = int(schedule_value) if schedule_value else 24
                trigger = IntervalTrigger(hours=hours)
            
            schedule_name = schedule.get('name', 'Unknown')
            self.scheduler.add_job(
                self._execute_schedule,
                trigger=trigger,
                id=schedule_id,
                args=[repos, schedule_name],
                replace_existing=True
            )
        except Exception as e:
            print(f"Error adding job {schedule_id}: {e}")
    
    def _execute_schedule(self, repos: List[str], schedule_name: str = "Scheduled"):
        """Execute git pull for scheduled repositories."""
        print(f"Executing scheduled pull for repos: {repos}")
        for repo in repos:
            try:
                result = self.operations.pull_repo(repo)
                print(f"Schedule pull result for {repo}: {result}")
                
                # Cache invalidation is handled in GitOperations.pull_repo()
                # No need to invalidate here as it's already done
                
                if self.activity_log:
                    self.activity_log.log_operation(
                        'scheduled_pull', repo, 'success' if result['success'] else 'error',
                        f"{schedule_name}: {result.get('message', result.get('error', 'Unknown'))}",
                        {"updates": result.get('updates', 0), "branch": result.get('branch', 'unknown')}
                    )
            except Exception as e:
                print(f"Error pulling {repo}: {e}")
                if self.activity_log:
                    self.activity_log.log_operation('scheduled_pull', repo, 'error', str(e))
    
    def create_schedule(self, name: str, repos: List[str], schedule_type: str, 
                       value: Optional[str] = None, **kwargs) -> Dict:
        """Create a new schedule."""
        schedule_id = f"schedule_{len(self.schedules)}"
        
        schedule = {
            'id': schedule_id,
            'name': name,
            'repos': repos,
            'type': schedule_type,
            'value': value,
            'enabled': True,
            **kwargs
        }
        
        self.schedules[schedule_id] = schedule
        self._save_schedules()
        self._add_job(schedule_id, schedule)
        
        return schedule
    
    def update_schedule(self, schedule_id: str, **kwargs) -> Optional[Dict]:
        """Update an existing schedule."""
        if schedule_id not in self.schedules:
            return None
        
        self.schedules[schedule_id].update(kwargs)
        self._save_schedules()
        
        schedule = self.schedules[schedule_id]
        if schedule.get('enabled', True):
            self._add_job(schedule_id, schedule)
        else:
            self.scheduler.remove_job(schedule_id)
        
        return schedule
    
    def delete_schedule(self, schedule_id: str) -> bool:
        """Delete a schedule."""
        if schedule_id not in self.schedules:
            return False
        
        self.scheduler.remove_job(schedule_id)
        del self.schedules[schedule_id]
        self._save_schedules()
        return True
    
    def get_schedules(self) -> List[Dict]:
        """Get all schedules."""
        return list(self.schedules.values())
    
    def get_schedule(self, schedule_id: str) -> Optional[Dict]:
        """Get a specific schedule."""
        return self.schedules.get(schedule_id)

