declare module "rollup-plugin-preserve-shebang" {
  export default function shebangPlugin(options: {shebang?: string} = {}): Plugin;
}
