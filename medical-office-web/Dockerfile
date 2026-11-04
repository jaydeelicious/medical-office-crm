# syntax=docker/dockerfile:1

# Stage 1: Build Angular application
FROM node:24-alpine AS build

WORKDIR /app

# Install dependencies using the lockfile
COPY package.json package-lock.json ./
RUN npm ci

# Copy Angular source
COPY . .

# Build production application
RUN npm run build -- --configuration production

# Stage 2: Serve static files using Nginx
FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime

# Custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled Angular browser assets
COPY --from=build /app/dist/medical-office-web/browser/ /usr/share/nginx/html/

EXPOSE 8080