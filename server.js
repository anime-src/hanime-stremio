#!/usr/bin/env node

const express = require("express");
const { getRouter } = require("stremio-addon-sdk");
const landingTemplate = require("stremio-addon-sdk/src/landingTemplate");
const addonInterface = require("./addon");
const axios = require("axios"); // replaced request with axios

serveHTTP(addonInterface, { port: process.env.PORT || 61327 });

function serveHTTP(addonInterface, opts = {}) {
  const app = express();

  app.use(getRouter(addonInterface));

  const landingHTML = landingTemplate(addonInterface.manifest);
  app.get("/", (_, res) => {
    res.setHeader("content-type", "text/html");
    res.end(landingHTML);
  });

  // Proxy images to hanime CDN.
  // This is needed because hanime blocks requests without proper headers and Stremio doesn't allow setting custom headers for poster requests.
  app.get("/proxy/images/:type/:image", async (req, res) => {
    const imageUrl = `https://hanime-cdn.com/images/${req.params.type}/${req.params.image}`;
    try {
      const response = await axios.get(imageUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36",
          Accept:
            "image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5",
          "Accept-Language": "en-US,en;q=0.5",
          "Sec-GPC": "1",
          "Sec-Fetch-Dest": "image",
          "Sec-Fetch-Mode": "no-cors",
          "Sec-Fetch-Site": "cross-site",
          Priority: "u=4, i",
          Pragma: "no-cache",
          "Cache-Control": "no-cache",
          Referer: "https://hanime.tv/",
        },
        responseType: "stream",
      });
      res.set(response.headers);
      response.data.pipe(res);
    } catch (err) {
      res.status(502).send("Failed to proxy image");
    }
  });

  const server = app.listen(opts.port);

  return new Promise(function (resolve, reject) {
    server.on("listening", function () {
      const baseUrl = `http://127.0.0.1:${server.address().port}`;
      if (!process.env.PUBLIC_URL) {
        process.env.PUBLIC_URL = baseUrl;
      }
      const url = `${baseUrl}/manifest.json`;
      console.log("HTTP addon accessible at:", url);
      resolve({ url, server });
    });
    server.on("error", reject);
  });
}
