FROM centos:7 as builder

# install chromium to run karma tests
COPY google-chrome.repo /etc/yum.repos.d/
RUN yum update -y && \
  yum install -y google-chrome-stable && \
  yum clean all
ENV CHROME_BIN=/opt/google/chrome/chrome \
  CHROME_PATH=/opt/google/chrome

# install nodejs
RUN sh -c "curl --silent --location https://rpm.nodesource.com/setup_8.x | bash -" && \
  yum install -y nodejs gcc-c++ make

# create project folder
RUN useradd --user-group --create-home --shell /bin/false node && \
  mkdir -p /usr/src/ias-display && \
  chown node:node /usr/src/ias-display
WORKDIR /usr/src/ias-display

# install Angular CLI
USER node
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global \
  PATH="/home/node/.npm-global/bin:${PATH}"
RUN cd /home/node && \
  npm install -g @angular/cli@1.7.4

# install project requirements
COPY package.json .
COPY package-lock.json .
RUN npm install

# copy project files
COPY . .
EXPOSE 4200

# test and build project
RUN ng test --watch=false --single-run --browser=ChromeDocker && \
  npm run-script build-prod

# copy compiled files to smaller image
FROM centos:7
COPY --from=builder /usr/src/ias-display/dist /usr/src/ias-display/dist
VOLUME /usr/src/ias-display
