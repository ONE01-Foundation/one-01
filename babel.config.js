module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated 4 (the version Expo SDK 54's Expo Go ships with) moved its
      // worklet plugin out into the react-native-worklets package.
      'react-native-worklets/plugin',
    ],
  };
};

