const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const tar = require("tar-fs");

function createCompressedArchive(sourceFolder, outputFileName) {
  return new Promise((resolve, reject) => {
    const outputFilePath = path.resolve(outputFileName);

    const archive = tar.pack(sourceFolder);
    const gzip = zlib.createGzip();
    const output = fs.createWriteStream(outputFilePath);

    archive
      .pipe(gzip)
      .pipe(output)
      .on("finish", () => resolve(outputFilePath))
      .on("error", (err) => reject(err));
  });
}

module.exports = { createCompressedArchive };
