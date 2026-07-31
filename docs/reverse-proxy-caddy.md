# Reverse proxy — Caddy

Configuration recommandée pour servir CEIL en production avec Caddy.

## Fichier

`/etc/caddy/Caddyfile`

```caddy
{
  # TLS automatique via Let's Encrypt — retirer si certificats manuels
  acme_ca https://acme-v02.api.letsencrypt.org/directory
}

ceil.univ-mosta.dz {
  # Taille maximale des uploads (gabarits ODT, imports Excel)
  request_body_max_size 10MB

  # En-têtes de sécurité
  header {
    Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "strict-origin-when-cross-origin"
    Permissions-Policy "camera=(), microphone=(), geolocation=()"
    # CSP adaptée à Next.js + shadcn/ui
    Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';"
  }

  # Rate limiting — protéger le login et les API sensibles
  route {
    # Login : 5 requêtes par minute par IP
    @login {
      path /api/auth/*
    }
    rate_limit @login {
      zone login 10m 5r/m
    }

    # API générale : 60 requêtes par minute par IP
    @api {
      path /api/*
    }
    rate_limit @api {
      zone api 10m 60r/m
    }

    # Reverse proxy vers l'application
    reverse_proxy 127.0.0.1:3000 {
      header_up Host              {host}
      header_up X-Real-IP         {remote_host}
      header_up X-Forwarded-For   {remote_host}
      header_up X-Forwarded-Proto {scheme}
      transport http {
        keepalive 32
      }
    }
  }

  # Fichiers statiques Next.js — cache long
  handle_path /_next/static/* {
    reverse_proxy 127.0.0.1:3000
    cache {
      status_code 200
      max_age 365d
      immutable
    }
  }

  # Sonde de santé — accessible sans auth
  handle /api/health {
    reverse_proxy 127.0.0.1:3000
  }

  # Logs
  log {
    output file /var/log/caddy/ceil.log {
      roll_size 100MB
      roll_keep 10
      roll_keep_for 720h
    }
    format json
  }
}
```

## Activation

```bash
caddy fmt --overwrite /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

## Notes

- Caddy gère **automatiquement** les certificats TLS via Let's Encrypt. Pour
  des certificats manuels, retirer le bloc global `acme_ca` et ajouter
  `tls /chemin/vers/cert.pem /chemin/vers/key.pem` dans le bloc du site.
- Le **rate limiting** de Caddy est plus simple que celui d'nginx mais suffit
  pour protéger le login (`/api/auth/*`) et le reste de l'API (`/api/*`).
- `request_body_max_size 10MB` couvre les gabarits ODT et les imports Excel.
- Le **logging JSON** natif de Caddy est directement exploitable par la plupart
  des agrégateurs (ELK, Loki, Datadog). La rotation est automatique
  (`roll_size 100MB`, garde 10 fichiers).

## Comparaison avec nginx

| Critère                | Caddy                      | nginx                          |
| ---------------------- | -------------------------- | ------------------------------ |
| TLS automatique        | Oui                        | Non (Let's Encrypt manuel)     |
| Rate limiting          | Natif, simple              | Module `ngx_http_limit_req`    |
| CSP / headers          | Directive `header`         | `add_header`                   |
| Logs structurés        | JSON natif                 | `log_format` personnalisé      |
| Configuration          | Déclarative, concise       | Plus verbeuse                  |
| Performance brute      | Légèrement inférieure      | Meilleur sur les fichiers statiques |

Choisir Caddy pour la simplicité (TLS automatique, config courte), nginx si
l'infrastructure l'exige déjà ou si la performance statique est critique.
