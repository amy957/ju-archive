/* 一次性探针：本机无 YAML 库，用最小子集解析器校验两个 workflow 的结构与不变量。
   覆盖：块映射 / 块序列 / 纯量 / 单双引号标量 / 行内数组 / '|' 块标量 / 注释。
   不支持（出现即显式报错）：锚点 & *、标签 !!、流式映射 {}、多行折叠标量 '>'。
   用法：node _ymlcheck_20261029.mjs <file> [...] */
import { readFileSync } from 'node:fs';

function fail(file, ln, msg) {
  throw new Error(`${file}:${ln} ${msg}`);
}

function stripTrailingComment(s) {
  let q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === "'" || c === '"') { q = c; continue; }
    if (c === '#' && i > 0 && s[i - 1] === ' ') return s.slice(0, i).replace(/\s+$/, '');
  }
  return s.replace(/\s+$/, '');
}

function scalar(raw, file, ln) {
  const s = stripTrailingComment(raw).trim();
  if (s === '') return null;
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((x) => scalar(x, file, ln));
  }
  if (s.startsWith('{')) fail(file, ln, '不支持流式映射 {}');
  if (/^[&*]/.test(s)) fail(file, ln, '不支持锚点/别名');
  if (/^!!/.test(s)) fail(file, ln, '不支持标签');
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) return s.slice(1, -1);
  return s;
}

function parseFile(file, text) {
  if (text.includes('\t')) fail(file, 0, '含制表符（YAML 缩进禁用 tab）');
  const lines = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    if (raw.trim() === '') { lines.push({ ln: i + 1, raw, blank: true }); return; }
    if (/^\s*#/.test(raw)) { lines.push({ ln: i + 1, raw, comment: true }); return; }
    lines.push({ ln: i + 1, raw, indent: raw.length - raw.replace(/^\s+/, '').length });
  });

  let idx = 0;
  const skipNoise = () => {
    while (idx < lines.length && (lines[idx].blank || lines[idx].comment)) idx++;
  };

  function parseBlock(indent) {
    skipNoise();
    if (idx >= lines.length) return null;
    const first = lines[idx];
    if (first.indent < indent) return null;
    if (first.indent > indent) fail(file, first.ln, `缩进异常（期望 ${indent}，实得 ${first.indent}）`);
    const isSeq = first.raw.trim().startsWith('- ') || first.raw.trim() === '-';
    return isSeq ? parseSeq(indent) : parseMap(indent);
  }

  function parseMap(indent) {
    const out = {};
    for (;;) {
      skipNoise();
      if (idx >= lines.length) break;
      const L = lines[idx];
      if (L.indent < indent) break;
      if (L.indent > indent) fail(file, L.ln, `缩进异常（期望 ${indent}，实得 ${L.indent}）`);
      const t = L.raw.trim();
      if (t.startsWith('- ')) break;
      const m = t.match(/^([^:]+):(\s.*|)$/);
      if (!m) fail(file, L.ln, `无法解析的映射行：${t}`);
      const key = m[1].trim().replace(/^['"]|['"]$/g, '');
      const rest = m[2];
      idx++;
      if (rest.trim() === '') {
        skipNoise();
        const nx = idx < lines.length ? lines[idx] : null;
        if (!nx || nx.indent <= indent) { out[key] = null; continue; }
        out[key] = parseBlock(nx.indent);
        continue;
      }
      if (rest.trim() === '|' || rest.trim() === '|-') {
        const buf = [];
        while (idx < lines.length && (lines[idx].blank || lines[idx].indent > indent)) {
          buf.push(lines[idx].blank ? '' : lines[idx].raw.slice(indent + 2));
          idx++;
        }
        out[key] = buf.join('\n');
        continue;
      }
      if (rest.trim() === '>') fail(file, L.ln, '不支持折叠标量 >');
      out[key] = scalar(rest, file, L.ln);
    }
    return out;
  }

  function parseSeq(indent) {
    const out = [];
    for (;;) {
      skipNoise();
      if (idx >= lines.length) break;
      const L = lines[idx];
      if (L.indent < indent) break;
      if (L.indent > indent) fail(file, L.ln, `缩进异常（期望 ${indent}，实得 ${L.indent}）`);
      const t = L.raw.trim();
      if (!(t.startsWith('- ') || t === '-')) break;
      const body = t === '-' ? '' : t.slice(2);
      if (body === '') { idx++; skipNoise(); out.push(idx < lines.length ? parseBlock(lines[idx].indent) : null); continue; }
      if (/^[^:'"]+:\s/.test(body) || /^[^:'"]+:$/.test(body)) {
        /* 序列项内的映射：把首行就地改写为更深缩进的映射首行，复用 parseMap */
        const innerIndent = L.indent + 2;
        lines[idx] = { ln: L.ln, raw: ' '.repeat(innerIndent) + body, indent: innerIndent };
        out.push(parseMap(innerIndent));
        continue;
      }
      out.push(scalar(body, file, L.ln));
      idx++;
    }
    return out;
  }

  const doc = parseBlock(0);
  skipNoise();
  if (idx < lines.length) fail(file, lines[idx].ln, '存在未消费的残留行');
  return doc;
}

const results = [];
function assert(cond, msg) {
  if (!cond) throw new Error(`断言失败：${msg}`);
  results.push(`  PASS  ${msg}`);
}

const checks = {
  'm07-ci.yml': (d, file) => {
    assert(Array.isArray(results), 'noop');
    assert(d.name === 'm07-ci', 'name == m07-ci');
    assert(d.on && d.on.push && Array.isArray(d.on.push.paths), 'on.push.paths 为数组');
    assert(d.on.push.paths.includes('6.P0-T3基线/m07-vite/**'), "on.push.paths 含 '6.P0-T3基线/m07-vite/**'");
    assert(d.on.pull_request && Array.isArray(d.on.pull_request.paths), 'on.pull_request.paths 为数组');
    assert(d.on.pull_request.paths.includes('6.P0-T3基线/m07-vite/**'), "on.pull_request.paths 含 '6.P0-T3基线/m07-vite/**'");
    assert(d.defaults && d.defaults.run && d.defaults.run['working-directory'] === '6.P0-T3基线/m07-vite', 'defaults.run.working-directory 已设');
    const steps = d.jobs && d.jobs.ci && d.jobs.ci.steps;
    assert(Array.isArray(steps) && steps.length === 9, `jobs.ci.steps 共 9 步（实得 ${steps && steps.length}）`);
    const runs = steps.filter((s) => s.run);
    assert(runs.length === 6, `run 步骤 6 个（实得 ${runs.length}）`);
    for (const s of runs) {
      assert(s['working-directory'] === '6.P0-T3基线/m07-vite', `步骤「${s.name}」带 working-directory`);
    }
    const joined = runs.map((s) => s.run).join('\n');
    assert(/npm ci/.test(joined), 'run 含 npm ci');
    assert(/npx tsc --noEmit/.test(joined), 'run 含 tsc --noEmit');
    assert(/node --test test\/\*\.mjs/.test(joined), 'run 含 node --test');
    assert(/npx playwright test/.test(joined), 'run 含 playwright test');
    assert(/npx vite build/.test(joined), 'run 含 vite build');
    const up = steps.find((s) => /upload-artifact/.test(s.uses || ''));
    assert(!!up, '存在 upload-artifact 步骤');
    assert(up.with.path === '6.P0-T3基线/m07-vite/dist/index.html', 'upload-artifact path 为仓库根相对路径');
    const setup = steps.find((s) => /setup-node/.test(s.uses || ''));
    assert(setup.with['cache-dependency-path'] === '6.P0-T3基线/m07-vite/package-lock.json', 'setup-node cache-dependency-path 正确');
  },
  'ci-gate.yml': (d) => {
    assert(/^ju-ci-gate$/.test(d.name), 'name == ju-ci-gate');
    assert(d.defaults && d.defaults.run && d.defaults.run['working-directory'] === '6.P0-T3基线/step9', 'defaults 仍为 step9');
    const steps = d.jobs.gate.steps;
    const reg = steps.find((s) => /Registrar/.test(s.name || ''));
    assert(!!reg, '存在 Registrar 步骤');
    assert(!/\b(47|49|66)\s*(parties|方)/.test(JSON.stringify(d)), '全文无 47/49/66 形式的固定方数');
    assert(/PARTY_COUNT/.test(reg.name), 'Registrar 步骤名以 PARTY_COUNT 表述');
    assert(reg.run === 'node verify-hash-registry.mjs', 'Registrar run 命令正确');
  },
};

for (const file of process.argv.slice(2)) {
  const text = readFileSync(file, 'utf8');
  const doc = parseFile(file, text);
  console.log(`\n[yml] ${file}`);
  const base = file.split(/[\\/]/).pop();
  const fn = checks[base];
  results.length = 0;
  if (!fn) { console.log('  (无专用断言)'); continue; }
  fn(doc, file);
  for (const r of results.filter((x) => !x.includes('noop'))) console.log(r);
}
console.log('\n[yml] ALL CHECKS PASSED');
