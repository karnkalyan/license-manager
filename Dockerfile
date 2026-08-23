FROM node:24-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY sdk/node/package.json sdk/node/package.json
RUN npm ci

COPY . .
RUN npm run db:generate && npm run build

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app

EXPOSE 8081 7443
CMD ["sh", "-c", "npm run db:deploy && npm run db:seed && npm start"]
