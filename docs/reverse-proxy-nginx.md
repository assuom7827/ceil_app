# Reverse proxy — nginx

Configuration recommandée pour servir CEIL en production avec nginx.

## Fichier

`/etc/nginx/sites-available/ceil`

```nginx
upstream ceil_app {
  server 127.0.0.1:3000;
  keepalive 32;
}

server {
  listen 80;
  listen [::]:80;
  server_name ceil.univ-mosta.dz;

  # Taille maximale des uploads (gabarits ODT, imports Excel)
  client_max_body_size 10m;

  # Redirection vers HTTPS
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name ceil.univ-mosta.dz;

  # ---------------------------------------------------------------------------
  # TLS — remplacer par vos certificats réels
  # ---------------------------------------------------------------------------
  ssl_certificate     /etc/letsencrypt/live/ceil.univ-mosta.dz/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/ceil.univ-mosta.dz/privkey.pem;
  ssl_protocols       TLSv1.2 TLSv1.3;
  ssl_ciphers         HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;
  ssl_session_cache   shared:SSL:10m;
  ssl_session_timeout 1d;

  # ---------------------------------------------------------------------------
  # En-têtes de sécurité
  # ---------------------------------------------------------------------------
  add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
  add_header X-Content-Type-Options      "nosniff"              always;
  add_header X-Frame-Options             "DENY"                 always;
  add_header Referrer-Policy             "strict-origin-when-cross-origin" always;
  add_header Permissions-Policy          "camera=(), microphone=(), geolocation=()" always;
  # CSP adaptée à Next.js + shadcn/ui + LibreOffice (pour les attestations PDF)
  add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';" always;

  # ---------------------------------------------------------------------------
  # Rate limiting — protéger le login et les API sensibles
  # ---------------------------------------------------------------------------
  limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
  limit_req_zone $binary_remote_addr zone=api:10m rate=60r/m;

  # ---------------------------------------------------------------------------
  # Fichiers statiques — servis directement par nginx
  # ---------------------------------------------------------------------------
  location /_next/static/ {
    proxy_pass http://ceil_app;
    expires 365d;
    add_header Cache-Control "public, immutable";
  }

  location /favicon.ico {
    proxy_pass http://ceil_app;
    expires 7d;
  }

  # ---------------------------------------------------------------------------
  # Application — tout le reste
  # ---------------------------------------------------------------------------
  location / {
    proxy_pass http://ceil_app;

    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # WebSocket (Next.js HMR en dev, jamais en production)
    proxy_http_version 1.1;
    proxy_set_header Upgrade    $http_upgrade;
    proxy_set_header Connection "upgrade";

    # Timeouts
    proxy_connect_timeout 10s;
    proxy_send_timeout    60s;
    proxy_read_timeout    60s;

    # Rate limiting — plus strict sur l'authentification
    location ~ ^/api/auth/ {
      limit_req   zone=login burst=3 nodelay;
      proxy_pass  http://ceil_app;
    }

    limit_req   zone=api burst=20 nodelay;
  }

  # ---------------------------------------------------------------------------
  # Sonde de santé — accessible sans auth, limitée
  # ---------------------------------------------------------------------------
  location = /api/health {
    limit_req   zone=api burst=5 nodelay;
    proxy_pass  http://ceil_app;
  }

  # ---------------------------------------------------------------------------
  # Logs
  # ---------------------------------------------------------------------------
  access_log /var/log/nginx/ceil.access.log;
  error_log  /var/log/nginx/ceil.error.log warn;
}
```

## Activation

```bash
ln -s /etc/nginx/sites-available/ceil /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

## Notes

- Le **rate limiting** du login (`/api/auth/`) est volontairement plus strict
  (5 req/min) que le reste de l'API (60 req/min) pour ralentir les tentatives
  de brute-force.
- `client_max_body_size 10m` couvre les gabarits ODT et les imports Excel.
  Ajuster si nécessaire.
- `Content-Security-Policy` autorise `'unsafe-inline'` et `'unsafe-eval'` pour
  Next.js et les composants Radix. Un CSP plus strict nécessiterait un
  `nonce` par requête, ce que Next.js supporte via
  [`contentSecurityPolicy`](https://nextjs.org/docs/app/guides/content-security-policy)
  dans `next.config.ts`.
