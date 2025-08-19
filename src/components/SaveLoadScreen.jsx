// SaveLoadScreen.jsx
import React, {useEffect, useState} from 'react';
import {View, Text, TouchableOpacity, Alert, ScrollView} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const slots = ['slot1', 'slot2', 'slot3'];

export default function SaveLoadScreen({navigation, route}) {
  const {onLoad} = route.params || {};
  const [meta, setMeta] = useState({});

  const refresh = async () => {
    const next = {};
    try {
      const auto = await AsyncStorage.getItem('fop_autosave');
      next.autosave = auto ? JSON.parse(auto) : null;
      for (const s of slots) {
        const raw = await AsyncStorage.getItem(`fop_save_${s}`);
        next[s] = raw ? JSON.parse(raw) : null;
      }
      setMeta(next);
    } catch (e) {
      console.log('read saves failed', e);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const load = async key => {
    const raw = await AsyncStorage.getItem(
      key === 'autosave' ? 'fop_autosave' : `fop_save_${key}`,
    );
    if (!raw) {
      return Alert.alert('No data');
    }
    const parsed = JSON.parse(raw);
    onLoad?.(parsed);
    navigation.goBack();
  };

  const save = async key => {
    if (!route.params?.getGame) {
      return;
    }
    const game = route.params.getGame();
    await AsyncStorage.setItem(`fop_save_${key}`, JSON.stringify(game));
    Alert.alert('Saved', `Saved to ${key}`);
    refresh();
  };

  const remove = async key => {
    await AsyncStorage.removeItem(
      key === 'autosave' ? 'fop_autosave' : `fop_save_${key}`,
    );
    refresh();
  };

  const row = (label, key, data, canSave) => (
    <View
      key={key}
      style={{padding: 12, borderBottomWidth: 1, borderColor: '#ddd'}}>
      <Text style={{fontWeight: '600', marginBottom: 8}}>{label}</Text>
      <Text style={{marginBottom: 8}}>
        {data ? `Player at ${data.player?.location}` : 'empty'}
      </Text>
      <View style={{flexDirection: 'row', gap: 12}}>
        <TouchableOpacity
          onPress={() => load(key)}
          style={{padding: 8, borderWidth: 1, borderRadius: 6}}>
          <Text>Load</Text>
        </TouchableOpacity>
        {canSave ? (
          <TouchableOpacity
            onPress={() => save(key)}
            style={{padding: 8, borderWidth: 1, borderRadius: 6}}>
            <Text>Save</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={() => remove(key)}
          style={{padding: 8, borderWidth: 1, borderRadius: 6}}>
          <Text>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{padding: 16}}>
      {row('Autosave', 'autosave', meta.autosave, false)}
      {slots.map(s => row(`Slot ${s.slice(-1)}`, s, meta[s], true))}
    </ScrollView>
  );
}
