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
});
