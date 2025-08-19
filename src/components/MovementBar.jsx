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
    backgroundColor: '#0f1419',
    borderRadius: 16,
    padding: 12,
    // Recessed well effect
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: -2,
    borderWidth: 2,
    borderColor: '#1a1f26',
    // Inner shadow effect (simulated with gradient-like border)
    borderTopColor: '#0a0d11',
    borderLeftColor: '#0a0d11',
    borderRightColor: '#1f242b',
    borderBottomColor: '#1f242b',
  },
  moveDockRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginVertical: 3,
  },
  mvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    // Raised rubber button effect
    backgroundColor: '#3a4248',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginHorizontal: 2,
    flexShrink: 1,
    minWidth: 65,
    maxWidth: 100,
    justifyContent: 'center',
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
  mvBtnDisabled: {
    opacity: 0.3,
    backgroundColor: '#252a30',
    shadowOpacity: 0.2,
    elevation: 1,
    borderTopColor: '#2a2f35',
    borderLeftColor: '#2a2f35',
    borderRightColor: '#1a1f25',
    borderBottomColor: '#1a1f25',
  },
  mvLabel: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 6,
    flexShrink: 1,
    flexWrap: 'wrap',
    fontWeight: '600',
    textShadowColor: '#000',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
});
