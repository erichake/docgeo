<?php
// Index of the test figures, each opened in DocGeo through its ?url= parameter.
// ?viewer=… replaces the viewer, e.g. ?viewer=http://localhost:5175/apps/docgeo/index.html
$viewer = 'https://doctools.org/apps/docgeo/index.html';
if (isset($_GET['viewer']) && preg_match('#^https?://#', $_GET['viewer'])) {
    $viewer = $_GET['viewer'];
}
$https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
$base = ($https ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST']
    . rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') . '/';

$sections = [];
foreach (['dgo', 'dgp', 'ggb'] as $ext) {
    $files = glob(__DIR__ . "/$ext/*.$ext") ?: [];
    $files = array_map('basename', $files);
    natcasesort($files);
    if ($files) $sections[$ext] = $files;
}

function h($s) { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }

// The figure's URL is encoded once more as a query value, ':' and '/' kept
// readable since they are allowed there.
function link_to($viewer, $url) {
    return $viewer . '?url=' . str_replace(['%3A', '%2F'], [':', '/'], rawurlencode($url));
}
?>
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Figures de test DocGeo</title>
<style>
  :root { color-scheme: light dark; --fg: #1d1d1f; --muted: #6e6e73; --bg: #fff; --line: #e5e5ea; --link: #0a66c2; }
  @media (prefers-color-scheme: dark) {
    :root { --fg: #f2f2f7; --muted: #a1a1a6; --bg: #1c1c1e; --line: #3a3a3c; --link: #6cb4ff; }
  }
  body { margin: 0 auto; max-width: 1100px; padding: 24px 16px; font: 15px/1.4 system-ui, sans-serif; color: var(--fg); background: var(--bg); }
  h1 { font-size: 22px; margin: 0 0 4px; }
  p { color: var(--muted); margin: 0 0 16px; }
  input { width: 100%; box-sizing: border-box; padding: 8px 10px; font: inherit; border: 1px solid var(--line); border-radius: 6px; background: transparent; color: inherit; }
  h2 { font-size: 16px; margin: 24px 0 8px; padding-bottom: 4px; border-bottom: 1px solid var(--line); }
  h2 small { color: var(--muted); font-weight: normal; }
  ul { list-style: none; margin: 0; padding: 0; columns: 220px; column-gap: 24px; }
  li { padding: 2px 0; break-inside: avoid; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  li.hidden, section.hidden { display: none; }
  a { color: var(--link); text-decoration: none; }
  a:hover { text-decoration: underline; }
  a.raw { color: var(--muted); font-size: 12px; margin-left: 6px; }
</style>
</head>
<body>
<h1>Figures de test DocGeo</h1>
<p>Chaque figure s'ouvre dans <a href="<?= h($viewer) ?>"><?= h($viewer) ?></a>, dans une nouvelle fenêtre.</p>
<input type="search" id="filter" placeholder="Filtrer…" autofocus>
<?php foreach ($sections as $ext => $files): ?>
<section>
  <h2><?= h($ext) ?> <small>(<span class="count"><?= count($files) ?></span>)</small></h2>
  <ul>
  <?php foreach ($files as $file):
      $url = $base . $ext . '/' . rawurlencode($file); ?>
    <li><a href="<?= h(link_to($viewer, $url)) ?>" target="_blank" rel="noopener"><?= h($file) ?></a><a class="raw" href="<?= h($url) ?>" download title="Télécharger">↓</a></li>
  <?php endforeach; ?>
  </ul>
</section>
<?php endforeach; ?>
<script>
  document.getElementById('filter').addEventListener('input', (event) => {
    const query = event.target.value.trim().toLowerCase();
    for (const section of document.querySelectorAll('section')) {
      let shown = 0;
      for (const item of section.querySelectorAll('li')) {
        const match = item.textContent.toLowerCase().includes(query);
        item.classList.toggle('hidden', !match);
        if (match) shown++;
      }
      section.querySelector('.count').textContent = shown;
      section.classList.toggle('hidden', shown === 0);
    }
  });
</script>
</body>
</html>
