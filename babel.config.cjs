module.exports = {
  presets: [
    ['@babel/preset-env', {targets: {node: 'current'}}],
    ['@babel/preset-react', {runtime: 'automatic'}]
  ],
  plugins: [
    // Explicitly using array form for the plugin
    ['styled-jsx/babel', {}]
  ]
};
