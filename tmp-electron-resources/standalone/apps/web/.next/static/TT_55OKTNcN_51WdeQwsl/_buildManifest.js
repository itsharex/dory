self.__BUILD_MANIFEST = {
  "__rewrites": {
    "afterFiles": [
      {
        "source": "/healthz",
        "destination": "/api/health"
      },
      {
        "source": "/api/healthz",
        "destination": "/api/health"
      },
      {
        "source": "/health",
        "destination": "/api/health"
      },
      {
        "source": "/ping",
        "destination": "/api/health"
      },
      {
        "source": "/ingest/static/:path*"
      },
      {
        "source": "/ingest/:path*"
      }
    ],
    "beforeFiles": [],
    "fallback": []
  },
  "sortedPages": [
    "/_app",
    "/_error"
  ]
};self.__BUILD_MANIFEST_CB && self.__BUILD_MANIFEST_CB()