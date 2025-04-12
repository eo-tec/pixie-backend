FROM node:20-alpine

WORKDIR /app
COPY . .
RUN npm install

RUN npm run prisma:generate

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
