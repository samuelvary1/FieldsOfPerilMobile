import React from 'react';
import {SafeAreaView, StatusBar} from 'react-native';
import GameUI from './src/components/GameUI';

const App = () => {
  return (
    <SafeAreaView style={{flex: 1}}>
      <StatusBar barStyle="light-content" />
      <GameUI />
    </SafeAreaView>
  );
};

export default App;
