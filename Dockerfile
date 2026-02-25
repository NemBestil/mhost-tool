FROM node:24 AS build
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y python3 make g++

COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build



FROM node:24 AS final
WORKDIR /app
COPY package*.json ./

COPY --from=build /app/.output ./.output
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/node_modules ./node_modules

RUN mkdir -p /app/uploads /app/data

EXPOSE 3000

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node .output/server/index.mjs"]
