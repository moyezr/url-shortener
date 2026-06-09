# URL Shortener

Small backend for learning raw EC2 deployment.

It uses Express with TypeScript, then compiles to JavaScript before running. The deployment still stays intentionally manual: EC2, SSH, npm, systemd, nginx, and logs.

## API

- `GET /health`
- `POST /api/shorten`
- `GET /api/links`
- `GET /:slug`

Create a link:

```sh
curl -X POST http://127.0.0.1:3000/api/shorten \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","slug":"example"}'
```

If `ADMIN_TOKEN` is set, include it:

```sh
curl -X POST http://127.0.0.1:3000/api/shorten \
  -H 'Content-Type: application/json' \
  -H 'X-Admin-Token: change-me' \
  -d '{"url":"https://example.com","slug":"example"}'
```

## Run Locally

Tests use Vitest with Supertest. Supertest calls the Express app directly, so tests do not need to start a real port.

```sh
cd projects/url-shortener
npm install
npm test
npm run build
ADMIN_TOKEN=change-me BASE_URL=http://localhost:3000 npm start
```

In another terminal:

```sh
curl http://127.0.0.1:3000/health
```

## Manual AWS Deployment

Use AWS EC2 only for this first pass. Do not use Terraform, Docker, Elastic Beanstalk, ECS, or GitHub Actions yet.

Official references:

- EC2 launch wizard: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-launch-instance-wizard.html
- Connect to Linux instance using SSH: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/connect-to-linux-instance.html
- Security group rules: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules.html

### 1. Launch EC2 Manually

Recommended settings for this exercise:

- Region: pick one close to you and keep using it.
- AMI: Ubuntu Server LTS or Amazon Linux.
- Instance type: free-tier eligible small instance if available in your account.
- Storage: default is fine.
- Key pair: create or select one you can SSH with.
- Security group inbound:
  - SSH `22` from your current IP only.
  - HTTP `80` from anywhere.
  - HTTPS `443` from anywhere later, after adding TLS.

After launch, copy the public IPv4 address or public DNS name.

### 2. SSH Into the Instance

Ubuntu example:

```sh
chmod 400 ~/Downloads/your-key.pem
ssh -i ~/Downloads/your-key.pem ubuntu@YOUR_PUBLIC_IP
```

Amazon Linux example:

```sh
chmod 400 ~/Downloads/your-key.pem
ssh -i ~/Downloads/your-key.pem ec2-user@YOUR_PUBLIC_IP
```

### 3. Install Runtime Packages

Ubuntu:

```sh
sudo apt update
sudo apt install -y nodejs npm nginx git
node --version
nginx -v
```

Amazon Linux:

```sh
sudo dnf update -y
sudo dnf install -y nodejs npm nginx git
node --version
nginx -v
```

### 4. Put the App on the Server

For the first manual pass, copying files is acceptable.

From your laptop:

```sh
scp -i ~/Downloads/your-key.pem -r projects/url-shortener ubuntu@YOUR_PUBLIC_IP:/home/ubuntu/url-shortener
```

On the server:

```sh
cd ~/url-shortener
npm install
npm test
npm run build
ADMIN_TOKEN='change-me' BASE_URL='http://YOUR_PUBLIC_IP' npm start
```

In a second SSH session:

```sh
curl http://127.0.0.1:3000/health
```

Stop the foreground server with `Ctrl+C` after the health check works.

### 5. Create a systemd Service

Create the service file:

```sh
sudo nano /etc/systemd/system/url-shortener.service
```

Paste this for Ubuntu:

```ini
[Unit]
Description=URL shortener backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/url-shortener
Environment=PORT=3000
Environment=ADMIN_TOKEN=change-me
Environment=BASE_URL=http://YOUR_PUBLIC_IP
Environment=LINKS_FILE=/home/ubuntu/url-shortener/data/links.json
ExecStart=/usr/bin/node /home/ubuntu/url-shortener/dist/src/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

For Amazon Linux, change `User=ubuntu` and paths from `/home/ubuntu` to `/home/ec2-user`.

Start it:

```sh
sudo systemctl daemon-reload
sudo systemctl enable url-shortener
sudo systemctl start url-shortener
sudo systemctl status url-shortener
curl http://127.0.0.1:3000/health
```

Useful debugging commands:

```sh
sudo journalctl -u url-shortener -n 50
sudo journalctl -u url-shortener -f
```

### 6. Put nginx in Front

Create an nginx site:

```sh
sudo nano /etc/nginx/sites-available/url-shortener
```

Paste:

```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable it on Ubuntu:

```sh
sudo ln -s /etc/nginx/sites-available/url-shortener /etc/nginx/sites-enabled/url-shortener
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

On Amazon Linux, nginx usually uses `/etc/nginx/conf.d/*.conf` instead:

```sh
sudo nano /etc/nginx/conf.d/url-shortener.conf
sudo nginx -t
sudo systemctl restart nginx
```

From your laptop:

```sh
curl http://YOUR_PUBLIC_IP/health
curl -X POST http://YOUR_PUBLIC_IP/api/shorten \
  -H 'Content-Type: application/json' \
  -H 'X-Admin-Token: change-me' \
  -d '{"url":"https://example.com","slug":"example"}'
curl -I http://YOUR_PUBLIC_IP/example
```

### 7. What You Should Understand Before Moving On

- EC2 is the virtual machine.
- The security group decides whether traffic can reach the machine.
- SSH lets you administer the machine.
- Node listens only on `127.0.0.1:3000`, so it is private to the server.
- nginx listens on public port `80`.
- nginx forwards public HTTP traffic to the private backend port.
- systemd starts the backend at boot and restarts it if it crashes.
- `journalctl` shows backend logs.
- nginx logs show reverse proxy and HTTP request issues.

### 8. Cost Cleanup

When done for the day, stop or terminate the EC2 instance from the AWS console. Stopped instances can still incur storage charges for attached EBS volumes, but the running compute charge stops.
