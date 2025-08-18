import nlp from 'compromise';
import Fuse from 'fuse.js';
import get from 'lodash/get';
import {createMachine, interpret} from 'xstate';

export function evaluateCommand(input, game, setGame) {
  const directionWords = [
    'up',
    'down',
    'north',
    'south',
    'east',
    'west',
    'climbup',
    'climbdown',
    'upstairs',
    'downstairs',
    'ascend',
    'descend',
  ];
  const location = game.rooms[game.player.location];
  let output = '';

  const stopWords = [
    'to',
    'at',
    'the',
    'a',
    'an',
    'on',
    'in',
    'with',
    'into',
    // 'up', // removed so directions are not filtered out
  ];

  const defaultItemResponses = {
    take: "That thing won't budge.",
    use: "You can't think of a way to use that right now.",
    talk: "It doesn't seem to have anything to say.",
    open: "You can't open that.",
    read: 'There’s nothing to read here.',
    examine: "There's nothing particularly interesting.",
  };

  const aliasMap = {
    grab: 'take',
    pickup: 'take',
    'pick up': 'take',
    inspect: 'examine',
    check: 'examine',
    look: 'look',
    talk: 'talk',
    speak: 'talk',
    use: 'use',
    read: 'read',
    open: 'open',
    go: 'go',
    move: 'go',
  };

  const normalize = word => (word?.endsWith('s') ? word.slice(0, -1) : word);

  const fuse = new Fuse(Object.values(game.items), {
    keys: ['handle', 'alt_handle', 'name'],
    threshold: 0.3,
  });

  const getItemByHandle = name => {
    const normalized = normalize(name);
    const exact = Object.values(game.items).find(
      item =>
        item.handle === normalized ||
        item.alt_handle === normalized ||
        item.name?.toLowerCase() === normalized,
    );
    if (exact) {
      return exact;
    }
    const result = fuse.search(normalized);
    return result.length > 0 ? result[0].item : null;
  };

  const cleanedInput = input.toLowerCase().trim();
  const doc = nlp(cleanedInput);
  const terms = cleanedInput.split(/\s+/).filter(w => !stopWords.includes(w));

  let command = doc.verbs().out('array')[0] || terms[0];
  command = aliasMap[command] || command;

  let noun = '';
  let target = '';

  if (cleanedInput.includes(' on ')) {
    const [first, second] = cleanedInput.split(' on ');
    const firstWords = first.split(/\s+/).filter(w => !stopWords.includes(w));
    const secondWords = second.split(/\s+/).filter(w => !stopWords.includes(w));
    command = aliasMap[firstWords[0]] || firstWords[0];
    noun = firstWords.slice(1).join(' ');
    target = secondWords.join(' ');
  } else {
    noun = terms.slice(1).join(' ');
  }

  const performItemAction = (itemName, action) => {
    const item = getItemByHandle(itemName);
    if (!item) {
      return `You don't see a "${itemName}" here.`;
    }
    if (action === 'take' && get(item, 'properties.mobile') === false) {
      return "That thing won't budge.";
    }
    return (
      item.responses?.[action] ||
      defaultItemResponses[action] ||
      'Nothing happens.'
    );
  };

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
    case 'up':
    case 'down':
    case 'north':
    case 'south':
    case 'east':
    case 'west':
      output = handleMovement(command, game, setGame);
      break;
    case 'look':
    case 'l': {
      if (cleanedInput.startsWith('look in ')) {
        const containerName = cleanedInput.replace('look in ', '');
        const container = getItemByHandle(containerName);
        if (!container) {
          output = `You don't see a "${containerName}" here.`;
        } else if (!container.properties?.container) {
          output = `You can't look inside the ${container.handle}.`;
        } else if (!container.properties.open) {
          output = `The ${container.handle} is closed.`;
        } else {
          const contents = container.contents || [];
          if (contents.length === 0) {
            output = `The ${container.handle} is empty.`;
          } else {
            const contentNames = contents
              .map(id => game.items[id]?.name || id)
              .join(', ');
            output = `Inside the ${container.handle}, you see: ${contentNames}.`;
          }
        }
      } else if (cleanedInput.startsWith('look at ')) {
        const itemName = cleanedInput.replace('look at ', '');
        const item = getItemByHandle(itemName);
        if (item) {
          output =
            item.description ||
            `You see nothing special about the ${itemName}.`;
        } else {
          output = `You don't see a "${itemName}" here.`;
        }
      } else {
        output = location.description || 'You look around.';
      }
      break;
    }

    case 'go':
      console.log('direction', noun);
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

    case 'use': {
      if (noun && target) {
        const item = getItemByHandle(noun);
        const targetItem = getItemByHandle(target);

        if (!item || !targetItem) {
          output = `You can't use ${noun} on ${target}.`;
        } else if (
          item.tags.includes('key') &&
          targetItem.tags.includes('access point') &&
          item.code === targetItem.code
        ) {
          targetItem.properties.locked = false;
          output = `You unlock the ${targetItem.handle} with the ${item.handle}.`;
        } else {
          output = 'Nothing happens.';
        }
      } else {
        output = performItemAction(noun, 'use');
      }
      break;
    }

    case 'talk':
    case 'open':
    case 'read':
    case 'examine': {
      if (!noun) {
        output = `What do you want to ${command}?`;
      } else if (noun.includes('guard')) {
        guardService.send('TALK');
      } else {
        output = performItemAction(noun, command);
      }
      break;
    }

    case 'take': {
      const item = getItemByHandle(noun);
      if (!item) {
        output = `You don't see a "${noun}" here.`;
      } else if (!item.properties?.mobile) {
        output = "That thing won't budge.";
      } else {
        if (!game.player.inventory.includes(item.handle)) {
          game.player.inventory.push(item.handle);
          item.location = 'inventory';
          output = `You take the ${item.handle}.`;
        } else {
          output = `You already have the ${item.handle}.`;
        }
      }
      break;
    }

    default:
      // Fallback: if the original input is a direction, treat as movement
      const inputWord = cleanedInput.split(/\s+/)[0];
      if (directionWords.includes(inputWord)) {
        output = handleMovement(inputWord, game, setGame);
      } else {
        output = "I don't understand that command.";
      }
      break;
  }

  return output;
}

function handleMovement(rawDirection, game, setGame) {
  const directionAliases = {
    up: 'up',
    climbup: 'up',
    upstairs: 'up',
    ascend: 'up',

    down: 'down',
    climbdown: 'down',
    downstairs: 'down',
    descend: 'down',

    north: 'north',
    south: 'south',
    east: 'east',
    west: 'west',
  };

  // Normalize the input direction: remove spaces and lowercase
  const cleaned = rawDirection.toLowerCase().replace(/\s+/g, '');
  const normalizedDirection =
    directionAliases[cleaned] || rawDirection.toLowerCase().trim();

  const currentRoom = game.rooms[game.player.location];
  const nextRoomKey = currentRoom.rooms?.[normalizedDirection];

  if (!nextRoomKey) {
    return `You can't go ${normalizedDirection} from here.`;
  }

  const nextRoom = game.rooms[nextRoomKey];

  if (!nextRoom) {
    return `Something blocks your way ${normalizedDirection}.`;
  }

  // Update game state
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
