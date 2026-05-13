/**
 * גיליון תחתון מ־+ — צירוף תוכן (אנימציה מלמטה, גרירה לסגירה / הרחבה למעלה).
 * רקע מתאים להרחבה; שורות רשימה תלויות עולם / יחידה פעילה.
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
  | 'wallet'
  | 'attach_ctx_unit_done'
  | 'attach_ctx_unit_blocker'
  | 'attach_ctx_unit_note'
  | 'attach_ctx_world_tip';

type ThemeColors = {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
};

export type AttachSheetContext = {
  /** צ׳אט פתוח — יש יחידה פעילה כשמוגדר */
  chatSheetOpen: boolean;
  worldId: string;
  /** תווית עולם לכותרת (מגלגל או מצ׳אט) */
  worldLabel?: string;
  /** כותרת יחידה כשהפרופיל/צ׳אט על יחידה */
  unitTitle: string | null;
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
  /** הקשר שממנו נפתח הפלוס — קובע המלצות ברשימה */
  attachContext?: AttachSheetContext;
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
const EXPAND_UP_PX = 240;
const BACKDROP_BOOST = 0.5;

type AttachSheetDragConfig = {
  translateY: Animated.Value;
  backdrop: Animated.Value;
  dragStartY: React.MutableRefObject<number>;
  runClose: (notify?: () => void) => void;
  onClose: () => void;
};

/** גרירה לסגירה / הרחבה — משותף לגיליון ולאזור ההדר (הטקסט לא חוסם מגע) */
function createAttachSheetDragResponder({
  translateY,
  backdrop,
  dragStartY,
  runClose,
  onClose,
}: AttachSheetDragConfig) {
  return PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && g.dy > Math.abs(g.dx) * 0.6,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      translateY.stopAnimation((v) => {
        dragStartY.current = typeof v === 'number' ? v : 0;
      });
    },
    onPanResponderMove: (_, g) => {
      const y = Math.max(-EXPAND_UP_PX, dragStartY.current + g.dy);
      translateY.setValue(y);
      if (y < 0) {
        const ratio = Math.min(1, Math.abs(y) / EXPAND_UP_PX);
        backdrop.setValue(1 + ratio * BACKDROP_BOOST);
      } else {
        backdrop.setValue(1);
      }
    },
    onPanResponderRelease: (_, g) => {
      const y = Math.max(-EXPAND_UP_PX, dragStartY.current + g.dy);
      if (y > CLOSE_DRAG_PX || g.vy > CLOSE_VELOCITY) {
        runClose(onClose);
      } else {
        const shouldStayExpanded = y < -EXPAND_UP_PX * 0.45;
        const targetY = shouldStayExpanded ? -EXPAND_UP_PX : 0;
        const targetBackdrop = shouldStayExpanded ? 1 + BACKDROP_BOOST : 1;
        Animated.parallel([
          Animated.spring(translateY, {
            toValue: targetY,
            stiffness: 520,
            damping: 38,
            useNativeDriver: true,
          }),
          Animated.timing(backdrop, {
            toValue: targetBackdrop,
            duration: 170,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      }
    },
  });
}

/** רקע קבוצת האריחים — surface כדי שלא ייחתך «חור» כהה מול הרקע הכללי */
function groupChromeBg(colors: ThemeColors): string {
  return colors.surface;
}

function worldTipRow(worldId: string): { id: AttachActionId; emoji: string; he: string; en: string } {
  switch (worldId) {
    case 'health':
      return {
        id: 'attach_ctx_world_tip',
        emoji: '🩺',
        he: 'טיפ מהיר: מה למדוד השבוע?',
        en: 'Quick tip: what will you track this week?',
      };
    case 'finance':
      return {
        id: 'attach_ctx_world_tip',
        emoji: '💰',
        he: 'הדבקה מהירה: תנועה / סיכום מהלוח',
        en: 'Quick paste: a bank line or total from clipboard',
      };
    case 'knowledge':
      return {
        id: 'attach_ctx_world_tip',
        emoji: '📚',
        he: 'הדבקה: נושא או שאלה ללימוד',
        en: 'Paste a topic or exam question to study',
      };
    case 'business':
      return {
        id: 'attach_ctx_world_tip',
        emoji: '💼',
        he: 'רשימת משימות — מה הדבר הבא?',
        en: 'Tasks: what is the very next move?',
      };
    case 'leisure':
      return {
        id: 'attach_ctx_world_tip',
        emoji: '🎭',
        he: 'מה בא לך הפעם? רעיון קצר',
        en: 'What do you feel like? One short idea',
      };
    case 'relations':
      return {
        id: 'attach_ctx_world_tip',
        emoji: '💬',
        he: 'מי או מה חשוב לעדכן עכשיו?',
        en: 'Who or what needs a gentle update now?',
      };
    default:
      return {
        id: 'attach_ctx_world_tip',
        emoji: '✨',
        he: 'רעיון קצר לסוכן',
        en: 'Short idea for your agent',
      };
  }
}

function buildListRows(
  hideChatRow: boolean,
  ctx: AttachSheetContext
): { id: AttachActionId; emoji: string; he: string; en: string }[] {
  const chat = hideChatRow ? [] : [CHAT_ROW];
  const inUnit = ctx.chatSheetOpen && !!ctx.unitTitle?.trim();
  /** המלצת עולם גם מהגלגל כשהצ׳אט סגור */
  const inWorldOnly = !inUnit && ctx.worldId !== 'personal';

  if (inUnit) {
    const t = ctx.unitTitle!.trim();
    return [
      ...chat,
      {
        id: 'attach_ctx_unit_done',
        emoji: '✅',
        he: `סימון צעד בוצע · «${t}»`,
        en: `Log step done · “${t}”`,
      },
      {
        id: 'attach_ctx_unit_blocker',
        emoji: '🧱',
        he: `חוסם / דחף · «${t}»`,
        en: `Blocker / friction · “${t}”`,
      },
      {
        id: 'attach_ctx_unit_note',
        emoji: '📝',
        he: `הערה לסוכן · «${t}»`,
        en: `Note for agent · “${t}”`,
      },
      ...LIST_ACTIONS,
    ];
  }

  if (inWorldOnly) {
    return [...chat, worldTipRow(ctx.worldId), ...LIST_ACTIONS];
  }

  return [...chat, ...LIST_ACTIONS];
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
  attachContext,
}: Props) {
  const ctx: AttachSheetContext = attachContext ?? {
    chatSheetOpen: false,
    worldId: 'personal',
    worldLabel: undefined,
    unitTitle: null,
  };

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

  const sheetPanResponder = useMemo(
    () =>
      createAttachSheetDragResponder({
        translateY,
        backdrop,
        dragStartY,
        runClose,
        onClose,
      }),
    [translateY, backdrop, runClose, onClose]
  );
  /** אותה לוגיקה — מופרד כדי לאפשר גרירה מההדר בלי שהטקסט יבלע את המגע */
  const headerDragPanResponder = useMemo(
    () =>
      createAttachSheetDragResponder({
        translateY,
        backdrop,
        dragStartY,
        runClose,
        onClose,
      }),
    [translateY, backdrop, runClose, onClose]
  );

  const scrimOpacity = backdrop.interpolate({
    inputRange: [0, 1, 1 + BACKDROP_BOOST],
    outputRange: [0, 0.42, 0.62],
    extrapolate: 'clamp',
  });

  /** מילוי תחתון כשגוררים למעלה — מונע «חיתוך» רקע (רווח שחור מתחת לגיליון) */
  const expandPadOpacity = translateY.interpolate({
    inputRange: [-EXPAND_UP_PX, -24, 0],
    outputRange: [1, 0.35, 0],
    extrapolate: 'clamp',
  });

  const groupBg = groupChromeBg(colors);

  const listRows = useMemo(() => buildListRows(hideChatRow, ctx), [hideChatRow, ctx.chatSheetOpen, ctx.worldId, ctx.unitTitle]);

  const label = (row: { he: string; en: string }) => (language === 'he' ? row.he : row.en);

  const sheetTitle = useMemo(() => {
    if (ctx.chatSheetOpen && ctx.unitTitle?.trim()) {
      const t = ctx.unitTitle.trim();
      return language === 'he' ? `צירוף · ${t}` : `Attach · ${t}`;
    }
    if (ctx.worldId !== 'personal' && ctx.worldLabel?.trim()) {
      const w = ctx.worldLabel.trim();
      return language === 'he' ? `צירוף · ${w}` : `Attach · ${w}`;
    }
    return language === 'he' ? 'מה לצרף?' : 'Attach';
  }, [ctx.chatSheetOpen, ctx.unitTitle, ctx.worldId, ctx.worldLabel, language]);

  if (!visible && !presented) return null;

  const sheetOverflow = Platform.OS === 'web' ? ('visible' as const) : ('hidden' as const);

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => runClose(onClose)}>
      <View style={styles.wrap}>
        <Pressable style={styles.scrimPress} onPress={() => runClose(onClose)}>
          <Animated.View style={[styles.scrimFill, { opacity: scrimOpacity }]} />
        </Pressable>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.expandPad,
            {
              height: EXPAND_UP_PX + sheetBottomInset + 32,
              backgroundColor: colors.surface,
              zIndex: 1,
              opacity: expandPadOpacity,
            },
          ]}
        />
        <Animated.View
          {...sheetPanResponder.panHandlers}
          style={[
            styles.sheetLift,
            {
              transform: [{ translateY }],
              backgroundColor: colors.surface,
              borderTopLeftRadius: 14,
              borderTopRightRadius: 14,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.border,
              paddingBottom: Math.max(18, sheetBottomInset + 12),
              overflow: sheetOverflow,
              zIndex: 2,
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
            <View {...headerDragPanResponder.panHandlers} style={styles.dragZone}>
              <View pointerEvents="none">
                <View style={[styles.handle, { backgroundColor: colors.textSecondary }]} />
                <Text style={[styles.title, { color: colors.textSecondary }]} numberOfLines={2}>
                  {sheetTitle}
                </Text>
              </View>
            </View>

            <View style={[styles.tileGroup, { backgroundColor: groupBg, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}>
              <View style={[styles.tileRow, isRtl && styles.tileRowRtl]}>
                {TILE_ACTIONS.map((row) => (
                  <TouchableOpacity
                    key={row.id}
                    style={styles.tileCell}
                    activeOpacity={0.65}
                    onPress={() => onPick(row.id)}
                  >
                    <View style={[styles.tileIconWrap, { backgroundColor: colors.background }]}>
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

            <View style={[styles.listGroup, { borderColor: colors.border, direction: 'ltr' }]}>
              {listRows.map((row, i) => (
                <TouchableOpacity
                  key={`${row.id}_${i}`}
                  style={[
                    styles.listRow,
                    i < listRows.length - 1
                      ? { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }
                      : null,
                  ]}
                  activeOpacity={0.72}
                  onPress={() => onPick(row.id)}
                >
                  {isRtl ? (
                    <>
                      <Text style={[styles.listLabel, { color: colors.text, textAlign: ta, writingDirection: wd }]}>
                        {label(row)}
                      </Text>
                      <Text style={styles.listEmoji}>{row.emoji}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.listEmoji}>{row.emoji}</Text>
                      <Text style={[styles.listLabel, { color: colors.text, textAlign: ta, writingDirection: wd }]}>
                        {label(row)}
                      </Text>
                    </>
                  )}
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
  expandPad: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetLift: {
    zIndex: 2,
    width: '100%',
  },
  sheet: {
    paddingTop: 4,
    paddingHorizontal: 12,
    maxHeight: '78%',
  },
  dragZone: {
    paddingTop: 6,
    paddingBottom: 12,
    minHeight: 56,
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
    paddingHorizontal: 8,
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
