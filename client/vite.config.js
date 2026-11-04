import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { getDevServerConfig, mobileAccessPlugin } from "./dev-mobile-access.js";

// 호스팅 모드에서 앱을 여는 경로. 운영은 서브도메인 전체라 "/", 개발 환경은 하위 경로(예: /jlpt-companion/)를 JPC_BASE_PATH로 준다.
function readBasePath() {
  // 앞뒤 슬래시를 떼고 비면 루트로 둔다. "/"가 "//"가 되면 파일 주소가 다른 호스트로 읽힌다
  const trimmed = String(process.env.JPC_BASE_PATH ?? "").trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}/` : "/";
}

function readApiPort() {
  const rawPort = process.env.JPC_API_PORT ?? "3001";
  const port = Number(rawPort);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : 3001;
}

export default defineConfig({
  base: readBasePath(),
  plugins: [mobileAccessPlugin(), react()],
  build: { sourcemap: false },
  server: {
    ...getDevServerConfig(),
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${readApiPort()}`,
        changeOrigin: true,
      },
    },
  },
});
