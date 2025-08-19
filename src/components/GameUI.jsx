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
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {evaluateCommand, movePlayer} from '../engine/GameEngine';
import items from '../data/items.json';
import locations from '../data/locations.json';

const DIRS = ['north', 'south', 'east', 'west', 'up', 'down'];

const directionIcons = {
  north: 'arrow-up',
  south: 'arrow-down',
  east: 'arrow-right',
  west: 'arrow-left',
  up: 'chevron-up',
  down: 'chevron-down',
};

export default function GameUI({navigation}) {
  const [log, setLog] = useState([]);
  const [input, setInput] = useState('');
  const [game, setGame] = useState(null);
  const [recentCommands, setRecentCommands] = useState([]);
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
      rooms,
      items: itemMap,
      player: {location: 'apartment_living_room', inventory: []},
      messages: {
        help: 'Available commands: look, take, drop, put, open, close, use, examine, read, inventory, help. Movement uses the arrow buttons.',
      },
    });
  }, []);

  // Autosave whenever game changes
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

  const appendLog = (...lines) => {
    setLog(prev => [...prev, ...lines]);
  };

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

  const handleMove = dirWord => {
    if (!game) {
      return;
    }
    const result = movePlayer(dirWord, game, setGame);
    appendLog(`> move ${dirWord}`, result);
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

      {/* Movement */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Movement</Text>
        <View style={styles.moveGrid}>
          {/* Row 1: Up */}
          <View style={styles.centerRow}>
            <MoveButton
              label="UP"
              icon={directionIcons.up}
              enabled={exits.has('up')}
              onPress={() => handleMove('up')}
            />
          </View>

          {/* Row 2: North */}
          <View style={styles.centerRow}>
            <MoveButton
              label="NORTH"
              icon={directionIcons.north}
              enabled={exits.has('north')}
              onPress={() => handleMove('north')}
            />
          </View>

          {/* Row 3: West East */}
          <View style={styles.row}>
            <MoveButton
              label="WEST"
              icon={directionIcons.west}
              enabled={exits.has('west')}
              onPress={() => handleMove('west')}
            />
            <View style={{width: 12}} />
            <MoveButton
              label="EAST"
              icon={directionIcons.east}
              enabled={exits.has('east')}
              onPress={() => handleMove('east')}
            />
          </View>

          {/* Row 4: South */}
          <View style={styles.centerRow}>
            <MoveButton
              label="SOUTH"
              icon={directionIcons.south}
              enabled={exits.has('south')}
              onPress={() => handleMove('south')}
            />
          </View>

          {/* Row 5: Down */}
          <View style={styles.centerRow}>
            <MoveButton
              label="DOWN"
              icon={directionIcons.down}
              enabled={exits.has('down')}
              onPress={() => handleMove('down')}
            />
          </View>
        </View>
      </View>

      {/* Items in room quick take */}
      {currentRoom.items?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items in Room</Text>
          <View style={styles.buttonRow}>
            {currentRoom.items.map(item => (
              <TouchableOpacity
                key={item}
                style={styles.buttonIcon}
                onPress={() => handleCommand(`take ${item}`)}>
                <Icon name="archive" size={16} color="#fff" />
                <Text style={styles.buttonText}>Take {item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Inventory quick use and drop */}
      {game.player.inventory.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inventory</Text>
          <View style={styles.buttonRow}>
            {game.player.inventory.map(item => (
              <View key={item} style={styles.invPair}>
                <TouchableOpacity
                  style={styles.buttonIcon}
                  onPress={() => handleCommand(`use ${item}`)}>
                  <Icon name="key" size={16} color="#fff" />
                  <Text style={styles.buttonText}>Use {item}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.buttonIconSecondary}
                  onPress={() => handleCommand(`drop ${item}`)}>
                  <Icon name="trash" size={16} color="#fff" />
                  <Text style={styles.buttonText}>Drop {item}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <View style={styles.buttonRow}>
          {['look', 'inventory', 'help'].map(cmd => (
            <TouchableOpacity
              key={cmd}
              style={styles.buttonIcon}
              onPress={() => handleCommand(cmd)}>
              <Icon
                name={
                  cmd === 'look'
                    ? 'search'
                    : cmd === 'help'
                    ? 'question-circle'
                    : 'list'
                }
                size={16}
                color="#fff"
              />
              <Text style={styles.buttonText}>{cmd.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}

          {/* Save and Load */}
          <TouchableOpacity style={styles.buttonIcon} onPress={openSaveLoad}>
            <Icon name="save" size={16} color="#fff" />
            <Text style={styles.buttonText}>Save and Load</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent commands */}
      {recentCommands.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Commands</Text>
          <View style={styles.buttonRow}>
            {recentCommands.map(cmd => (
              <TouchableOpacity
                key={cmd}
                style={styles.button}
                onPress={() => handleCommand(cmd)}>
                <Text style={styles.buttonText}>{cmd}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a command..."
          placeholderTextColor="#888"
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSubmit}>
          <Icon name="arrow-circle-right" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function MoveButton({label, icon, enabled, onPress}) {
  return (
    <TouchableOpacity
      disabled={!enabled}
      style={[styles.buttonIcon, !enabled && styles.buttonIconDisabled]}
      onPress={onPress}>
      <Icon name={icon || 'arrows'} size={16} color="#fff" />
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  output: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  text: {
    color: '#e2e2e2',
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Courier',
    marginBottom: 4,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 4,
    marginTop: 8,
  },
  moveGrid: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerRow: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  invPair: {
    flexDirection: 'row',
    gap: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  button: {
    backgroundColor: '#3e3e3e',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  buttonIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3e3e3e',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  buttonIconSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5a3e3e',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  buttonIconDisabled: {
    opacity: 0.3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: Platform.OS === 'ios' ? 20 : 12,
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: '#2e2e2e',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#555',
  },
  sendButton: {
    backgroundColor: '#007BFF',
    marginLeft: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loading: {
    marginTop: 60,
    color: '#aaa',
    fontSize: 18,
    textAlign: 'center',
  },
});
