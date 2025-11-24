#!/bin/bash
# Docker entrypoint script to handle SSH key permissions

# Fix SSH key permissions if they exist and are writable
# Note: SSH keys are typically mounted read-only, so this may not apply
if [ -d /home/appuser/.ssh ] && [ -w /home/appuser/.ssh ]; then
    # Ensure .ssh directory has correct permissions
    chmod 700 /home/appuser/.ssh 2>/dev/null || true
    
    # Fix permissions for SSH keys
    chmod 600 /home/appuser/.ssh/id_* 2>/dev/null || true
    chmod 644 /home/appuser/.ssh/*.pub 2>/dev/null || true
    chmod 644 /home/appuser/.ssh/known_hosts 2>/dev/null || true
    [ -f /home/appuser/.ssh/config ] && chmod 600 /home/appuser/.ssh/config 2>/dev/null || true
fi

# Execute the main command
exec "$@"

