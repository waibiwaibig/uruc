[English](server-ops.md) | [中文](server-ops.zh-CN.md)

# External Server Ops

`uruc configure` is intentionally limited to city runtime state. It does not manage:

- nginx or other reverse proxies
- SSL / certbot
- systemd unit installation
- landing pages or multi-site topology

Use external ops tooling for those concerns. Typical responsibilities include:

- placing the built static landing page in a web root
- reverse-proxying the city runtime to a domain or subpath
- provisioning certificates
- installing or supervising the runtime as a service

The runtime-side values that external ops usually need are:

- `BASE_URL`
- `BIND_HOST`
- `PORT`
- `WS_PORT`
- `APP_BASE_PATH`

If you build a companion installer for your own environment, keep it outside the main `uruc` CLI surface so the public CLI remains portable across local, LAN, and server use cases.
