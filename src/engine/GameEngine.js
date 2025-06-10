import nlp from 'compromise';
import Fuse from 'fuse.js';
import get from 'lodash/get';
import {createMachine, interpret} from 'xstate';
import {Story} from 'inkjs';
// If using Ink, make sure you've compiled a story into JSON
// import storyContent from '../stories/story.json'; // Optional

// Optional: Ink integration
// const story = new Story(storyContent);

export function evaluateCommand(input, game, setGame) {
  const location = game.rooms[game.player.location];
  let output = '';

  // Stop words and default responses
  const stopWords = ['to', 'at', 'the', 'a', 'an', 'on', 'in', 'with', 'into'];
  const defaultItemResponses = {
    take: "That thing won't budge.",
    use: "You can't think of a way to use that right now.",
    talk: "It doesn't seem to have anything to say.",
    open: "You can't open that.",
    read: 'There’s nothing to read here.',
    examine: "There's nothing particularly interesting.",
  };

  // Parse command using compromise
  const cleanedInput = input.toLowerCase().trim();
  const doc = nlp(cleanedInput);
  const command = doc.verbs().out('array')[0] || cleanedInput.split(/\s+/)[0];
  const nounParts = cleanedInput
    .split(/\s+/)
    .slice(1)
    .filter(w => !stopWords.includes(w));
  const noun = nounParts.join(' ');

  // Normalize plural
  const normalize = word => (word?.endsWith('s') ? word.slice(0, -1) : word);

  // Fuzzy item matching with Fuse
  const fuse = new Fuse(Object.values(game.items), {
    keys: ['handle', 'alt_handle'],
    threshold: 0.3,
  });

  const getItemByHandle = name => {
    const normalized = normalize(name);
    const exact = Object.values(game.items).find(
      item => item.handle === normalized || item.alt_handle === normalized,
    );
    if (exact) {
      return exact;
    }

    const result = fuse.search(normalized);
    return result.length > 0 ? result[0].item : null;
  };

  const performItemAction = (itemName, action) => {
    const item = getItemByHandle(itemName);
    if (!item) {
      return `You don't see a "${itemName}" here.`;
    }

    // Semantic example: block actions if item is fixed
    if (action === 'take' && get(item, 'mobile') === false) {
      return "That thing won't budge.";
    }

    return (
      item.responses?.[action] ||
      defaultItemResponses[action] ||
      'Nothing happens.'
    );
  };

  // Optional: XState character example
  const guardDialogue = createMachine({
    id: 'guard',
    initial: 'idle',
    states: {
      idle: {
        on: {TALK: 'intro'},
      },
      intro: {
        entry: () => {
          output = 'Guard: Halt! Who goes there?';
        },
        on: {ASK_KEY: 'giveKey', BYE: 'idle'},
      },
      giveKey: {
        entry: () => {
          output = 'Guard: Here, take this key.';
        },
        type: 'final',
      },
    },
  });
  const guardService = interpret(guardDialogue).start();

  switch (command) {
    case 'look':
    case 'l':
      output = location.description || 'You look around.';
      break;

    case 'go':
      output = handleMovement(noun, game, setGame);
      break;

    case 'inventory':
    case 'i':
      output = game.player.inventory.length
        ? `You are carrying: ${game.player.inventory.join(', ')}`
        : "You're not carrying anything.";
      break;

    case 'help':
    case 'h':
      output = game.messages.help;
      break;

    case 'use':
    case 'talk':
    case 'open':
    case 'read':
    case 'examine':
      if (!noun) {
        output = `What do you want to ${command}?`;
      } else {
        // Optional: trigger guard dialogue by name
        if (noun.includes('guard')) {
          guardService.send('TALK');
        } else {
          output = performItemAction(noun, command);
        }
      }
      break;

    // Optional: Ink story branch
    // case 'story':
    //   output = story.Continue();
    //   break;

    default:
      output = "I don't understand that command.";
      break;
  }

  return output;
}

function handleMovement(direction, game, setGame) {
  const currentRoom = game.rooms[game.player.location];
  const nextRoomKey = currentRoom.rooms?.[direction];

  if (!nextRoomKey) {
    return `You can't go ${direction} from here.`;
  }

  const nextRoom = game.rooms[nextRoomKey];

  setGame(prevGame => ({
    ...prevGame,
    player: {
      ...prevGame.player,
      location: nextRoomKey,
    },
    rooms: {
      ...prevGame.rooms,
      [nextRoomKey]: {
        ...nextRoom,
        been_before: true,
      },
    },
  }));

  return !nextRoom.been_before
    ? nextRoom.first_time_message || 'You enter a new place.'
    : nextRoom.header || 'You arrive.';
}
