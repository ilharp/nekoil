FROM ilharp/cordis-base:1.0.0

WORKDIR /cordis
COPY . /cordis
RUN ["rm", "-rf", "packages/web"]
RUN ["rm", "-rf", "packages/sym/yarn.lock"]
RUN ["corepack", "yarn"]
RUN ["corepack", "yarn", "build"]
RUN ["corepack", "yarn", "workspace", "@sym-app/components", "build"]
RUN ["corepack", "yarn", "workspace", "nekoil-cpssr", "build"]
RUN ["corepack", "yarn", "tsx", "scripts/prepare.mts", "koishi.yml"]
RUN find . -name "node_modules" -type d -prune -exec rm -rf '{}' +

FROM ilharp/cordis-base:1.0.0

WORKDIR /cordis
COPY --from=0 /cordis /cordis
RUN ["corepack", "yarn"]
