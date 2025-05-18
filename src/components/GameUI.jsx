import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
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

  const handleSubmit = () => {
    if (!input.trim() || !game) {
      return;
    }

    const response = evaluateCommand(input.trim(), game, setGame);
    setLog(prev => [...prev, `> ${input}`, response]);
    setInput('');
  };

  if (!game) {
    return <Text style={styles.loading}>Loading...</Text>;
  }

  const currentRoom = game.rooms[game.player.location];
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
        <Text style={styles.text}>{initialDesc}</Text>
        {log.map((line, index) => (
          <Text key={index} style={styles.text}>
            {line}
          </Text>
        ))}
      </ScrollView>

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
});
