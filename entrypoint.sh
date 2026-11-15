#!/bin/sh
set -e

export TOKIO_WORKER_THREADS="${TOKIO_WORKER_THREADS:-2}"
export PORT="${PORT:-8000}"

if [ -n "$RCLONE_CONFIG_BASE64" ]; then
    mkdir -p /tmp/rclone
    echo "$RCLONE_CONFIG_BASE64" | base64 -d > /tmp/rclone/rclone.conf
    export RCLONE_CONFIG=/tmp/rclone/rclone.conf
elif [ -n "$RCLONE_CONFIG_CONTENT" ]; then
    mkdir -p /tmp/rclone
    printf "%s\n" "$RCLONE_CONFIG_CONTENT" > /tmp/rclone/rclone.conf
    export RCLONE_CONFIG=/tmp/rclone/rclone.conf
fi

echo "Iniciando talk2me na porta $PORT..."
exec python -B -u server.py
