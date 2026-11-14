FROM python:3.13-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends rclone ca-certificates && rm -rf /var/lib/apt/lists/* && useradd --uid 10001 --create-home talk2me
WORKDIR /app
COPY server.py accounts.py media_store.py media-index.json ./
COPY public/ public/
COPY dumped_content/ dumped_content/
USER 10001:10001
CMD ["python", "-B", "-u", "server.py"]
