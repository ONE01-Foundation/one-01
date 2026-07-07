/**
 * IdentitySwitchSheet — agent identities, redesigned 6/24 to match user
 * mockup.
 *
 * Each identity is rendered as a row with a round avatar that has a small
 * green count badge in the bottom-right. Name with a tiny blue verified
 * checkmark, type label below. Bottom CTA: "+ New ONE" pill.
 *
 * No "Your Identities" title — the sheet's purpose is implied by the
 * surrounding action.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useThemeStore } from '../../stores/themeStore';
import { useT } from '../../i18n/useT';
import { useMvpStore } from '../../stores/mvpStore';
import type { Identity, IdentityType } from '../../core/mvp/types';
import { BottomSheet } from '../../components/mvp/BottomSheet';
import { PlusIcon } from '../../components/mvp/icons';

interface IdentitySwitchSheetProps {
  visible: boolean;
  onClose: () => void;
  onAddIdentity?: () => void;
}

const SNAP_POINTS = ['52%', '88%'];

export function IdentitySwitchSheet({
  visible,
  onClose,
  onAddIdentity,
}: IdentitySwitchSheetProps) {
  const { colors } = useThemeStore();
  const t = useT();
  const identities = useMvpStore((s) => s.identities);
  const activeIdentityId = useMvpStore((s) => s.activeIdentityId);
  const setActiveIdentity = useMvpStore((s) => s.setActiveIdentity);
  const units = useMvpStore((s) => s.units);

  const roleLabel = (type: IdentityType) =>
    type === 'business'
      ? t('identity_role_business')
      : type === 'family'
        ? t('identity_role_family')
        : t('identity_role_personal');

  // Per-identity unread badge — derived live from units.
  const badgeByIdentity = useMemo(() => {
    const map: Record<string, number> = {};
    for (const u of units) {
      map[u.identityId] = (map[u.identityId] ?? 0) + (u.unreadUpdates ?? 0);
    }
    return map;
  }, [units]);

  const handlePick = (id: string) => {
    setActiveIdentity(id);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={SNAP_POINTS}
      sheetStyle={styles.sheet}
    >
      {identities.length > 1 && (
        <Text style={[styles.framing, { color: colors.textSecondary }]}>
          {t('identity_role_personal') === 'אישי'
            ? 'הזהויות שלך חיות תחת ONE אחד. עבור בכל רגע — הן חולקות את אותו זיכרון עליך.'
            : 'Your identities live under one ONE. Switch any time — they share the same memory of you.'}
        </Text>
      )}

      <View style={styles.list}>
        {identities.map((identity) => (
          <IdentityRow
            key={identity.id}
            identity={identity}
            active={identity.id === activeIdentityId}
            badge={badgeByIdentity[identity.id] ?? 0}
            roleLabel={roleLabel(identity.type)}
            onPress={() => handlePick(identity.id)}
            colors={colors}
          />
        ))}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.addBtn,
          {
            backgroundColor: colors.text,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        onPress={onAddIdentity}
        accessibilityRole="button"
        accessibilityLabel={t('identity_new_one')}
      >
        <PlusIcon size={18} color={colors.background} />
        <Text style={[styles.addBtnText, { color: colors.background }]}>
          {t('identity_new_one')}
        </Text>
      </Pressable>
    </BottomSheet>
  );
}

function IdentityRow({
  identity,
  active,
  badge,
  roleLabel,
  onPress,
  colors,
}: {
  identity: Identity;
  active: boolean;
  badge: number;
  /** Localised "Personal" / "Business" / "Family" / "אישי" etc. */
  roleLabel: string;
  onPress: () => void;
  colors: ReturnType<typeof useThemeStore>['colors'];
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={identity.name}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: active ? '#10B981' : colors.border,
          borderWidth: active ? StyleSheet.hairlineWidth * 2 : StyleSheet.hairlineWidth,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.avatarWrap}>
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.avatarText, { color: colors.text }]}>
            {identity.initials ?? identity.name.slice(0, 1)}
          </Text>
        </View>
        {badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>

      <View style={styles.rowText}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]}>
            {identity.name}
          </Text>
          <View style={styles.verified}>
            <Text style={styles.verifiedGlyph}>✓</Text>
          </View>
        </View>
        <Text style={[styles.role, { color: colors.textSecondary }]}>
          {roleLabel}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 8,
    // Tightened: the "+ New ONE" pill now sits closer to the sheet's
    // bottom edge per latest design pass. SafeAreaView at the sheet root
    // already provides the home-indicator clearance, so we don't need a
    // big bottom inset here.
    paddingBottom: 16,
  },
  framing: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 12,
    marginBottom: 16,
    opacity: 0.85,
  },
  list: {
    gap: 12,
    marginBottom: 22,
  },

  // Card-styled row.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
  },
  verified: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedGlyph: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 12,
  },
  role: {
    fontSize: 13,
  },

  // Solid CTA: "+ New ONE" pill.
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: 28,
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
