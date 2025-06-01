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
import {evaluateCommand} from '../engine/GameEngine';
import items from '../data/items.json';
import locations from '../data/locations.json';

const GameUI = () => {
  const [log, setLog] = useState([]);
  const [input, setInput] = useState('');
  const [game, setGame] = useState(null);
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
        help: 'Available commands: go, look, take, open, use, examine, read, inventory, quit',
      },
    });
  }, []);

  const handleCommand = cmd => {
    if (!cmd.trim() || !game) {
      return;
    }
    const response = evaluateCommand(cmd.trim(), game, setGame);
    setLog(prev => [...prev, `> ${cmd}`, response]);
    setInput('');
  };

  const handleSubmit = () => handleCommand(input);

  if (!game) {
    return <Text style={styles.loading}>Loading...</Text>;
  }

  const currentRoom = game.rooms[game.player.location];
  const initialDesc = !currentRoom.been_before
    ? currentRoom.first_time_message
    : currentRoom.header;

  const directions = Object.keys(currentRoom.rooms || {});

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

      {/* Directions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Go:</Text>
        <View style={styles.buttonRow}>
          {directions.map(dir => (
            <TouchableOpacity
              key={dir}
              style={styles.button}
              onPress={() => handleCommand(`go ${dir}`)}>
              <Text style={styles.buttonText}>{dir.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Room Items */}
      {currentRoom.items?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items here:</Text>
          <View style={styles.buttonRow}>
            {currentRoom.items.map(item => (
              <TouchableOpacity
                key={item}
                style={styles.button}
                onPress={() => handleCommand(`take ${item}`)}>
                <Text style={styles.buttonText}>Take {item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Inventory */}
      {game.player.inventory.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inventory:</Text>
          <View style={styles.buttonRow}>
            {game.player.inventory.map(item => (
              <TouchableOpacity
                key={item}
                style={styles.button}
                onPress={() => handleCommand(`use ${item}`)}>
                <Text style={styles.buttonText}>Use {item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Commands:</Text>
        <View style={styles.buttonRow}>
          {['look', 'inventory', 'help'].map(cmd => (
            <TouchableOpacity
              key={cmd}
              style={styles.button}
              onPress={() => handleCommand(cmd)}>
              <Text style={styles.buttonText}>{cmd}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Command input box (still available) */}
      <TextInput
        style={styles.input}
        value={input}
        onChangeText={setInput}
        placeholder="Enter command..."
        placeholderTextColor="#888"
        onSubmitEditing={handleSubmit}
        returnKeyType="done"
      />
    </KeyboardAvoidingView>
  );
};

export default GameUI;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    padding: 20,
    paddingTop: 50,
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
  input: {
    height: 50,
    backgroundColor: '#2e2e2e',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#555',
  },
  loading: {
    marginTop: 60,
    color: '#aaa',
    fontSize: 18,
    textAlign: 'center',
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 4,
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
  buttonText: {
    color: '#fff',
    fontSize: 14,
  },
});
