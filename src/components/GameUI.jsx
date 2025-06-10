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
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import {evaluateCommand} from '../engine/GameEngine';
import items from '../data/items.json';
import locations from '../data/locations.json';

const GameUI = () => {
  const [log, setLog] = useState([]);
  const [input, setInput] = useState('');
  const [game, setGame] = useState(null);
  const [recentCommands, setRecentCommands] = useState([]);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    const rooms = {};
    locations.forEach(room => {
      rooms[room.title] = {...room, been_before: false};
    });

    const itemMap = {};
    items.forEach(item => {
      itemMap[item.handle] = item;
    });

    setGame({
      rooms,
      items: itemMap,
      player: {location: 'apartment_living_room', inventory: []},
      messages: {
        help: 'Available commands: go, look, take, open, use, examine, read, inventory, quit, hint',
      },
    });
  }, []);

  const handleCommand = cmd => {
    console.log('handleCommand received:', cmd);
    if (!cmd.trim() || !game) {
      return;
    }
    const response = evaluateCommand(cmd.trim(), game, setGame);
    setLog(prev => [...prev, `> ${cmd}`, response]);
    setRecentCommands(prev =>
      [cmd, ...prev.filter(c => c !== cmd)].slice(0, 5),
    );
    setInput('');
  };

  const handleSubmit = () => handleCommand(input);

  if (!game) {
    return <Text style={styles.loading}>Loading...</Text>;
  }

  const currentRoom = game.rooms[game.player.location];
  const directions = Object.keys(currentRoom.rooms || {});
  const initialDesc = !currentRoom.been_before
    ? currentRoom.first_time_message
    : currentRoom.header;

  const directionIcons = {
    north: 'arrow-up',
    south: 'arrow-down',
    east: 'arrow-right',
    west: 'arrow-left',
    up: 'chevron-up',
    down: 'chevron-down',
  };

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
        <Text style={styles.text}>{initialDesc}</Text>
        {log.map((line, index) => (
          <Text key={index} style={styles.text}>
            {line}
          </Text>
        ))}
      </ScrollView>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Movement:</Text>
        <View style={styles.buttonRow}>
          {directions.map(dir => {
            console.log('Rendering direction button for:', dir); // ✅ Add this
            return (
              <TouchableOpacity
                key={dir}
                style={styles.buttonIcon}
                onPress={() => handleCommand(`go ${dir}`)}>
                <Icon
                  name={directionIcons[dir] || 'arrows'}
                  size={16}
                  color="#fff"
                />
                <Text style={styles.buttonText}>{dir.toUpperCase()}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {currentRoom.items?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items in Room:</Text>
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

      {game.player.inventory.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inventory:</Text>
          <View style={styles.buttonRow}>
            {game.player.inventory.map(item => (
              <TouchableOpacity
                key={item}
                style={styles.buttonIcon}
                onPress={() => handleCommand(`use ${item}`)}>
                <Icon name="key" size={16} color="#fff" />
                <Text style={styles.buttonText}>Use {item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions:</Text>
        <View style={styles.buttonRow}>
          {['look', 'inventory', 'help', 'hint'].map(cmd => (
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
                    : cmd === 'hint'
                    ? 'lightbulb-o'
                    : 'list'
                }
                size={16}
                color="#fff"
              />
              <Text style={styles.buttonText}>{cmd.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {recentCommands.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Commands:</Text>
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
};

export default GameUI;

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
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
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
