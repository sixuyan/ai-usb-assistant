// upload-oss.js - Upload files to Alibaba Cloud OSS
// Usage: node upload-oss.js <channel> <bucket> <endpoint> <accessKeyId> <accessKeySecret>
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const channel = process.argv[2];
const bucket = process.argv[3];
const endpoint = process.argv[4];
const accessKeyId = process.argv[5];
const accessKeySecret = process.argv[6];

async function putObject(objectKey, filePath) {
  return new Promise((resolve) => {
    const body = fs.readFileSync(filePath);
    const md5 = crypto.createHash('md5').update(body).digest('base64');

    // Format date as RFC 7231 (Sun, 18 May 2026 19:24:00 GMT)
    const d = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateStr = `${days[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, '0')} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')} GMT`;

    const contentType = objectKey.endsWith('.json') ? 'application/json'
      : objectKey.endsWith('.html') ? 'text/html'
      : 'application/octet-stream';

    const signedString = `PUT\n\n${contentType}\n${md5}\n${dateStr}\n/${bucket}/${objectKey}`;
    const signature = crypto.createHmac('sha1', accessKeySecret).update(signedString).digest('base64');
    const auth = `OSS ${accessKeyId}:${signature}`;

    const options = {
      hostname: bucket + '.' + endpoint,
      path: '/' + objectKey,
      method: 'PUT',
      headers: {
        'Authorization': auth,
        'Content-MD5': md5,
        'Content-Type': contentType,
        'Content-Length': body.length,
        'Date': dateStr
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('  OK: ' + objectKey);
        } else {
          console.log('  FAILED: ' + objectKey + ' (HTTP ' + res.statusCode + ')');
        }
        resolve();
      });
    });
    req.on('error', e => { console.log('  FAILED: ' + objectKey + ' - ' + e.message); resolve(); });
    req.write(body);
    req.end();
  });
}

async function main() {
  const baseDir = path.join(process.cwd(), 'releases', channel);
  const files = [];
  function walk(dir) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, f.name);
      if (f.isDirectory()) walk(full);
      else files.push(full);
    }
  }
  walk(baseDir);
  console.log(`Uploading ${files.length} files from ${baseDir}...`);

  for (const file of files) {
    const rel = path.relative(baseDir, file).replace(/\\/g, '/');
    await putObject(rel, file);
  }
  console.log('Upload complete!');
}

main().catch(e => { console.error(e); process.exit(1); });
