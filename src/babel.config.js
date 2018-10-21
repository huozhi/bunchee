// check https://github.com/facebook/create-react-app/blob/master/packages/babel-preset-react-app/ for detail
// TODO: extract for standalone package
// TODO: test env for commonjs module with nodejs
function createBabelConfig() {
  return {
    presets: [
      [
        require('@babel/preset-env').default,
        {
          targets: {
            node: 'current',
          },
          useBuiltIns: false,
          modules: false,
          exclude: ['transform-typeof-symbol'],
        }
      ]
    ],
    plugins: [
      require('@babel/plugin-transform-destructuring').default,
      [
        require('@babel/plugin-proposal-object-rest-spread').default,
        {
          useBuiltIns: true,
        },
      ],
      [
        require('@babel/plugin-transform-runtime').default,
        {
          corejs: false,
          helpers: false,
          regenerator: true,
          useESModules: true,
        },
      ],
    ],
  };
};

module.exports = createBabelConfig;
