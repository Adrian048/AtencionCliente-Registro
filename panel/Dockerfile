# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Unprivileged nginx: runs as non-root on port 8080
FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Writes the webhook key include from the Docker secret at startup
COPY --chmod=755 docker/40-webhook-key.sh /docker-entrypoint.d/40-webhook-key.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
