/**
 * סגנונות תואמים לקלף צ׳אט הסוכן ב-OneScreen (כותרת, בועות, אזור גלילה).
 */
import { StyleSheet } from 'react-native';

export const onboardingChatStyles = StyleSheet.create({
  sheet: {
    position: 'relative',
    flexDirection: 'column',
    overflow: 'hidden',
    flex: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: -8 },
    elevation: 18,
  },
  topBar: {
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
    paddingVertical: 6,
  },
  iconBtn: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerProfileBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  freeBadge: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#e6bf3f',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    flexShrink: 0,
  },
  freeBadgeText: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '700',
  },
  menuBtn: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  menuDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  threadWrap: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 10,
    flexGrow: 1,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOne: {
    alignSelf: 'flex-start',
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#000000',
  },
  bubbleText: {
    fontSize: 16,
  },
  bubbleTextOne: {
    color: '#111111',
  },
  bubbleTextUser: {
    color: '#ffffff',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 6,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  composerWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 52,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
    minHeight: 40,
  },
});
