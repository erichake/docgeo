<?php
// Relays a figure file the page can't fetch itself: one from a site that
// doesn't allow it, or from Google Drive, which only serves it to a server.
// Only a public web address is ever read, never a local file or a machine of
// the server's network, the address being checked on each redirect, and on
// the very IP connected to.

const MAX_SIZE = 20 << 20;
const MAX_REDIRECTS = 3;

function fail(int $status): void
{
    http_response_code($status);
    exit;
}

// The IP to connect to, or null if the address isn't a public web one.
function publicIp(array $url): ?string
{
    if (!in_array($url['scheme'] ?? '', ['http', 'https'], true)
        || isset($url['port']) || isset($url['user']))
        return null;
    $ips = gethostbynamel($url['host'] ?? '') ?: [];
    foreach ($ips as $ip)
        if (!filter_var($ip, FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE))
            return null;
    return $ips[0] ?? null;
}

$address = $_GET['url'] ?? '';
for ($redirects = 0; ; $redirects++) {
    $url = parse_url($address);
    $ip = $url ? publicIp($url) : null;
    if (!$ip || $redirects > MAX_REDIRECTS)
        fail(400);
    $data = '';
    $curl = curl_init($address);
    curl_setopt_array($curl, [
        CURLOPT_RESOLVE => ["{$url['host']}:" . ($url['scheme'] === 'https' ? 443 : 80) . ":$ip"],
        CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_WRITEFUNCTION => function ($curl, $chunk) use (&$data) {
            $data .= $chunk;
            return strlen($data) > MAX_SIZE ? 0 : strlen($chunk);
        },
    ]);
    $done = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $location = curl_getinfo($curl, CURLINFO_REDIRECT_URL);
    if (!$done)
        fail(502);
    if ($status < 300 || $status >= 400 || !$location)
        break;
    $address = $location;
}
if ($status !== 200)
    fail($status >= 400 && $status < 500 ? $status : 502);
// A web page, such as the one Drive shows for a file that isn't shared,
// isn't a figure.
if (preg_match('/^\s*</', $data))
    fail(415);
header('Content-Type: application/octet-stream');
header('X-Content-Type-Options: nosniff');
echo $data;
