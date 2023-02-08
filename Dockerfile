FROM node:16

ADD package.json package.json
RUN npm install
ADD . .

CMD ["npm","test"]
