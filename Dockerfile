FROM node:24-alpine AS dev

WORKDIR /app

COPY package*.json tsconfig.json ./

RUN npm ci

COPY . .

ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "run", "dev"]

FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./

RUN npm ci

COPY src ./src

RUN npm run build

FROM node:24-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

RUN mkdir -p data

EXPOSE 3000

CMD ["node", "dist/src/server.js"]

