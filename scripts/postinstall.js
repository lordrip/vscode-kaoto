const fetch = require('node-fetch');
const fs = require('fs');
const os = require('os');

const downloadFile = (async (url, path) => {
  console.log(`Will fetch backend binary from ${url}`);
  const res = await fetch(url);
  const fileStream = fs.createWriteStream(path);
  await new Promise((resolve, reject) => {
      res.body.pipe(fileStream);
      res.body.on("error", reject);
      fileStream.on("finish", resolve);
  });
  fs.chmodSync(path, "766");
});

const downloadKaotoBackendNativeExecutable = (backendVersion, platform, extension) => {
	downloadFile(`https://github.com/KaotoIO/kaoto-backend/releases/download/${backendVersion}/kaoto-${platform}`, `./binaries/kaoto-${platform}${extension}`);
}

const backendVersion = "v0.5.1";
downloadKaotoBackendNativeExecutable(backendVersion, 'linux-amd64', '');
downloadKaotoBackendNativeExecutable(backendVersion, 'macos-amd64', '');
downloadKaotoBackendNativeExecutable(backendVersion, 'windows-amd64', '.exe');
