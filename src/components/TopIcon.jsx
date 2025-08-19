import React from 'react';
import {TouchableOpacity, Text, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

export default function TopIcon({icon, label, onPress}) {
  return (
    <TouchableOpacity style={styles.topIcon} onPress={onPress}>
      <Icon name={icon} size={16} color="#fff" />
      <Text style={styles.topIconLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
});
