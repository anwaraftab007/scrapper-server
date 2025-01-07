const axios = require("axios");
const cheerio = require("cheerio");
const url = require("url");

class WebsiteCrawler {
  constructor() {
    this.visited = new Set();
  }

  async crawl(targetUrl, baseDomain) {
    if (this.visited.has(targetUrl)) return [];
    this.visited.add(targetUrl);

    const crawledLinks = [];
    try {
      const { data: htmlContent } = await axios.get(targetUrl);
      const $ = cheerio.load(htmlContent);

      $("a[href]").each((_, element) => {
        let href = $(element).attr("href");
        if (href) {
          const absoluteUrl = url.resolve(targetUrl, href);
          if (absoluteUrl.startsWith(baseDomain) && !absoluteUrl.includes("#")) {
            const normalizedUrl = absoluteUrl.split("?")[0];
            crawledLinks.push(normalizedUrl);
          }
        }
      });

      const uniqueLinks = [...new Set(crawledLinks)];
      for (const link of uniqueLinks) {
        const nestedLinks = await this.crawl(link, baseDomain);
        uniqueLinks.push(...nestedLinks);
      }

      return [...new Set(uniqueLinks)];
    } catch (error) {
      console.error(`Error crawling ${targetUrl}: ${error.message}`);
      return [];
    }
  }
}

module.exports = WebsiteCrawler;
