const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const { createCompressedArchive } = require("./tozip");
const WebsiteCrawler = require("./crawler");
const fs = require("fs");
const cheerio = require("cheerio");
const axios = require("axios");
const url = require("url");

const app = express();
app.use(bodyParser.json());

// Function to save HTML to a file
function saveHTMLToFile(htmlContent, filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, htmlContent);
}

// Function to extract assets (scripts, images, styles) from the page
function extractAssetUrls($, baseUrl) {
  const assetUrls = [];
  const resolveUrl = (relativeUrl) => url.resolve(baseUrl, relativeUrl);

  $("link[href], script[src], img[src]").each((_, element) => {
    const tagName = element.tagName.toLowerCase();
    let assetUrl = "";

    if (tagName === "link") {
      assetUrl = $(element).attr("href");
    } else if (tagName === "script" || tagName === "img") {
      assetUrl = $(element).attr("src");
    }

    if (assetUrl) {
      const absoluteUrl = resolveUrl(assetUrl);
      assetUrls.push(absoluteUrl);
    }
  });

  return assetUrls;
}

// Function to save assets
async function saveAssets(assetUrls, baseFolder, res) {
  for (const assetUrl of assetUrls) {
    try {
      const assetPath = url.parse(assetUrl).pathname;
      const filePath = path.join(baseFolder, assetPath);

      if (fs.existsSync(filePath)) {
        res.write(`Asset already exists, skipping: ${assetUrl}\n`);
        continue;
      }

      res.write(`Downloading ${assetUrl}...\n`);
      const response = await axios.get(assetUrl, { responseType: "arraybuffer" });
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, response.data);
      res.write(`Saved ${assetUrl} to ${filePath}\n`);
    } catch (error) {
      res.write(`Error saving ${assetUrl}: ${error.message}\n`);
    }
  }
}

// Endpoint for crawling
app.post("/crawl", async (req, res) => {
  const targetUrl = req.body.url;
  if (!targetUrl) {
    return res.status(400).send("URL is required!");
  }

  res.setHeader("Content-Type", "text/plain");

  const crawler = new WebsiteCrawler();
  const baseFolder = path.join(__dirname, "downloads", Date.now().toString());

  try {
    res.write(`Starting to crawl: ${targetUrl}\n`);
    const links = await crawler.crawl(targetUrl, new URL(targetUrl).origin);

    for (const link of links) {
      try {
        res.write(`Processing: ${link}\n`);
        const { data: pageHtml } = await axios.get(link);
        const $ = cheerio.load(pageHtml);

        const parsedLink = new URL(link);
        const fileName = parsedLink.pathname.endsWith("/")
          ? "index.html"
          : path.basename(parsedLink.pathname);
        const directory = parsedLink.pathname.endsWith("/")
          ? parsedLink.pathname
          : path.dirname(parsedLink.pathname);

        const filePath = path.join(baseFolder, directory, fileName);
        saveHTMLToFile(pageHtml, filePath);

        const assetUrls = extractAssetUrls($, link);
        await saveAssets(assetUrls, baseFolder, res);
      } catch (error) {
        res.write(`Error processing ${link}: ${error.message}\n`);
      }
    }

    const tarGzFile = `${baseFolder}.tar.gz`;
    await createCompressedArchive(baseFolder, tarGzFile);
    res.write(`All tasks completed successfully. Archive available at: ${tarGzFile}\n`);
    res.end();
  } catch (error) {
    res.write(`Error during crawling: ${error.message}\n`);
    res.end();
  }
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
