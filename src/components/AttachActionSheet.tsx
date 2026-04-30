/**
 * גיליון תחתון מ־+ — צירוף תוכן (אנימציה מלמטה, גרירה לסגירה, אריחים + רשימה).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Animated,
  Dimensions,
  PanResponder,
  Easing,
  Platform,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppLanguage } from '../stores/localeStore';

export type AttachActionId =
  | 'chat'
  | 'gallery'
  | 'camera'
  | 'contact'
  | 'document'
  | 'location'
  | 'clipboard'
  | 'wallet';

type ThemeColors = {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  language: AppLanguage;
  isRtl: boolean;
  colors: ThemeColors;
  bottomInset: number;
  hideChatRow: boolean;
  onPick: (id: AttachActionId) => void;
};

const TILE_ACTIONS: { id: AttachActionId; emoji: string; he: string; en: string }[] = [
  { id: 'gallery', emoji: '🖼️', he: 'גלריה', en: 'Photos' },
  { id: 'camera', emoji: '📷', he: 'מצלמה', en: 'Camera' },
  { id: 'clipboard', emoji: '📋', he: 'לוח', en: 'Paste' },
  { id: 'document', emoji: '📎', he: 'קובץ', en: 'Files' },
];

const LIST_ACTIONS: { id: AttachActionId; emoji: string; he: string; en: string }[] = [
  { id: 'contact', emoji: '👤', he: 'איש קשר', en: 'Contact' },
  { id: 'location', emoji: '📍', he: 'מיקום', en: 'Location' },
  { id: 'wallet', emoji: '💳', he: 'ארנק', en: 'Wallet' },
];

const CHAT_ROW: { id: AttachActionId; emoji: string; he: string; en: string } = {
  id: 'chat',
  emoji: '💬',
  he: 'פתח צ׳אט',
  en: 'Open chat',
};

const OFFSCREEN_PAD = 48;
const CLOSE_DRAG_PX = 96;
const CLOSE_VELOCITY = 0.85;

/** רקע קבוצה — ניגוד עדין מול ה־sheet (surface) */
function groupChromeBg(colors: ThemeColors): string {
  return colors.background;
}

export function AttachActionSheet({
  visible,
  onClose,
  language,
  isRtl,
  colors,
  bottomInset,
  hideChatRow,
  onPick,
}: Props) {
  const ta = isRtl ? 'right' : 'left';
  const wd: 'rtl' | 'ltr' = isRtl ? 'rtl' : 'ltr';
  const winH = Dimensions.get('window').height;
  const safeInsets = useSafeAreaInsets();
  /** ב־Modal ה־inset מההורה לפעמים 0 — משווים ל־safe area מקומי (במיוחד iOS למטה) */
  const sheetBottomInset = Math.max(
    bottomInset,
    safeInsets.bottom,
    Platform.OS === 'ios' ? 20 : 0
  );

  const [presented, setPresented] = useState(false);
  const sheetHeightRef = useRef(320);
  const translateY = useRef(new Animated.Value(winH)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const dragStartY = useRef(0);
  const closingRef = useRef(false);

  const runClose = useCallback(
    (notify?: () => void) => {
      if (closingRef.current) return;
      closingRef.current = true;
      const drop = sheetHeightRef.current + OFFSCREEN_PAD;
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: drop,
          duration: 240,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        closingRef.current = false;
        if (finished) {
          setPresented(false);
          notify?.();
        }
      });
    },
    [backdrop, translateY]
  );

  useEffect(() => {
    if (!visible) return;
    setPresented(true);
    closingRef.current = false;
    const from = Math.min(winH * 0.55, sheetHeightRef.current + OFFSCREEN_PAD);
    translateY.setValue(from);
    backdrop.setValue(0);
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        stiffness: 420,
        damping: 36,
        mass: 0.85,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, winH, translateY, backdrop]);

  useEffect(() => {
    if (visible) return;
    if (!presented) return;
    runClose();
  }, [visible, presented, runClose]);

  const onSheetLayout = useCallback((e: LayoutChangeEvent) => {
    sheetHeightRef.current = e.nativeEvent.layout.height;
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && g.dy > Math.abs(g.dx) * 0.6,
        onPanResponderGrant: () => {
          translateY.stopAnimation((v) => {
            dragStartY.current = typeof v === 'number' ? v : 0;
          });
        },
        onPanResponderMove: (_, g) => {
          const y = Math.max(0, dragStartY.current + g.dy);
          translateY.setValue(y);
        },
        onPanResponderRelease: (_, g) => {
          const y = Math.max(0, dragStartY.current + g.dy);
          if (y > CLOSE_DRAG_PX || g.vy > CLOSE_VELOCITY) {
            runClose(onClose);
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              stiffness: 520,
              damping: 38,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [translateY, runClose, onClose]
  );

  const scrimOpacity = backdrop.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.42],
  });

  const groupBg = groupChromeBg(colors);

  const listRows = useMemo(() => {
    const chat = hideChatRow ? [] : [CHAT_ROW];
    return [...chat, ...LIST_ACTIONS];
  }, [hideChatRow]);

  const label = (row: { he: string; en: string }) => (language === 'he' ? row.he : row.en);

  if (!visible && !presented) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => runClose(onClose)}>
      <View style={styles.wrap}>
        <Pressable style={styles.scrimPress} onPress={() => runClose(onClose)}>
          <Animated.View style={[styles.scrimFill, { opacity: scrimOpacity }]} />
        </Pressable>
        <Animated.View
          style={[
            styles.sheetLift,
            {
              transform: [{ translateY }],
              backgroundColor: colors.surface,
              borderTopLeftRadius: 14,
              borderTopRightRadius: 14,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.border,
              /** רקע + padding על המעטפת — מכסה עד קצה המסך מתחת לתוכן (בלי רווח שחור) */
              paddingBottom: Math.max(18, sheetBottomInset + 12),
            },
          ]}
        >
          <View
            style={[
              styles.sheet,
              {
                direction: isRtl ? 'rtl' : 'ltr',
              },
            ]}
            onLayout={onSheetLayout}
          >
            <View {...panResponder.panHandlers} style={styles.dragZone}>
              <View style={[styles.handle, { backgroundColor: colors.textSecondary }]} />
              <Text style={[styles.title, { color: colors.textSecondary }]}>
                {language === 'he' ? 'מה לצרף?' : 'Attach'}
              </Text>
            </View>

            <View style={[styles.tileGroup, { backgroundColor: groupBg }]}>
              <View style={[styles.tileRow, isRtl && styles.tileRowRtl]}>
                {TILE_ACTIONS.map((row) => (
                  <TouchableOpacity
                    key={row.id}
                    style={styles.tileCell}
                    activeOpacity={0.65}
                    onPress={() => onPick(row.id)}
                  >
                    <View style={[styles.tileIconWrap, { backgroundColor: colors.surface }]}>
                      <Text style={styles.tileEmoji}>{row.emoji}</Text>
                    </View>
                    <Text
                      style={[styles.tileCaption, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {label(row)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.listGroup, { borderColor: colors.border }]}>
              {listRows.map((row, i) => (
                <TouchableOpacity
                  key={row.id}
                  style={[
                    styles.listRow,
                    i < listRows.length - 1
                      ? { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }
                      : null,
                  ]}
                  activeOpacity={0.72}
                  onPress={() => onPick(row.id)}
                >
                  <Text style={styles.listEmoji}>{row.emoji}</Text>
                  <Text style={[styles.listLabel, { color: colors.text, textAlign: ta, writingDirection: wd }]}>
                    {label(row)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.cancelPill, { backgroundColor: groupBg }]}
              onPress={() => runClose(onClose)}
              activeOpacity={0.75}
            >
              <Text style={[styles.cancelText, { color: colors.text }]}>
                {language === 'he' ? 'ביטול' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrimPress: {
    ...StyleSheet.absoluteFillObject,
  },
  scrimFill: {
    flex: 1,
    backgroundColor: '#000',
  },
  sheetLift: {
    zIndex: 2,
    width: '100%',
    overflow: 'hidden',
  },
  sheet: {
    paddingTop: 4,
    paddingHorizontal: 12,
    maxHeight: '78%',
    overflow: 'hidden',
  },
  dragZone: {
    paddingTop: 6,
    paddingBottom: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    marginBottom: 10,
    opacity: 0.35,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  tileGroup: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  tileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tileRowRtl: {
    flexDirection: 'row-reverse',
  },
  tileCell: {
    flex: 1,
    alignItems: 'center',
    maxWidth: '25%',
  },
  tileIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  tileEmoji: {
    fontSize: 26,
  },
  tileCaption: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  listGroup: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 10,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 12,
  },
  listEmoji: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  listLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  cancelPill: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
