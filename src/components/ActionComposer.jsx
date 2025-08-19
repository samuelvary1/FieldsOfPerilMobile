import React, {useState, useEffect} from 'react';
import {View, Text, ScrollView, StyleSheet} from 'react-native';
import Chip from './Chip';

export default function ActionComposer({game, onCommand, showBasicActions}) {
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
    // Show items in the room or in open/peeked containers, not in inventory
    targets = Object.values(game.items).filter(it => {
      if ((game.player.inventory || []).includes(it.id)) {
        return false;
      }
      // Toothpaste: only take-able if cabinet is open and looked in
      if (it.id === 'toothpaste') {
        const cabinet = game.items.cabinet;
        const looked = game.state?.flags?.looked_in_cabinet;
        if (
          it.location !== 'cabinet' ||
          !cabinet?.properties?.open ||
          !looked
        ) {
          return false;
        }
        return true;
      }
      // Letter: only take-able if box is open and looked in
      if (it.id === 'letter') {
        const box = game.items.box;
        const looked = game.state?.flags?.looked_in_box;
        if (it.location !== 'box' || !box?.properties?.open || !looked) {
          return false;
        }
        return true;
      }
      // Default: show if in current room
      return it.location === currentRoom.id;
    });
  } else if (verb === 'read') {
    // Only show items that have a 'read' response and are in inventory, room, or open/peeked container
    targets = Object.values(game.items).filter(it => {
      if (!it.responses || !it.responses.read) {
        return false;
      }
      // Allow reading from inventory
      if ((game.player.inventory || []).includes(it.id)) {
        return true;
      }
      // Allow reading from room
      if (it.location === currentRoom.id) {
        return true;
      }
      // Allow reading from open/peeked container
      if (it.id === 'letter') {
        const box = game.items.box;
        const looked = game.state?.flags?.looked_in_box;
        if (it.location === 'box' && box?.properties?.open && looked) {
          return true;
        }
      }
      return false;
    });
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
  } else if (verb === 'examine' || verb === 'look in') {
    // Examine and Look In: allow any item in inventory or in the room
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
      // Special case for 'look in'
      if (verb === 'look in') {
        doCmd(`look in ${noun}`);
      } else {
        doCmd(`${verb} ${noun}`);
      }
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
    // Organize actions into explicit columns for better grouping
    const basicActions = showBasicActions
      ? [
          {label: 'Look Around', icon: 'eye', onPress: () => onCommand('look')},
          {
            label: 'Inventory',
            icon: 'list',
            onPress: () => onCommand('inventory'),
          },
          {
            label: 'Help',
            icon: 'question-circle',
            onPress: () => onCommand('help'),
          },
        ]
      : [];

    // Define explicit columns for better organization
    const leftColumnActions = [
      ...basicActions.slice(0, Math.ceil(basicActions.length / 2)),
      {label: 'Take', icon: 'hand-paper-o', onPress: () => setVerb('take')},
      {label: 'Examine', icon: 'search', onPress: () => setVerb('examine')},
      {label: 'Read', icon: 'book', onPress: () => setVerb('read')},
    ];

    const rightColumnActions = [
      ...basicActions.slice(Math.ceil(basicActions.length / 2)),
      {label: 'Use', icon: 'play-circle', onPress: () => setVerb('use')},
      {label: 'Open', icon: 'folder-open', onPress: () => setVerb('open')},
      {label: 'Close', icon: 'lock', onPress: () => setVerb('close')},
      {label: 'Look In', icon: 'inbox', onPress: () => setVerb('look in')},
    ];

    return (
      <View style={acStyles.wrap}>
        <Text style={acStyles.prompt}>Choose an action:</Text>
        <View style={acStyles.actionGrid}>
          <View style={acStyles.actionColumn}>
            {leftColumnActions.map(a => (
              <View key={a.label} style={acStyles.actionButton}>
                <Chip label={a.label} icon={a.icon} onPress={a.onPress} />
              </View>
            ))}
          </View>
          <View style={acStyles.actionColumn}>
            {rightColumnActions.map(a => (
              <View key={a.label} style={acStyles.actionButton}>
                <Chip label={a.label} icon={a.icon} onPress={a.onPress} />
              </View>
            ))}
          </View>
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
  wrap: {
    // Recessed well effect (matching MovementBar)
    backgroundColor: '#0f1419',
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
    // Recessed well shadows
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: -2,
    borderWidth: 2,
    borderColor: '#1a1f26',
    // Inner shadow effect (simulated with gradient-like border)
    borderTopColor: '#0a0d11',
    borderLeftColor: '#0a0d11',
    borderRightColor: '#1f242b',
    borderBottomColor: '#1f242b',
  },
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
  },
  actionColumn: {
    flex: 1,
    gap: 4,
  },
  actionButton: {
    width: '100%',
    minHeight: 38,
    marginBottom: 4,
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
  prompt: {
    color: '#9aa',
    fontSize: 13,
    marginBottom: 2,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: '100%',
    marginTop: 4,
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
