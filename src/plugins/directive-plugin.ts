const MagicString = require('magic-string');

module.exports = function useDirectivePlugin() {
  return {
    name: 'use-directive',

    transform(code, id) {
      let magicString = new MagicString(code);
      let match;
      let useDirective = '';
      const regex = /^use [^\n;]*;/;

      if ((match = regex.exec(code)) !== null) {
        useDirective = match[0];
        magicString.remove(0, match[0].length);
      }

      return {
        code: magicString.toString(),
        map: magicString.generateMap({ hires: true }),
        banner: useDirective,
      };
    }
  };
};
