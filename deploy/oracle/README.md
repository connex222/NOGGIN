# NOGGIN on an Oracle Cloud Compute VM

This runs **one** private Node process behind the Caddy HTTPS reverse proxy. The supplied Docker Compose stack works on both AMD64 and ARM64, including Oracle Ampere A1.

1. Create an Oracle Cloud Always Free-eligible Compute VM with a public IPv4 address. Choose Ubuntu 24.04 (for the shell examples below) and save your SSH private key. Confirm the selected shape is actually **Always Free eligible** and available in your home region; availability is not guaranteed.
2. Create a DNS A record such as `noggin.yourdomain.co.uk` pointing to the VM's public IPv4 address.
3. In the Oracle Cloud **Network Security Group** or subnet security list, allow inbound TCP **80 and 443**. Allow SSH **22 only from your own IP**. Also permit 80/443 at the VM's OS firewall where enabled. Do *not* expose Node's port 3000 on the public internet.
4. Connect to the VM by SSH. Install Docker Engine and Docker Compose plugin using their official Ubuntu installation instructions: https://docs.docker.com/engine/install/ubuntu/ . The steps require `sudo`, Docker's package repository, and a machine restart or daemon start.
5. Copy/extract this project to a directory on the VM, for example `/home/ubuntu/noggin`. From that directory run:

```sh
cp deploy/oracle/.env.example .env
nano .env    # set NOGGIN_DOMAIN to YOUR real public DNS name
sudo docker compose up -d --build
sudo docker compose ps
sudo docker compose logs --tail=100 noggin
```

6. Visit `https://noggin.yourdomain.co.uk/tv/` on a browser. Open `/play/` on phones from any internet connection. QR codes use `NOGGIN_PUBLIC_URL` supplied automatically by Compose.
7. On updates, back up the private persistent `noggin_state` volume and `sudo docker compose up -d --build`. Beware active rounds may pause/restart. The saved state is a best-effort checkpoint taken about every five seconds; it is not transactional or distributed.

**Security and operational limits:** TLS certificates from Caddy need a resolvable DNS name with incoming 80/443. Secure your SSH key, run OS security updates, and keep this service single-instance. A domain name is not provided in the ZIP. Oracle may reclaim idle Always Free compute instances; free shapes can also be out of capacity. Server restart may lose recent progress. This is a hobby deployment guide, not a production uptime guarantee.

**Never run multiple NOGGIN backends against the same checkpoint volume.** Render and Oracle are separate room namespaces until a central room-store/coordination architecture is implemented.
