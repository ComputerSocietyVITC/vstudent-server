FROM node:18-alpine

COPY . .
RUN apk add chromium
RUN yarn

CMD ["yarn", "start"]
EXPOSE 3000