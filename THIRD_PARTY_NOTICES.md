# Third-Party Notices

The project's own client code uses GPL-3.0-only; see [LICENSE](LICENSE). Third-party components and assets retain the licenses described below.

## Background photographs

Three CC0 photographs from the WordPress Photo Directory are embedded in the client. Photographer credits, source links, resizing details and license references are listed in [assets/backgrounds/README.md](assets/backgrounds/README.md).

## Obsidian host API and icons

Obsidian is a separately installed host application and is not distributed in this plugin. The `obsidian` npm package supplies development types, is external to the build and is MIT licensed. The interface uses host-provided Lucide icons through `setIcon`; no separate Lucide library is bundled in the runtime. See the [Obsidian API repository](https://github.com/obsidianmd/obsidian-api) and the [Lucide license](https://lucide.dev/license).

The development-only screenshot renderer uses `lucide` 1.8.0 (ISC, with specified Feather-derived icons under MIT). Its full notices are preserved in [docs/licenses/lucide.txt](docs/licenses/lucide.txt). Screenshots show these icons and the bundled CC0 photographs; the plugin source license does not replace their licenses.

## Build and test tools

Dependencies and exact resolved versions are recorded in `package-lock.json`; a generated [license inventory](docs/licenses/dependencies.json) lists their license declarations. They are development tools and are not shipped as `node_modules` in the plugin release. Esbuild emits bundle helper code; its MIT license is preserved in [docs/licenses/esbuild.txt](docs/licenses/esbuild.txt). The build embeds the full project GPL text, esbuild MIT notice and photograph source/license records as comments in `main.js` and `styles.css`, so the three install files retain those notices. The [source and release review](docs/来源与发布复核.md) records the checks and their limits. These notices are not a claim that every inherited source file has been independently audited.
