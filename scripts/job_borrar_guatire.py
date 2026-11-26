"""Genera el YAML de un Cloud Run Job efímero que borra los casos de
construcción con GUATIRE en la dirección (y su ficha caso_especial).

Uso:
  python scripts/job_borrar_guatire.py      # genera scripts/_job_guatire.yaml
  gcloud run jobs replace -f scripts/_job_guatire.yaml --region europe-west1
  gcloud run jobs execute ggto-borra-guatire --region europe-west1 --wait
  gcloud beta run jobs executions describe <ejecucion> ... (logs)
"""
import base64
from pathlib import Path

SCRIPT_PY = r'''
import os, sys, psycopg2

ids_caso = [68, 69, 70, 71, 72, 73, 74, 76, 77]
conn = psycopg2.connect(
    host=os.environ["DB_HOST"], port=os.environ["DB_PORT"],
    dbname=os.environ["DB_NAME"], user=os.environ["DB_USER"],
    password=os.environ["DB_PASSWORD"], sslmode=os.environ.get("DB_SSLMODE", "disable"),
)
cur = conn.cursor()
cur.execute(
    "SELECT ce.id_caso_especial, c.id_caso, c.id_averia, c.direccion "
    "FROM caso_especial ce JOIN caso c ON c.id_caso = ce.id_caso "
    "WHERE c.id_caso = ANY(%s) AND c.tipo_caso = 'CONSTRUCCION' "
    "AND upper(c.direccion) LIKE '%%GUATIRE%%'", (ids_caso,))
objetivos = cur.fetchall()
print("Objetivos:", objetivos)
if not objetivos:
    print("Nada que borrar.")
    sys.exit(0)
casos = [o[1] for o in objetivos]
cur.execute("DELETE FROM caso WHERE id_caso = ANY(%s)", (casos,))
print(f"Borrados {cur.rowcount} casos (caso_especial en cascada).")
conn.commit()
cur.execute(
    "SELECT count(*) FROM caso_especial ce JOIN caso c ON c.id_caso = ce.id_caso "
    "WHERE c.id_caso = ANY(%s)", (casos,))
print("Especiales restantes (debe ser 0):", cur.fetchone()[0])
conn.commit()
'''

SCRIPT_B64 = base64.b64encode(SCRIPT_PY.encode()).decode()

YAML = f"""apiVersion: run.googleapis.com/v1
kind: Job
metadata:
  name: ggto-borra-guatire
  annotations:
    run.googleapis.com/launch-stage: BETA
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/cloudsql-instances: ggto-prod-txblvento2:europe-west1:ggto-db
        run.googleapis.com/vpc-access-connector: ggto-connector
        run.googleapis.com/vpc-access-egress: private-ranges-only
    spec:
      taskTimeoutSeconds: 300
      template:
        spec:
          restartPolicy: Never
          containers:
          - image: europe-west1-docker.pkg.dev/ggto-prod-txblvento2/ggto/ggto-web:v106
            command: ["python", "-c"]
            args:
            - "import base64; exec(base64.b64decode('{SCRIPT_B64}').decode())"
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
            - name: APP_ENV
              value: production
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

salida = Path(__file__).parent / "_job_guatire.yaml"
salida.write_text(YAML, encoding="utf-8")
print(f"YAML generado: {salida}")
