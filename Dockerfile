FROM python:3.13-slim-bookworm

# Instalação do rclone, curl e certificados para streaming de mídia do Drive
RUN apt-get update && apt-get install -y --no-install-recommends \
    rclone ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 10001 --create-home talk2me

# Driver libSQL para integração nativa com Turso (embedded replica / nuvem)
RUN pip install --no-cache-dir libsql-experimental

WORKDIR /app

# Copia arquivos da aplicação
COPY db.py server.py accounts.py media_store.py media-index.json entrypoint.sh ./
COPY public/ public/
COPY dumped_content/ dumped_content/

RUN chmod +x entrypoint.sh && chown -R 10001:10001 /app

USER 10001:10001

EXPOSE 8000

CMD ["./entrypoint.sh"]
