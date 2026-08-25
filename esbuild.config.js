const { build, context } = require("esbuild")
const { copyFileSync, readdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs")
const { basename, join } = require("node:path")

const SCRIPTS_DIR = join(__dirname, "scripts")
const OUT_DIR = join(__dirname, "dist")

// Some files use `const p = "…"; require(p)` to hide the module path from TS
// (avoids type-check noise from untyped/minified deps). That indirection also
// hides the path from esbuild's static analysis, so it can't bundle them.
// This plugin rewrites those specific call sites back to literal-string
// requires at bundle time — TS still sees the indirection, esbuild sees a
// literal it can resolve and inline.
const inlineVariablePathRequires = {
  name: "inline-variable-path-requires",
  setup(build) {
    const rewrites = [
      { file: "lib/pdf-text-extract.js", from: "require(legacyPdfjsPath)", to: 'require("pdfjs-dist/legacy/build/pdf.min.mjs")' },
      { file: "lib/document-types/vitnemal.js", from: "require(schoolsInfoPath)", to: 'require("vtfk-schools-info")' },
      { file: "lib/document-types/kompetansebevis.js", from: "require(schoolsInfoPath)", to: 'require("vtfk-schools-info")' }
    ]

    for (const { file, from, to } of rewrites) {
      const absolutePath = join(__dirname, file)
      build.onLoad({ filter: new RegExp(`${file.replace(/[/.]/g, "\\$&")}$`) }, () => {
        const source = readFileSync(absolutePath, "utf8")
        if (!source.includes(from)) {
          throw new Error(`inline-variable-path-requires: expected "${from}" in ${file}`)
        }
        return { contents: source.replace(from, to), loader: "js" }
      })
    }
  }
}

const entryPoints = readdirSync(SCRIPTS_DIR)
  .filter((file) => file.endsWith(".js"))
  .map((file) => join(SCRIPTS_DIR, file))

// Non-JS files that bundled code loads at runtime via __dirname.
// Copied next to the bundles so `path.join(__dirname, <asset>)` still resolves.
// pdf.worker.mjs is pdfjs's "fake worker" — once pdfjs is bundled into the entry
// script, its relative-to-package worker lookup breaks and it falls back to
// searching next to the caller, so we place it there.
const RUNTIME_ASSETS = [
  { from: "lib/get-ad-user.ps1", to: "get-ad-user.ps1" },
  { from: "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs", to: "pdf.worker.mjs" }
]

const copyRuntimeAssets = () => {
  for (const { from, to } of RUNTIME_ASSETS) {
    copyFileSync(join(__dirname, from), join(OUT_DIR, to))
  }
}

// Emit a stripped package.json and copy README.md so the dist folder is a
// self-contained deploy artifact.
//  - name/version keep loglady happy (it reads process.cwd()/package.json)
//  - engines documents the Node floor
//  - scripts wire `npm run <script>` from inside dist/, expecting .env at ../
const emitStandaloneMetadata = () => {
  const rootPkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8"))
  const runScripts = Object.fromEntries(
    entryPoints
      .map((entry) => basename(entry, ".js"))
      .sort()
      .map((name) => [name, `node --enable-source-maps --env-file=../.env ${name}.js`])
  )
  const distPkg = {
    name: rootPkg.name,
    version: rootPkg.version,
    private: true,
    type: "commonjs",
    engines: rootPkg.engines,
    scripts: runScripts
  }
  writeFileSync(join(OUT_DIR, "package.json"), `${JSON.stringify(distPkg, null, 2)}\n`)
  copyFileSync(join(__dirname, "README.md"), join(OUT_DIR, "README.md"))
}

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints,
  outdir: OUT_DIR,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  logLevel: "info",
  legalComments: "none",
  plugins: [
    inlineVariablePathRequires,
    {
      name: "emit-standalone-metadata",
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length === 0) {
            emitStandaloneMetadata()
            copyRuntimeAssets()
          }
        })
      }
    }
  ],
  minify: false,
  sourcemap: "linked",
  sourcesContent: true
}

const watch = process.argv.includes("--watch")

;(async () => {
  rmSync(OUT_DIR, { recursive: true, force: true })

  if (watch) {
    const ctx = await context(options)
    await ctx.watch()
    console.log(`esbuild: watching ${entryPoints.length} script(s)`)
    return
  }

  await build(options)
  emitStandaloneMetadata()
  console.log(`esbuild: bundled ${entryPoints.length} script(s) → ${OUT_DIR}`)
})()
