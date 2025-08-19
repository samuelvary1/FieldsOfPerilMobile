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
import ActionComposer from './ActionComposer';
import Chip from './Chip';
import TopIcon from './TopIcon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {evaluateCommand, movePlayer} from '../engine/GameEngine';
import MovementBar from './MovementBar';
import items from '../data/items_normalized.json';
import locations from '../data/locations_normalized.json';

export default function GameUI({navigation}) {
  const [log, setLog] = useState([]);
  const [input, setInput] = useState('');
  const [game, setGame] = useState(null);
  // const [recentCommands, setRecentCommands] = useState([]); // unused
  const [showExtras, setShowExtras] = useState(true); // Focus toggle
  // const [showRecents, setShowRecents] = useState(false); // unused
  const [showTyping, setShowTyping] = useState(__DEV__); // typing bar toggle (on in dev)

  const scrollViewRef = useRef(null);

  // Boot game
  useEffect(() => {
    const rooms = {};
    locations.forEach(room => {
      rooms[room.id] = {...room, been_before: false};
    });

    const itemMap = {};
    items.forEach(it => {
      itemMap[it.id] = it;
    });

    setGame({
      schemaVersion: 2,
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
    // setRecentCommands removed: recentCommands is unused
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

      {/* Current Room display */}
      <View style={styles.currentRoomBox}>
        <Text style={styles.currentRoomLabel}>Current Room</Text>
        <Text style={styles.currentRoomName}>
          {currentRoom?.header ||
            currentRoom?.title ||
            game?.player?.location ||
            'Unknown Room'}
        </Text>
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
              label="Look Around"
              icon="search"
              onPress={() => {
                if (!game) {
                  return;
                }
                appendLog(currentRoom.description || 'You look around.');
              }}
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

      {/* Recents collapsed by default - removed unused showRecents and recentCommands UI */}

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

// TopIcon is now imported from './TopIcon'

// Chip is now imported from './Chip'

function ActionIcon({icon, label, onPress}) {
  return (
    <TouchableOpacity style={styles.actionIcon} onPress={onPress}>
      <Icon name={icon} size={18} color="#fff" />
      <Text style={styles.actionIconText}>{label}</Text>
    </TouchableOpacity>
  );
}

// MovementBar is now imported from './MovementBar'

/* Styles */

const styles = StyleSheet.create({
  currentRoomBox: {
    backgroundColor: '#e6edf3',
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 2,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#bcd',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: {width: 0, height: 1},
  },
  currentRoomLabel: {
    color: '#2a3139',
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 2,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  currentRoomName: {
    color: '#1a1a1a',
    fontWeight: '600',
    fontSize: 18,
    letterSpacing: 0.5,
  },
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
  chipIcon: {marginRight: 6},
  chipText: {color: '#fff', fontSize: 14},
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

function Bar({verb, noun, onBack}) {
  return (
    <View style={acStyles.header}>
      <TouchableOpacity onPress={onBack} style={acStyles.back}>
        <Text style={acStyles.backText}>Back</Text>
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
