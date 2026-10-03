<?php
    // Index of the test figures, each opened in DocGeo through its ?url= parameter.
    // ?viewer=… replaces the viewer, e.g. ?viewer=http://localhost:5175/apps/docgeo/index.html
    $viewer = 'https://doctools.org/apps/docgeo/index.html';
    if (isset($_GET['viewer']) && preg_match('#^https?://#', $_GET['viewer'])) {
    $viewer = $_GET['viewer'];
    }
    $https = ! empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    $base  = ($https ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST']
    . rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') . '/';

    // Folder tree of the figures with the given extension, empty folders pruned.
    function scan($dir, $ext)
    {
    $tree = ['dirs' => [], 'files' => [], 'count' => 0];
    foreach (scandir($dir) ?: [] as $name) {
        if ($name[0] === '.') {
            continue;
        }

        if (is_dir("$dir/$name")) {
            $sub = scan("$dir/$name", $ext);
            if ($sub['count']) {
                $tree['dirs'][$name] = $sub;
            }

        } elseif (strtolower(pathinfo($name, PATHINFO_EXTENSION)) === $ext) {
            $tree['files'][] = $name;
        }
    }
    uksort($tree['dirs'], 'strnatcasecmp');
    natcasesort($tree['files']);
    $tree['count'] = count($tree['files']) + array_sum(array_column($tree['dirs'], 'count'));
    return $tree;
    }

    $sections = [];
    foreach (['dgo', 'dgp', 'ggb'] as $ext) {
    if (! is_dir(__DIR__ . "/$ext")) {
        continue;
    }

    $tree = scan(__DIR__ . "/$ext", $ext);
    if ($tree['count']) {
        $sections[$ext] = $tree;
    }

    }

    function h($s)
    {return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');}

    // The figure's URL is encoded once more as a query value, ':' and '/' kept
    // readable since they are allowed there.
    function link_to($viewer, $url)
    {
    return $viewer . '?url=' . str_replace(['%3A', '%2F'], [':', '/'], rawurlencode($url));
    }

    // Native application of each imported format, opened through the same ?url= parameter.
    $natives = [
    'dgp' => 'https://dgpad.net/index.php',
    'ggb' => 'https://doctools.org/apps/geogebra.html',
    ];

    function render($tree, $path, $viewer, $base)
    {
    global $natives;
    foreach ($tree['dirs'] as $name => $sub): ?>
<details>
  <summary><?php echo h($name) ?> <small>(<span class="count"><?php echo $sub['count'] ?></span>)</small></summary>
  <?php render($sub, "$path/" . rawurlencode($name), $viewer, $base); ?>
</details>
<?php endforeach;
    if (! $tree['files']) {
        return;
    }
    ?>
<ul>
<?php foreach ($tree['files'] as $file):
        $url = $base . $path . '/' . rawurlencode($file);
        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION)); ?>
  <li><a href="<?php echo h(link_to($viewer, $url)) ?>" target="_blank" title="<?php echo h($file) ?>"><?php echo h($file) ?></a><?php if (isset($natives[$ext])): ?><a class="native" href="<?php echo h(link_to($natives[$ext], $url)) ?>" target="_blank" title="Ouvrir dans <?php echo $ext === 'dgp' ? 'DGPad' : 'GeoGebra' ?>"><?php echo $ext ?></a><?php endif; ?><a class="raw" href="<?php echo h($url) ?>" download title="Télécharger">↓</a></li>
<?php endforeach; ?>
</ul>
<?php }
?>
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Figures de test DocGeo pour voir</title>
<style>
  :root { color-scheme: light dark; --fg: #1d1d1f; --muted: #6e6e73; --bg: #fff; --line: #e5e5ea; --link: #0a66c2; }
  @media (prefers-color-scheme: dark) {
    :root { --fg: #f2f2f7; --muted: #a1a1a6; --bg: #1c1c1e; --line: #3a3a3c; --link: #6cb4ff; }
  }
  body { margin: 0 auto; max-width: 1100px; padding: 24px 16px; font: 15px/1.4 system-ui, sans-serif; color: var(--fg); background: var(--bg); }
  h1 { font-size: 22px; margin: 0 0 4px; }
  p { color: var(--muted); margin: 0 0 16px; }
  input { width: 100%; box-sizing: border-box; padding: 8px 10px; font: inherit; border: 1px solid var(--line); border-radius: 6px; background: transparent; color: inherit; }
  summary { cursor: pointer; user-select: none; }
  summary small { color: var(--muted); font-weight: normal; }
  details.section > summary { font-size: 16px; font-weight: bold; margin: 24px 0 8px; padding-bottom: 4px; border-bottom: 1px solid var(--line); }
  details details { margin: 4px 0 4px 4px; padding-left: 12px; border-left: 1px solid var(--line); }
  details details > summary { font-weight: 600; margin-left: -12px; }
  details details > summary + * { margin-top: 4px; }
  ul { list-style: none; margin: 0; padding: 0; columns: 220px; column-gap: 24px; }
  li { display: flex; align-items: baseline; padding: 2px 0; break-inside: avoid; white-space: nowrap; }
  li > a:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  li > a + a { flex-shrink: 0; }
  .hidden { display: none; }
  a { color: var(--link); text-decoration: none; }
  a:hover { text-decoration: underline; }
  a.raw { color: var(--muted); font-size: 12px; margin-left: 6px; }
  a.native { display: inline-block; margin-left: 6px; padding: 0 5px; border-radius: 8px; font-size: 11px; line-height: 16px; color: var(--bg); background: var(--muted); }
  a.native:hover { text-decoration: none; background: var(--link); }
</style>
</head>
<body>
<h1>Figures de test DocGeo</h1>
<p>Chaque figure s'ouvre dans <a href="<?php echo h($viewer) ?>"><?php echo h($viewer) ?></a>.</p>
<input type="search" id="filter" placeholder="Filtrer…" autofocus>
<?php foreach ($sections as $ext => $tree): ?>
<details class="section" open>
  <summary><?php echo h($ext) ?> <small>(<span class="count"><?php echo $tree['count'] ?></span>)</small></summary>
  <?php render($tree, $ext, $viewer, $base); ?>
</details>
<?php endforeach; ?>
<script>
  // While filtering, folders holding a match are unfolded; their state from
  // before the filter is restored once it is cleared.
  document.getElementById('filter').addEventListener('input', (event) => {
    const query = event.target.value.trim().toLowerCase();
    for (const item of document.querySelectorAll('li')) {
      item.classList.toggle('hidden', !item.firstElementChild.textContent.toLowerCase().includes(query));
    }
    for (const folder of document.querySelectorAll('details')) {
      const shown = folder.querySelectorAll('li:not(.hidden)').length;
      folder.querySelector(':scope > summary .count').textContent = shown;
      folder.classList.toggle('hidden', shown === 0);
      if (query) {
        folder.dataset.open ??= folder.open;
        folder.open = shown > 0;
      } else if (folder.dataset.open) {
        folder.open = folder.dataset.open === 'true';
        delete folder.dataset.open;
      }
    }
  });
</script>
</body>
</html>
