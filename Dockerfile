FROM node:onbuild

COPY example.json /etc/git2consul.json

ENV CONSUL_ENDPOINT 127.0.0.1
ENV CONSUL_PORT 8500

CMD [ "node", "index.js", "--config-file", "/etc/git2consul.json" ]
