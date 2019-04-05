# This Dockerfile uses the stock node container for Node.js, release 8.X (latest)

FROM node:8-jessie

# install ssh for npm git and curl
RUN apt-get update && apt-get -y install ssh curl libc6 libssl1.0.0 libncurses5 libtinfo5 \
    zlib1g libbz2-1.0 libreadline6 libstdc++6 libgcc1 ghostscript imagemagick libmysqlclient18 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# https://github.com/nodejs/docker-node/issues/479#issuecomment-319446283
# and https://github.com/nodejs/docker-node/blob/master/docs/BestPractices.md#global-npm-dependencies
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
# optionally if you want to run npm global bin without specifying path
ENV PATH=$PATH:/home/node/.npm-global/bin
ENV NODE_ENV="production"

# allow node user to bind to port 80 https://gist.github.com/firstdoit/6389682
# note this doesn't work beyond Debian jesse
RUN setcap 'cap_net_bind_service=+ep' `which node`

RUN npm install -g forever

# Copy app's source code to the /app directory
COPY ./app /home/node/app

# The application's directory will be the working directory
WORKDIR /home/node/app

# Install Node.js dependencies defined in '/app/packages.json'
RUN npm install

# EXPOSE 4001

RUN chown -R node:node ./logs && chown node:node ./encoding

USER node

# Start the application
CMD forever -l ./logs/server.log -o ./logs/out.log -e ./logs/err.log app.js