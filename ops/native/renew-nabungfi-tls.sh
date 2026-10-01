#!/usr/bin/env bash
set -euo pipefail
# Certbot deploy hook: reload only for this certificate's successful renewal.
[[ "${RENEWED_LINEAGE:-}" == /etc/letsencrypt/live/nabungfi-api.endpx.cloud ]] || exit 0
/usr/sbin/nginx -t
/usr/bin/systemctl reload nginx
