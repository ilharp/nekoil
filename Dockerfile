FROM ilharp/cordis-base:0.0.2

WORKDIR /cordis
COPY . /cordis
RUN ["rm", "-rf", "packages/sym", "packages/web"]
RUN ["corepack", "yarn"]
RUN ["corepack", "yarn", "build"]
RUN ["corepack", "yarn", "node", "-r", "esbuild-register", "scripts/prepare.mts"]
RUN ["rm", "-rf", "node_modules"]
RUN ["corepack", "yarn"]

FROM ilharp/cordis-base:0.0.2

WORKDIR /cordis
COPY --from=0 /cordis /cordis
RUN ["corepack", "yarn"]
CMD ["corepack", "yarn", "start"]
