const { getDefaultConfig } = require("expo/metro-config");
const { createProxyMiddleware } = require("http-proxy-middleware");

const config = getDefaultConfig(__dirname);

const apiProxy = createProxyMiddleware({
  target: "http://localhost:5000",
  changeOrigin: true,
  ws: true,
  logger: undefined,
});

config.server = {
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      if (req.url && (req.url.startsWith("/api/") || req.url.startsWith("/socket.io/") || req.url.startsWith("/uploads/"))) {
        return apiProxy(req, res, next);
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
