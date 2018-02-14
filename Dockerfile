FROM node:8.2.1-alpine

WORKDIR /usr/src

RUN npm install -g @angular/cli@1.6.5

RUN ng new ias-display

WORKDIR /usr/src/ias-display

RUN npm install
