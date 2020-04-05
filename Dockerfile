FROM node:12.16.0

RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-unstable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

# Add user so we don't need --no-sandbox.
# same layer as npm install to keep re-chowned files from using up several hundred MBs more space
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /node_modules

RUN cd node_modules/puppeteer/.local-chromium/linux-722234/chrome-linux/ \
		&& chown root:root chrome_sandbox \
		&& chmod 4755 chrome_sandbox \
		&& cp -p chrome_sandbox /usr/local/sbin/chrome-devel-sandbox
ENV CHROME_DEVEL_SANDBOX /usr/local/sbin/chrome-devel-sandbox

COPY index.js index.js

# Run everything after as non-privileged user.
USER pptruser

CMD ["npm", "start"]
