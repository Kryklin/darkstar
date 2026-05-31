FROM node:20-slim AS builder

WORKDIR /app
COPY node/package*.json node/tsconfig.json node/build.js ./
RUN npm install

COPY node/src/ ./src/
COPY wasm/ ./wasm/
RUN npm run build

FROM node:20-slim
WORKDIR /app

COPY node/package*.json ./
RUN npm install --production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/wasm/dasp_crypto.wasm ./dasp_crypto.wasm

ENTRYPOINT ["node", "dist/main.js"]
