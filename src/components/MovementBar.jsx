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
    <View style={styles.moveDockWrap}>
      <View style={styles.moveDockRow}>
        <MoveBtn
          dir="up"
          icon="chevron-up"
          label="UP"
          exits={exits}
          onMove={onMove}
        />
      </View>
      <View style={styles.moveDockRow}>
        <MoveBtn
          dir="west"
          icon="arrow-left"
          label="W"
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
      </View>
      <View style={styles.moveDockRow}>
        <MoveBtn
          dir="down"
          icon="chevron-down"
          label="DOWN"
          exits={exits}
          onMove={onMove}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  moveDockWrap: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 8,
  },
  moveDockRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginVertical: 2,
  },
  mvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2e2e2e',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginHorizontal: 2,
    flexShrink: 1,
    minWidth: 60,
    maxWidth: 100,
    justifyContent: 'center',
  },
  mvBtnDisabled: {
    opacity: 0.4,
  },
  mvLabel: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 6,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
});
