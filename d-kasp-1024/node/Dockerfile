FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY darkstar_crypt.js ./

ENTRYPOINT ["node", "darkstar_crypt.js"]
