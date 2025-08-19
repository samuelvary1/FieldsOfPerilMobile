import React from 'react';
import {View, TouchableOpacity, Text, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

export function MoveBtn({dir, icon, label, exits, onMove}) {
  const enabled = exits.has(dir);
  return (
    <TouchableOpacity
      disabled={!enabled}
      onPress={() => enabled && onMove(dir)}
      style={[styles.mvBtn, !enabled && styles.mvBtnDisabled]}>
      <Icon name={icon} size={14} color="#fff" />
      <Text style={styles.mvLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function MovementBar({exits, onMove}) {
  return (
    <View style={styles.moveDock}>
      <MoveBtn
        dir="up"
        icon="chevron-up"
        label="UP"
        exits={exits}
        onMove={onMove}
      />
      <MoveBtn
        dir="north"
        icon="arrow-up"
        label="N"
        exits={exits}
        onMove={onMove}
      />
      <MoveBtn
        dir="west"
        icon="arrow-left"
        label="W"
        exits={exits}
        onMove={onMove}
      />
      <MoveBtn
        dir="east"
        icon="arrow-right"
        label="E"
        exits={exits}
        onMove={onMove}
      />
      <MoveBtn
        dir="south"
        icon="arrow-down"
        label="S"
        exits={exits}
        onMove={onMove}
      />
      <MoveBtn
        dir="down"
        icon="chevron-down"
        label="DOWN"
        exits={exits}
        onMove={onMove}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  moveDock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
    gap: 6,
  },
  mvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2e2e2e',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  mvBtnDisabled: {
    opacity: 0.4,
  },
  mvLabel: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 6,
  },
});
