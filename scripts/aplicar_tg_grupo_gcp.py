#!/usr/bin/env python3
"""Genera el job de Cloud Run que aplica F3-TG-1 dentro de la VPC.

Uso:
  python scripts/aplicar_tg_grupo_gcp.py            # genera el YAML
  gcloud run jobs replace -f scripts/_job_tg_grupo.yaml --region europe-west1 --project ggto-prod-txblvento2
  gcloud run jobs execute ggto-migrar-tg-grupo --region europe-west1 --project ggto-prod-txblvento2 --wait

El job lee DB_PASSWORD de Secret Manager; ningún secreto se escribe en el YAML.
"""
from __future__ import annotations

import base64
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
MIGRACION = RAIZ / "scripts" / "migrar_tg_grupo.py"
SALIDA = RAIZ / "scripts" / "_job_tg_grupo.yaml"

b64 = base64.b64encode(MIGRACION.read_bytes()).decode("ascii")
code = (
    "import base64,os,sys,urllib.parse\n"
    f"src=base64.b64decode('{b64}').decode()\n"
    "dsn='postgresql://{}:{}@{}:{}/{}'.format(\n"
    "  os.environ['DB_USER'], urllib.parse.quote(os.environ['DB_PASSWORD'], safe=''),\n"
    "  os.environ['DB_HOST'], os.environ['DB_PORT'], os.environ['DB_NAME'])\n"
    "sys.argv=['migrar_tg_grupo.py','--aplicar','--si','--dsn',dsn]\n"
    "exec(compile(src,'migrar_tg_grupo.py','exec'),{'__name__':'__main__','__file__':'migrar_tg_grupo.py'})\n"
)
args_b64 = base64.b64encode(code.encode()).decode("ascii")
body = f"import base64; exec(base64.b64decode('{args_b64}').decode())"

yaml = f"""apiVersion: run.googleapis.com/v1
kind: Job
metadata:
  name: ggto-migrar-tg-grupo
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/cloudsql-instances: ggto-prod-txblvento2:europe-west1:ggto-db
        run.googleapis.com/vpc-access-connector: ggto-connector
        run.googleapis.com/vpc-access-egress: private-ranges-only
    spec:
      taskCount: 1
      template:
        spec:
          timeoutSeconds: '300'
          maxRetries: 0
          containers:
          - image: europe-west1-docker.pkg.dev/ggto-prod-txblvento2/ggto/ggto-web:v105
            command: ["python", "-c"]
            args: ["{body}"]
            env:
            - name: DB_HOST
              value: 10.140.0.2
            - name: DB_PORT
              value: "5432"
            - name: DB_NAME
              value: ggtov2
            - name: DB_USER
              value: ggtov2_app
            - name: DB_SSLMODE
              value: disable
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  key: latest
                  name: ggtov2-db-password
            resources:
              limits:
                cpu: "1"
                memory: 512Mi
          serviceAccountName: ggto-web-sa@ggto-prod-txblvento2.iam.gserviceaccount.com
"""

SALIDA.write_text(yaml, encoding="utf-8")
print(f"YAML generado: {SALIDA}")
