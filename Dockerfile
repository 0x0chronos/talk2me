FROM python:3.13-slim-bookworm

# InstalaÃ§Ã£o do rclone, curl e certificados para streaming de mÃ­dia do Drive
RUN apt-get update && apt-get install -y --no-install-recommends \
    rclone ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 10001 --create-home talk2me

# Driver libSQL para integraÃ§Ã£o nativa com Turso (embedded replica / nuvem)
RUN pip install --no-cache-dir libsql-experimental

# Render mounts the Drive credential only during this step. Keep the audio
# outside the public directory so the normal session check still applies.
RUN --mount=type=secret,id=audio-drive_b64 --mount=type=tmpfs,target=/run/audio-build \
    set -eu; mkdir -p /opt/talk2me-audio; \
    if [ -f /run/secrets/audio-drive_b64 ]; then \
      cd /run/audio-build; base64 -d /run/secrets/audio-drive_b64 > rclone.conf; \
      rclone copyto --config ./rclone.conf --retries 5 --drive-chunk-size 8M \
        talk2me-drive:talk2me/offline-packs/original-audio-v1.zip originals.zip; \
      echo '1a2e58dc2cc219c4b9bd6681b8cc1b8a2faeac2265276c23e282e5edba9db8b8  originals.zip' | sha256sum -c -; \
      python -m zipfile -e originals.zip /opt/talk2me-audio; \
    fi

# Keep the reference lesson ready even after the Free instance sleeps.
COPY deploy/preloaded-visuals.md5 /opt/preloaded-visuals.md5
RUN --mount=type=secret,id=audio-drive_b64 --mount=type=tmpfs,target=/run/visual-build \
    set -eu; mkdir -p /opt/talk2me-visuals; \
    if [ -f /run/secrets/audio-drive_b64 ]; then \
      cd /opt/talk2me-visuals; base64 -d /run/secrets/audio-drive_b64 > /run/visual-build/rclone.conf; \
      while read -r digest name; do \
        rclone copyto --config /run/visual-build/rclone.conf --retries 5 --retries-sleep 5s \
          "talk2me-drive:talk2me/media_all/$name" "$name"; \
      done < /opt/preloaded-visuals.md5; \
      md5sum -c /opt/preloaded-visuals.md5; \
    fi

WORKDIR /app

# Copia arquivos da aplicaÃ§Ã£o
COPY deploy/build_speech.py deploy/build_speech.py
RUN python deploy/build_speech.py
COPY db.py server.py accounts.py media_store.py media-index.json entrypoint.sh ./
COPY public/ public/
COPY dumped_content/ dumped_content/

RUN chmod +x entrypoint.sh && chown -R 10001:10001 /app

USER 10001:10001

EXPOSE 8000

CMD ["./entrypoint.sh"]
