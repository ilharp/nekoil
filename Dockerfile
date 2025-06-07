FROM ilharp/cordis-base:0.0.2

WORKDIR /cordis
COPY . /cordis
RUN ["corepack", "yarn", "--immutable"]
RUN ["corepack", "yarn", "build"]
RUN ["corepack", "yarn", "workspace", "nekoil-cpssr", "build"]
# RUN ["corepack", "yarn", "node", "-r", "esbuild-register", "scripts/prepare.mts"]
RUN ["rm", "-rf", "node_modules"]

FROM ilharp/cordis-base:0.0.2

WORKDIR /cordis
COPY --from=0 /cordis /cordis
RUN ["corepack", "yarn", "--immutable"]
