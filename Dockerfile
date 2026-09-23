# syntax=docker/dockerfile:1

# ---- 依赖安装（构建期与校验期共用） ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- 静态构建：tsc 类型检查 + vite 打包 ----
FROM deps AS build
COPY . .
RUN npm run build

# ---- 静态 Web：nginx 托管，提供 /health 健康检查 ----
FROM nginx:1.27-alpine AS web
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1

# ---- 一次性校验服务：代码测试 + 构建检查 + HTTP 冒烟，以退出码报告 ----
FROM deps AS verify
COPY . .
ENV WEB_URL=http://web:80
CMD ["sh", "scripts/verify.sh"]
