FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY dasp.js ./

ENTRYPOINT ["node", "dasp.js"]
