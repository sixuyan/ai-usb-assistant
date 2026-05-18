// upload-oss.js - Upload files to Alibaba Cloud OSS via official SDK
// =========================================================================
// Requires: npm install ali-oss (added as devDependency in package.json)
// Usage: node scripts/upload-oss.js <channel> <bucket> <endpoint> <accessKeyId> <accessKeySecret>
//
// This replaces the hand-rolled REST API signing which was unreliable.
// The ali-oss SDK handles all signing, retries, and multipart uploads.
// =========================================================================

const OSS = require('ali-oss');
const fs = require('fs');
const path = require('path');

const channel = process.argv[2] || 'stable';
const bucket = process.argv[3] || process.env.OSS_BUCKET || 'ai-usb-updates';
const endpoint = process.argv[4] || process.env.OSS_ENDPOINT || 'oss-cn-hangzhou.aliyuncs.com';
const accessKeyId = process.argv[5] || process.env.OSS_ACCESS_KEY_ID;
const accessKeySecret = process.argv[6] || process.env.OSS_ACCESS_KEY_SECRET;

if (!accessKeyId || !accessKeySecret) {
    console.error('ERROR: OSS credentials not provided.');
    console.error('Set OSS_ACCESS_KEY_ID and OSS_ACCESS_KEY_SECRET environment variables.');
    console.error('Or pass as arguments: node upload-oss.js <channel> <bucket> <endpoint> <key> <secret>');
    process.exit(1);
}

const client = new OSS({
    region: endpoint.replace('.aliyuncs.com', '').replace('oss-', ''),
    accessKeyId,
    accessKeySecret,
    bucket,
    endpoint: `https://${endpoint}`,
    secure: true,
    timeout: 60000
});

async function uploadFile(localPath, ossKey) {
    try {
        const body = fs.readFileSync(localPath);
        const contentType = ossKey.endsWith('.json') ? 'application/json; charset=utf-8'
            : ossKey.endsWith('.html') ? 'text/html; charset=utf-8'
            : ossKey.endsWith('.js') ? 'application/javascript; charset=utf-8'
            : ossKey.endsWith('.css') ? 'text/css; charset=utf-8'
            : 'application/octet-stream';

        const result = await client.put(ossKey, body, {
            mime: contentType,
            headers: {
                'Cache-Control': ossKey.endsWith('manifest.json')
                    ? 'no-cache'
                    : 'public, max-age=31536000, immutable'
            }
        });
        console.log(`  OK: ${ossKey} (${result.res.statusCode})`);
        return true;
    } catch (err) {
        console.error(`  FAILED: ${ossKey} - ${err.message}`);
        return false;
    }
}

async function main() {
    console.log(`\nAI USB Assistant - OSS Upload`);
    console.log(`  Channel:  ${channel}`);
    console.log(`  Bucket:   ${bucket}`);
    console.log(`  Endpoint: ${endpoint}\n`);

    // Verify bucket access
    try {
        await client.getBucketInfo();
        console.log('  [OK] Bucket accessible\n');
    } catch (err) {
        console.error(`  [FAIL] Cannot access bucket: ${err.message}`);
        console.error('  Check credentials, bucket name, and network connectivity.');
        process.exit(1);
    }

    // --- Upload files from releases/<channel>/files/ ---
    const filesBaseDir = path.join(process.cwd(), 'releases', channel, 'files');
    const manifestDir = path.join(process.cwd(), 'releases', channel);

    const files = [];
    function walk(dir) {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else files.push(full);
        }
    }
    walk(filesBaseDir);

    if (files.length === 0) {
        console.log('  No files to upload. Run generate-manifest.ps1 -Upload first.');
    } else {
        console.log(`  Uploading ${files.length} files...`);
        let ok = 0, fail = 0;
        for (const file of files) {
            // releases/stable/files/system/scripts/boot.ps1
            // -> object key: system/scripts/boot.ps1
            const ossKey = path.relative(filesBaseDir, file).replace(/\\/g, '/');
            const success = await uploadFile(file, ossKey);
            if (success) ok++; else fail++;
        }
        console.log(`\n  Files: ${ok} uploaded, ${fail} failed`);
    }

    // --- Upload manifest.json ---
    const manifestPath = path.join(manifestDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
        console.log('\n  Uploading manifest...');
        const manifestKey = path.join('releases', channel, 'manifest.json').replace(/\\/g, '/');
        await uploadFile(manifestPath, manifestKey);
    } else {
        console.log('\n  [WARN] manifest.json not found - skipping');
    }

    console.log('\n  Upload complete!');
    console.log(`  Update URL: https://${bucket}.${endpoint}/releases/${channel}/manifest.json\n`);
}

main().catch(err => {
    console.error('FATAL:', err.message);
    process.exit(1);
});
