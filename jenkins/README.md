# Medical Office CRM — Jenkins CI

This directory contains the custom Jenkins build-agent configuration for the project.

## Architecture

The local Jenkins environment consists of:

- **Jenkins controller:** Runs the Jenkins server and manages pipeline execution.
- **Jenkins build agent:** Provides .NET 10, Node.js 24, npm and the Docker CLI.
- **SQL Server 2022:** Provides an isolated database for backend integration tests.
- **Docker-in-Docker:** Builds production Docker images using a dedicated Docker daemon with TLS.

## Pipeline

The repository-root `Jenkinsfile` defines the following checks:

1. Backend dependency restoration and Release build.
2. Backend automated tests using SQL Server.
3. Angular dependency installation.
4. Angular unit tests using a CI-specific Vitest configuration.
5. Angular linting and production build.
6. Backend and frontend Docker image builds.

## Automatic builds

Jenkins uses SCM polling:

`H/5 * * * *`

The pipeline checks the configured Git branch approximately every five minutes and starts a build when new commits are detected.

## Credentials

The SQL Server password is stored in Jenkins Credentials under:

`medicaloffice-jenkins-sql-password`

Jenkins agent authentication uses a separate Jenkins-generated inbound-agent secret.

Neither credential should be committed to the repository.

## Security notes

- Jenkins is exposed only on the local development machine.
- SQL Server is not exposed publicly.
- Docker-in-Docker uses TLS for communication with the Jenkins agent.
- Docker-in-Docker requires privileged execution in this local setup.
- The build agent should execute only trusted repository code.
- Docker images are built for validation and are not automatically published or deployed.

## GitHub Actions

GitHub Actions remains the primary hosted CI solution. Jenkins provides an additional, self-managed CI implementation for development and learning.
