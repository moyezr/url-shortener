# GitHub Actions CI/CD Plan

The production path for this project is:

1. GitHub receives a push or pull request.
2. GitHub Actions installs dependencies, runs tests, and builds TypeScript.
3. On `main`, GitHub Actions builds a multi-platform Docker image and pushes it to Docker Hub.
4. On `main`, GitHub Actions SSHes into EC2, pulls the exact image for that commit, restarts the container, and checks `/health`.

This is closer to production than building the app on EC2 because the server only runs released images. The build happens once in CI, and EC2 pulls the exact artifact that passed tests.

## Workflow Jobs

### `test`

Runs for pull requests and pushes to `main`.

It does three things:

- `npm ci`: installs dependencies exactly from `package-lock.json`.
- `npm test`: runs the Vitest/Supertest API tests.
- `npm run build`: confirms the TypeScript project compiles.

If this job fails, nothing gets pushed or deployed.

### `docker`

Runs only after `test` passes, and only for non-pull-request events.

It builds the `production` stage from the Dockerfile for both:

- `linux/amd64`: common EC2 architecture.
- `linux/arm64`: Apple Silicon and ARM servers.

It pushes two tags:

- `moyezr/url-shortener:sha-<commit>`: immutable deployment tag.
- `moyezr/url-shortener:latest`: convenient human tag.

The deployment uses the `sha-<commit>` tag because it points to one exact build.

### `deploy`

Runs only on `main`.

It connects to EC2 over SSH and runs the same kind of deployment you tested manually:

- pull the image
- stop the old container
- run the new container
- attach the persistent Docker volume
- bind the app to `127.0.0.1:3000`
- check `http://127.0.0.1:3000/health`

The app is still only publicly exposed through nginx on port `80`.

## GitHub Secrets To Add

In your GitHub repository, go to:

`Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`

Add these:

| Secret | Meaning |
| --- | --- |
| `DOCKERHUB_USERNAME` | Your Docker Hub username, probably `moyezr`. |
| `DOCKERHUB_TOKEN` | A Docker Hub access token, not your account password. |
| `EC2_HOST` | Your EC2 public IP or DNS name. |
| `EC2_USER` | Usually `ubuntu` for Ubuntu AMIs, or `ec2-user` for Amazon Linux. |
| `EC2_SSH_KEY` | Private key that can SSH into the EC2 instance. |
| `EC2_KNOWN_HOSTS` | Output of `ssh-keyscan -H <your-ec2-ip>`. |
| `EC2_ENV_FILE` | Optional. Full path to the env file on EC2. Defaults to `$HOME/url-shortener/.env.prod`. |

Generate `EC2_KNOWN_HOSTS` from your laptop:

```bash
ssh-keyscan -H 43.205.236.231
```

Copy the full output into the `EC2_KNOWN_HOSTS` secret.

## EC2 Preparation

On EC2, create the env file once:

```bash
mkdir -p ~/url-shortener
nano ~/url-shortener/.env.prod
```

It should contain runtime config, not build config:

```env
HOST=0.0.0.0
PORT=3000
BASE_URL=http://43.205.236.231
ADMIN_TOKEN=replace-this
```

The deployment workflow will read this file using Docker's `--env-file`.

## What To Observe

When you push to `main`, open the Actions tab and inspect each job:

- Did `test` fail before any deploy happened?
- What image tag did the `docker` job create?
- Did EC2 pull that same exact tag?
- Did the health check run after the new container started?

That is the mental model of CI/CD: tests protect the artifact, the registry stores the artifact, and deployment moves that artifact into production.
