import React, {useState, useEffect} from 'react';
import {View, Text, ScrollView, StyleSheet} from 'react-native';
import Chip from './Chip';

const VERBS = [
  {label: 'Take', value: 'take'},
  {label: 'Use', value: 'use'},
  {label: 'Open', value: 'open'},
  {label: 'Close', value: 'close'},
  {label: 'Examine', value: 'examine'},
];

export default function ActionComposer({game, onCommand}) {
  const [verb, setVerb] = useState(null);
  const [noun, setNoun] = useState(null);

  const currentRoom = game?.rooms?.[game?.player?.location] || {};
  const roomItemIds = currentRoom.items || [];
  const roomItems = roomItemIds.map(id => game?.items?.[id]).filter(Boolean);
  const invItems = (game?.player?.inventory || [])
    .map(id => game?.items?.[id])
    .filter(Boolean);

  const doCmd = React.useCallback(
    cmd => {
      onCommand(cmd);
      setVerb(null);
      setNoun(null);
    },
    [onCommand],
  );

  let targets = [];
  if (verb === 'take') {
    // Only show items in the room that are not in inventory
    targets = roomItems.filter(
      it => !(game.player.inventory || []).includes(it.id),
    );
  } else if (verb === 'use' || verb === 'open' || verb === 'close') {
    // Show both inventory and room items, but dedupe
    const all = [...invItems, ...roomItems];
    const seen = new Set();
    targets = all.filter(it => {
      if (seen.has(it.id)) {
        return false;
      }
      seen.add(it.id);
      return true;
    });
  } else if (verb === 'examine') {
    // Examine: allow any item in inventory or in the room
    const all = [...invItems, ...roomItems];
    const seen = new Set();
    targets = all.filter(it => {
      if (seen.has(it.id)) {
        return false;
      }
      seen.add(it.id);
      return true;
    });
  }

  useEffect(() => {
    if (!game) {
      return;
    }
    if (verb && noun) {
      doCmd(`${verb} ${noun}`);
    } else if (
      verb &&
      (verb === 'inventory' || verb === 'help') &&
      targets.length === 0
    ) {
      doCmd(verb);
    }
  }, [verb, noun, game, targets.length, doCmd]);

  if (!game) {
    return null;
  }

  if (!verb) {
    return (
      <View style={acStyles.wrap}>
        <Text style={acStyles.prompt}>Choose an action:</Text>
        <View style={acStyles.verbGrid}>
          {VERBS.map((v, i) => (
            <View key={v.value} style={acStyles.verbCell}>
              <Chip label={v.label} onPress={() => setVerb(v.value)} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (!noun && targets.length > 0) {
    return (
      <View style={acStyles.wrap}>
        <Text style={acStyles.prompt}>Choose a target for "{verb}":</Text>
        <ScrollView horizontal contentContainerStyle={acStyles.row}>
          {targets.map(it => (
            <Chip key={it.id} label={it.name} onPress={() => setNoun(it.id)} />
          ))}
        </ScrollView>
        <Text style={acStyles.prompt} onPress={() => setVerb(null)}>
          ← Back
        </Text>
      </View>
    );
  }

  return null;
}

const acStyles = StyleSheet.create({
  verbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 2,
    width: '100%',
    maxWidth: '100%',
  },
  verbCell: {
    margin: 2,
    minWidth: 90,
    alignItems: 'center',
  },
  wrap: {
    backgroundColor: '#1b1f24',
    borderWidth: 1,
    borderColor: '#2a3139',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: '#1b1f24',
    borderWidth: 1,
    borderColor: '#2a3139',
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
  },
  btn: {
    backgroundColor: '#2b3036',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  btnText: {color: '#fff', fontSize: 13},
  prompt: {color: '#9aa', fontSize: 12, marginTop: 6, marginBottom: 6},
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    justifyContent: 'space-between',
  },
  back: {paddingVertical: 4, paddingHorizontal: 8},
  backText: {color: '#9bd'},
  headerText: {color: '#e6edf3', fontWeight: '600'},
});
