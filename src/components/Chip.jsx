import React from 'react';
import {Pressable, Text, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

export default function Chip({label, icon, onPress, onLongPress, meta}) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={styles.chip}>
      {icon ? (
        <Icon name={icon} size={14} color="#fff" style={styles.chipIcon} />
      ) : null}
      <Text style={styles.chipText}>{label}</Text>
      {meta ? <Text style={styles.badge}>{meta}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    // Raised rubber button effect (matching MovementBar)
    backgroundColor: '#3a4248',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginRight: 8,
    // Raised button shadows
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.6,
    shadowRadius: 3,
    elevation: 6,
    // Rubber-like border highlights
    borderWidth: 1.5,
    borderTopColor: '#4a5258',
    borderLeftColor: '#4a5258',
    borderRightColor: '#2a3036',
    borderBottomColor: '#2a3036',
  },
  chipIcon: {
    marginRight: 6,
    textShadowColor: '#000',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
  chipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: '#000',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
  badge: {
    color: '#cfe',
    fontSize: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#2a3b3a',
    borderRadius: 8,
    marginLeft: 4,
    textShadowColor: '#000',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 1,
  },
});
