export function evaluateCommand(input, game, setGame) {
  const cleanedInput = input.toLowerCase().trim();
  const words = cleanedInput.split(' ');
  const command = words[0];
  const arg = words.slice(1).join(' ');

  const location = game.rooms[game.player.location];
  let output = '';

  switch (command) {
    case 'look':
    case 'l':
      output = location.description || 'You look around.';
      break;

    case 'go':
      output = handleMovement(arg, game, setGame);
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
