# 호스팅 모드 이미지: 화면만 빌드해 정적 파일로 제공한다. 로그인과 데이터는 같은 사이트의 API가 맡는다.
FROM node:24-alpine AS build
WORKDIR /app/mobile

COPY mobile/package.json mobile/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY mobile ./
COPY shared /app/shared
# 앱을 여는 경로(운영은 서브도메인 전체라 /)와 데이터 API 경로.
# 로그인과 데이터는 VITE_JPC_SITE_ORIGIN 사이트로 보낸다. 비우면 화면과 같은 주소의 API를 쓴다
ARG JPC_BASE_PATH=/
ARG VITE_JPC_HOSTED_API_BASE=/api/companions/japanese
# 공지 대상 앱 ID(jace-s apps 테이블). 비우면 모든 앱 대상 공지만 받는다
ARG VITE_JPC_NOTICE_APP_ID=
ARG VITE_JPC_SITE_ORIGIN=
# 로그인과 데이터 API 주소. 비우면 VITE_JPC_SITE_ORIGIN을 쓴다
ARG VITE_JPC_API_ORIGIN=
ENV CI=1 EXPO_PUBLIC_JPC_NOTICE_APP_ID=${VITE_JPC_NOTICE_APP_ID} EXPO_PUBLIC_JPC_SITE_ORIGIN=${VITE_JPC_SITE_ORIGIN} EXPO_PUBLIC_JPC_API_ORIGIN=${VITE_JPC_API_ORIGIN}
RUN npm run export:web

FROM node:24-alpine AS runner
WORKDIR /app
ARG JPC_BASE_PATH=/
ENV NODE_ENV=production HOST=0.0.0.0 PORT=80 BASE_PATH=${JPC_BASE_PATH} STATIC_DIR=/app/dist

COPY scripts/serve-static.mjs ./serve-static.mjs
COPY --from=build /app/mobile/dist/web ./dist

EXPOSE 80
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "serve-static.mjs"]
