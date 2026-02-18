#!/usr/bin/env bash
set -euo pipefail

PROJECT="diesel-media-485505-e2"
REGION="us-central1"
SERVICE="gentle-path-api"
IMAGE="us-central1-docker.pkg.dev/${PROJECT}/gentle-path-repo/gentle-path-backend:latest"

# 1) Build image in Cloud Build (no local docker needed)
gcloud builds submit \
  --tag "${IMAGE}" \
  --project "${PROJECT}"

# 2) Deploy image to Cloud Run
gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --project "${PROJECT}"

# 3) Re-apply the known-good service config (keeps DB + SUPPORT env vars from disappearing)
gcloud run services replace cloudrun-service.yaml \
  --project "${PROJECT}" \
  --region "${REGION}"

echo "Done: deployed + reapplied cloudrun-service.yaml"
