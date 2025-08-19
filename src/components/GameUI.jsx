// GameUI.jsx
import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Pressable,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {evaluateCommand, movePlayer} from '../engine/GameEngine';
import items from '../data/items.json';
import locations from '../data/locations.json';

export default function GameUI({navigation}) {
  const [log, setLog] = useState([]);
  const [input, setInput] = useState('');
  const [game, setGame] = useState(null);
  const [recentCommands, setRecentCommands] = useState([]);
  const [showExtras, setShowExtras] = useState(true); // Focus toggle
  const [showRecents, setShowRecents] = useState(false);
  const [showTyping, setShowTyping] = useState(__DEV__); // typing bar toggle (on in dev)

  const scrollViewRef = useRef(null);

  // Boot game
  useEffect(() => {
    const rooms = {};
    locations.forEach(room => {
      rooms[room.title] = {...room, been_before: false};
    });

    const itemMap = {};
    items.forEach(it => {
      itemMap[it.handle] = it;
    });

    setGame({
      schemaVersion: 1,
      rooms,
      items: itemMap,
      player: {location: 'apartment_living_room', inventory: []},
      messages: {
        help: 'Commands: look, take, drop, put, open, close, use, examine, read, inventory, help. Move with the controls.',
      },
      history: [],
      state: {flags: {}, counters: {}},
    });
  }, []);

  // Autosave
  useEffect(() => {
    if (!game) {
      return;
    }
    const save = async () => {
      try {
        await AsyncStorage.setItem('fop_autosave', JSON.stringify(game));
      } catch (e) {
        console.log('autosave failed', e);
      }
    };
    save();
  }, [game]);

  const appendLog = (...lines) => setLog(prev => [...prev, ...lines]);

  const handleCommand = cmd => {
    if (!cmd.trim() || !game) {
      return;
    }
    const response = evaluateCommand(cmd.trim(), game, setGame);
    appendLog(`> ${cmd}`, response);
    setRecentCommands(prev =>
      [cmd, ...prev.filter(c => c !== cmd)].slice(0, 5),
    );
    setInput('');
  };

  const handleSubmit = () => handleCommand(input);

  const handleMove = dir => {
    if (!game) {
      return;
    }
    const result = movePlayer(dir, game, setGame);
    appendLog(`> move ${dir}`, result);
  };

  const loadAutosave = async () => {
    try {
      const raw = await AsyncStorage.getItem('fop_autosave');
      if (!raw) {
        return Alert.alert('No autosave found');
      }
      const parsed = JSON.parse(raw);
      setGame(parsed);
      appendLog('Loaded autosave.');
    } catch (e) {
      Alert.alert('Load failed', String(e));
    }
  };

  const openSaveLoad = () => {
    if (navigation && typeof navigation.navigate === 'function') {
      navigation.navigate('SaveLoad', {
        onLoad: loadedGame => setGame(loadedGame),
        getGame: () => game,
      });
    } else {
      loadAutosave();
    }
  };

  if (!game) {
    return <Text style={styles.loading}>Loading...</Text>;
  }

  const currentRoom = game.rooms[game.player.location];
  const exits = new Set(Object.keys(currentRoom.rooms || {}));
  const initialDesc = !currentRoom.been_before
    ? currentRoom.first_time_message
    : currentRoom.header;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.title} numberOfLines={1}>
          {currentRoom?.name || currentRoom?.header || 'Fields of Peril'}
        </Text>
        <View style={styles.topBarButtonsRow}>
          <TopIcon
            onPress={() => setShowExtras(s => !s)}
            icon="eye"
            label={showExtras ? 'Focus' : 'UI'}
          />
          <TopIcon
            onPress={() => setShowTyping(s => !s)}
            icon="keyboard-o"
            label={showTyping ? 'Hide' : 'Type'}
          />
          <TopIcon onPress={openSaveLoad} icon="save" label="Save" />
        </View>
      </View>

      {/* Output first and big */}
      <ScrollView
        style={styles.output}
        ref={scrollViewRef}
        onContentSizeChange={() =>
          scrollViewRef.current?.scrollToEnd({animated: true})
        }>
        {!!initialDesc && <Text style={styles.text}>{initialDesc}</Text>}
        {log.map((line, index) => (
          <Text key={index} style={styles.text}>
            {line}
          </Text>
        ))}
      </ScrollView>

      {/* Docked movement (no overlap) */}
      <MovementBar exits={exits} onMove={handleMove} />

      {/* Inventory chips */}
      {showExtras && game.player.inventory.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inventory</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}>
            {game.player.inventory.map(item => (
              <Chip
                key={item}
                icon="key"
                label={item}
                onPress={() => handleCommand(`use ${item}`)}
                onLongPress={() => handleCommand(`drop ${item}`)}
              />
            ))}
          </ScrollView>
          <Text style={styles.hint}>Tap to use. Hold to drop.</Text>
        </View>
      )}

      {/* Actions compact */}
      {showExtras && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.actionsRow}>
            <ActionIcon
              label="Look"
              icon="search"
              onPress={() => handleCommand('look')}
            />
            <ActionIcon
              label="Inventory"
              icon="list"
              onPress={() => handleCommand('inventory')}
            />
            <ActionIcon
              label="Help"
              icon="question-circle"
              onPress={() => handleCommand('help')}
            />
          </View>
        </View>
      )}

      {/* Recents collapsed by default */}
      {showExtras && showRecents && recentCommands.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}>
            {recentCommands.slice(0, 3).map(cmd => (
              <Chip key={cmd} label={cmd} onPress={() => handleCommand(cmd)} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Action Composer: verbs & context targets (minimal typing) */}
      <ActionComposer game={game} onCommand={handleCommand} />

      {/* Input (toggleable typing bar) */}
      {showTyping && (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type a command..."
            placeholderTextColor="#9aa"
            onSubmitEditing={handleSubmit}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSubmit}>
            <Icon name="arrow-circle-right" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

/* Small components */

function TopIcon({icon, label, onPress}) {
  return (
    <TouchableOpacity style={styles.topIcon} onPress={onPress}>
      <Icon name={icon} size={16} color="#fff" />
      <Text style={styles.topIconLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Chip({label, icon, onPress, onLongPress, meta}) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={styles.chip}>
      {icon ? (
        <Icon name={icon} size={14} color="#fff" style={{marginRight: 6}} />
      ) : null}
      <Text style={styles.chipText}>{label}</Text>
      {meta ? <Text style={styles.badge}>{meta}</Text> : null}
    </Pressable>
  );
}

function ActionIcon({icon, label, onPress}) {
  return (
    <TouchableOpacity style={styles.actionIcon} onPress={onPress}>
      <Icon name={icon} size={18} color="#fff" />
      <Text style={styles.actionIconText}>{label}</Text>
    </TouchableOpacity>
  );
}

function MovementBar({exits, onMove}) {
  const Btn = ({dir, icon, label}) => {
    const enabled = exits.has(dir);
    return (
      <TouchableOpacity
        disabled={!enabled}
        onPress={() => enabled && onMove(dir)}
        style={[styles.mvBtn, !enabled && styles.mvBtnDisabled]}>
        <Icon name={icon} size={14} color="#fff" />
        <Text style={styles.mvLabel}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.moveDock}>
      <Btn dir="up" icon="chevron-up" label="UP" />
      <Btn dir="north" icon="arrow-up" label="N" />
      <Btn dir="west" icon="arrow-left" label="W" />
      <Btn dir="east" icon="arrow-right" label="E" />
      <Btn dir="south" icon="arrow-down" label="S" />
      <Btn dir="down" icon="chevron-down" label="DOWN" />
    </View>
  );
}

/* Styles */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  topBar: {
    marginBottom: 6,
  },
  title: {
    color: '#e8e8e8',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  topBarButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  topIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2e2e2e',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  topIconLabel: {
    marginLeft: 6,
    color: '#fff',
    fontSize: 12,
  },

  output: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 10,
  },
  text: {
    color: '#f0f3f6',
    fontSize: 17,
    lineHeight: 24,
    fontFamily: 'Courier',
    marginBottom: 6,
  },

  section: {marginBottom: 8},
  sectionTitle: {color: '#c9c9c9', fontSize: 13, marginBottom: 6},
  hint: {color: '#8aa', fontSize: 12, marginTop: 4},

  chipsRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3a3a3a',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
  },
  chipText: {color: '#fff', fontSize: 14, marginRight: 6},
  badge: {
    color: '#cfe',
    fontSize: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#2a3b3a',
    borderRadius: 8,
  },

  actionsRow: {flexDirection: 'row', gap: 10},
  actionIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2e2e2e',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  actionIconText: {color: '#fff', fontSize: 12, marginTop: 4},

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: Platform.OS === 'ios' ? 20 : 12,
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: '#1e2a2f',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#355',
  },
  sendButton: {
    backgroundColor: '#0a84ff',
    marginLeft: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },

  loading: {
    marginTop: 60,
    color: '#aaa',
    fontSize: 18,
    textAlign: 'center',
  },

  // Docked movement
  moveDock: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'space-between',
    backgroundColor: '#1b1f24',
    borderColor: '#2a3139',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 8,
  },
  mvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3e3e3e',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  mvBtnDisabled: {opacity: 0.3},
  mvLabel: {color: '#fff', fontSize: 12},
});

/* ---------- ACTION COMPOSER (contextual verbs & targets) ---------- */

function ActionComposer({game, onCommand}) {
  const [verb, setVerb] = React.useState(null);
  const [noun, setNoun] = React.useState(null);
  if (!game) {
    return null;
  }

  // Context helpers
  const room = game.rooms[game.player.location];
  const getItem = h => game.items[h];

  const roomItems = (room.items || []).map(getItem).filter(Boolean);
  const invItems = (game.player.inventory || []).map(getItem).filter(Boolean);

  const isContainer = it => it?.properties?.container;
  const isOpen = it => Boolean(it?.properties?.open);
  const isMobile = it => it?.properties?.mobile !== false;
  const hasRead = it => it?.responses?.read || it?.tags?.includes('readable');
  const isNPC = it => it?.tags?.includes('npc');

  const containers = [...roomItems, ...invItems].filter(isContainer);
  const openContainers = containers.filter(isOpen);
  const closedContainers = containers.filter(c => !isOpen(c));

  // contents with origin so we can build "take X from Y"
  const contents = openContainers
    .flatMap(c =>
      (c.contents || []).map(h => ({item: getItem(h), container: c})),
    )
    .filter(x => x.item);

  const takablesInRoom = roomItems.filter(isMobile);
  const readable = [...roomItems, ...invItems].filter(hasRead);
  const examinables = [
    ...roomItems,
    ...invItems,
    ...contents.map(x => x.item), // items inside open containers
  ];
  const npcs = roomItems.filter(isNPC);
  const putTargets = openContainers;
  const useItems = invItems;
  const useTargets = [...roomItems, ...containers].filter(Boolean);

  // Labels & meta
  const containerMeta = c =>
    `${isOpen(c) ? 'Open' : 'Closed'} • ${(c.contents || []).length} inside`;
  const itemFromLabel = (it, container) =>
    `${it.name || it.handle} from ${container?.name || container?.handle}`;

  // Utilities
  const doCmd = cmd => {
    onCommand(cmd);
    setVerb(null);
    setNoun(null);
  };

  const heading = txt => <Text style={acStyles.prompt}>{txt}</Text>;

  const chips = (arr, onPress, lab = it => it.name || it.handle, meta) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={acStyles.row}>
      {arr.length === 0 ? (
        <Text style={{color: '#9aa'}}>Nothing here</Text>
      ) : null}
      {arr.map(it => (
        <Chip
          key={it.handle}
          label={lab(it)}
          onPress={() => onPress(it)}
          meta={meta ? meta(it) : undefined}
        />
      ))}
    </ScrollView>
  );

  // Two-step flows
  if (verb === 'use' && !noun) {
    return (
      <View style={acStyles.wrap}>
        <Bar verb={verb} onBack={() => setVerb(null)} />
        {heading('Select an item to use')}
        {chips(useItems, it => setNoun(it.handle))}
      </View>
    );
  }
  if (verb === 'use' && noun) {
    return (
      <View style={acStyles.wrap}>
        <Bar verb={verb} noun={noun} onBack={() => setNoun(null)} />
        {heading(`Use ${noun} on`)}
        {chips(useTargets, t => doCmd(`use ${noun} on ${t.handle}`))}
      </View>
    );
  }
  if (verb === 'put' && !noun) {
    return (
      <View style={acStyles.wrap}>
        <Bar verb={verb} onBack={() => setVerb(null)} />
        {heading('Put which item')}
        {chips(invItems, it => setNoun(it.handle))}
      </View>
    );
  }
  if (verb === 'put' && noun) {
    return (
      <View style={acStyles.wrap}>
        <Bar verb={verb} noun={noun} onBack={() => setNoun(null)} />
        {heading(`Put ${noun} in`)}
        {chips(
          putTargets,
          c => doCmd(`put ${noun} in ${c.handle}`),
          it => it.name || it.handle,
          containerMeta,
        )}
      </View>
    );
  }

  // One-step verbs with context filtering
  if (verb === 'take') {
    return (
      <View style={acStyles.wrap}>
        <Bar verb={verb} onBack={() => setVerb(null)} />
        {heading('From the room')}
        {chips(takablesInRoom, it => doCmd(`take ${it.handle}`))}
        {contents.length > 0 ? heading('From containers') : null}
        {chips(
          contents.map(x => x.item),
          it => {
            const origin = contents.find(
              x => x.item.handle === it.handle,
            )?.container;
            doCmd(`take ${it.handle} from ${origin.handle}`);
          },
          it => {
            const origin = contents.find(
              x => x.item.handle === it.handle,
            )?.container;
            return itemFromLabel(it, origin);
          },
        )}
      </View>
    );
  }

  if (verb === 'open') {
    return (
      <View style={acStyles.wrap}>
        <Bar verb={verb} onBack={() => setVerb(null)} />
        {heading('Closed containers')}
        {chips(
          closedContainers,
          it => doCmd(`open ${it.handle}`),
          it => it.name || it.handle,
          containerMeta,
        )}
        {openContainers.length ? heading('Already open') : null}
        {chips(
          openContainers,
          () => {},
          it => it.name || it.handle,
          containerMeta,
        )}
      </View>
    );
  }

  if (verb === 'close') {
    return (
      <View style={acStyles.wrap}>
        <Bar verb={verb} onBack={() => setVerb(null)} />
        {heading('Open containers')}
        {chips(
          openContainers,
          it => doCmd(`close ${it.handle}`),
          it => it.name || it.handle,
          containerMeta,
        )}
      </View>
    );
  }

  if (verb === 'read') {
    return (
      <View style={acStyles.wrap}>
        <Bar verb={verb} onBack={() => setVerb(null)} />
        {chips(readable, it => doCmd(`read ${it.handle}`))}
      </View>
    );
  }

  if (verb === 'examine') {
    return (
      <View style={acStyles.wrap}>
        <Bar verb={verb} onBack={() => setVerb(null)} />
        {heading('In the room')}
        {chips(
          roomItems,
          it => doCmd(`examine ${it.handle}`),
          it => {
            if (isContainer(it)) {
              return `${it.name || it.handle}`;
            }
            return it.name || it.handle;
          },
          it => (isContainer(it) ? containerMeta(it) : undefined),
        )}

        {invItems.length ? heading('In your inventory') : null}
        {chips(invItems, it => doCmd(`examine ${it.handle}`))}

        {openContainers.length
          ? heading('Look inside (open containers)')
          : null}
        {chips(
          openContainers,
          c => doCmd(`look in ${c.handle}`),
          it => it.name || it.handle,
          containerMeta,
        )}

        {contents.length ? heading('Items inside containers') : null}
        {chips(
          contents.map(x => x.item),
          it => doCmd(`examine ${it.handle}`),
          it => {
            const origin = contents.find(
              x => x.item.handle === it.handle,
            )?.container;
            return itemFromLabel(it, origin);
          },
        )}
      </View>
    );
  }

  if (verb === 'talk') {
    return (
      <View style={acStyles.wrap}>
        <Bar verb={verb} onBack={() => setVerb(null)} />
        {chips(npcs, it => doCmd(`talk ${it.handle}`))}
      </View>
    );
  }

  // Default collapsed verb bar
  return (
    <View style={acStyles.bar}>
      {['examine', 'take', 'open', 'close', 'read', 'talk', 'use', 'put'].map(
        v => (
          <TouchableOpacity
            key={v}
            style={acStyles.btn}
            onPress={() => setVerb(v)}>
            <Text style={acStyles.btnText}>{v.toUpperCase()}</Text>
          </TouchableOpacity>
        ),
      )}
    </View>
  );
}

function Bar({verb, noun, onBack}) {
  return (
    <View style={acStyles.header}>
      <TouchableOpacity onPress={onBack} style={acStyles.back}>
        <Text style={{color: '#9bd'}}>Back</Text>
      </TouchableOpacity>
      <Text style={acStyles.headerText}>
        {verb.toUpperCase()} {noun ? `• ${noun}` : ''}
      </Text>
    </View>
  );
}

const acStyles = StyleSheet.create({
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
  row: {flexDirection: 'row', gap: 8, alignItems: 'center'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    justifyContent: 'space-between',
  },
  back: {paddingVertical: 4, paddingHorizontal: 8},
  headerText: {color: '#e6edf3', fontWeight: '600'},
});
