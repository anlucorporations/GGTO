# GGTO — imagen para Cloud Run (backend FastAPI + web React)
# Contexto de build: el directorio `app/`.
#   Etapa 1: compila la SPA (`app/web`) con Node.
#   Etapa 2: runtime Python que sirve la API y la SPA.

FROM node:20-slim AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

WORKDIR /srv

COPY requirements.txt /srv/requirements.txt
RUN pip install --no-cache-dir -r /srv/requirements.txt

COPY . /srv/app
COPY --from=web /web/dist /srv/app/web/dist

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
