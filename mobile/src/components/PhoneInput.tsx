import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { radius, spacing, typography } from '@/theme';
import { COUNTRIES, PRIORITY_CODES, DEFAULT_COUNTRY, Country } from '@/utils/phoneCountries';
import {
  parsePhoneE164,
  normalizeLocalNumber,
  buildE164,
} from '@/utils/phoneUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PhoneInputProps {
  /** Field label */
  label: string;
  /** Full E.164 value (controlled). Pass empty string for blank. */
  value: string;
  /** Fires with full E.164 on every change */
  onChange: (e164: string) => void;
  /** Validation error message */
  error?: string | null;
  /** Hint shown when field is empty and not in error */
  hint?: string;
  /** Container style override */
  containerStyle?: ViewStyle;
  /** Called when the input is blurred */
  onBlur?: () => void;
}

// ─── Separator for FlatList sections ─────────────────────────────────────────

interface ListItem {
  type: 'section' | 'country' | 'divider';
  country?: Country;
  label?: string;
  id: string;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PhoneInput({
  label,
  value,
  onChange,
  error,
  hint,
  containerStyle,
  onBlur,
}: PhoneInputProps) {
  const { colors } = useTheme();

  // ── Internal state ──────────────────────────────────────────────────────────
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [localNumber, setLocalNumber] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const phoneInputRef = useRef<TextInput>(null);

  // ── Sync incoming value prop → internal state ────────────────────────────────
  useEffect(() => {
    if (!value) {
      setLocalNumber('');
      return;
    }
    const { country, localNumber: local } = parsePhoneE164(value);
    setSelectedCountry(country);
    setLocalNumber(local);
  }, [value]);

  // ── Filtered country list ────────────────────────────────────────────────────
  const q = searchQuery.toLowerCase().trim();
  const filtered = q
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.dialCode.includes(q) ||
          c.code.toLowerCase().includes(q)
      )
    : COUNTRIES;

  // Build FlatList data with section headers
  const listData: ListItem[] = q
    ? filtered.map((c) => ({ type: 'country', country: c, id: c.code }))
    : [
        { type: 'section', label: 'Popular', id: '__section_popular' },
        ...COUNTRIES.filter((c) => PRIORITY_CODES.includes(c.code)).map(
          (c): ListItem => ({ type: 'country', country: c, id: c.code })
        ),
        { type: 'divider', id: '__divider' },
        { type: 'section', label: 'All Countries', id: '__section_all' },
        ...COUNTRIES.filter((c) => !PRIORITY_CODES.includes(c.code)).map(
          (c): ListItem => ({ type: 'country', country: c, id: c.code })
        ),
      ];

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleCountrySelect = useCallback(
    (country: Country) => {
      setSelectedCountry(country);
      setModalVisible(false);
      setSearchQuery('');
      const e164 = buildE164(country.dialCode, localNumber);
      onChange(e164);
      // Re-focus phone input after modal closes
      setTimeout(() => phoneInputRef.current?.focus(), 300);
    },
    [localNumber, onChange]
  );

  const handleLocalChange = useCallback(
    (raw: string) => {
      // Only allow digits and spaces while typing
      const cleaned = raw.replace(/[^\d\s]/g, '');
      setLocalNumber(cleaned);
      const e164 = buildE164(selectedCountry.dialCode, cleaned);
      onChange(e164);
    },
    [selectedCountry, onChange]
  );

  const handleLocalBlur = useCallback(() => {
    setFocused(false);
    onBlur?.();
    // Normalise on blur: strip accidental prefixes
    const normalised = normalizeLocalNumber(localNumber, selectedCountry.dialCode);
    if (normalised !== localNumber.replace(/\D/g, '')) {
      setLocalNumber(normalised);
      const e164 = buildE164(selectedCountry.dialCode, normalised);
      onChange(e164);
    }
  }, [localNumber, selectedCountry, onChange, onBlur]);

  const openModal = () => {
    Keyboard.dismiss();
    setModalVisible(true);
  };

  // ── Derived style values ──────────────────────────────────────────────────
  const hasValue = !!localNumber;
  const showError = !!error;
  const showSuccess = hasValue && !error;
  const showHint = !error && !!hint && !hasValue;

  const borderColor = showError
    ? colors.error
    : showSuccess
    ? colors.success
    : focused
    ? colors.primary
    : colors.border;

  const backgroundColor = showError ? colors.errorSoft : colors.surface;

  // ── Country row renderer ──────────────────────────────────────────────────
  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'section') {
      return (
        <Text style={[styles.sectionHeader, { color: colors.inkFaint }]}>{item.label}</Text>
      );
    }
    if (item.type === 'divider') {
      return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
    }
    const country = item.country!;
    const isSelected = country.code === selectedCountry.code;
    return (
      <TouchableOpacity
        style={[
          styles.countryRow,
          isSelected && { backgroundColor: colors.primarySoft },
        ]}
        onPress={() => handleCountrySelect(country)}
        activeOpacity={0.65}
      >
        <Text style={styles.countryFlag}>{country.flag}</Text>
        <Text
          style={[
            styles.countryName,
            { color: isSelected ? colors.primary : colors.ink },
            isSelected && { fontWeight: '700' },
          ]}
          numberOfLines={1}
        >
          {country.name}
        </Text>
        <Text style={[styles.countryCode, { color: colors.inkFaint }]}>{country.dialCode}</Text>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Field label */}
      <Text style={[styles.label, { color: colors.inkSoft }]}>{label}</Text>

      {/* Input row */}
      <View
        style={[
          styles.inputRow,
          { borderColor, backgroundColor },
          focused && !showError && styles.focusedRow,
        ]}
      >
        {/* Country selector button */}
        <Pressable
          style={styles.countryBtn}
          onPress={openModal}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={`Country: ${selectedCountry.name}, dial code ${selectedCountry.dialCode}. Tap to change.`}
        >
          <Text style={styles.flagText}>{selectedCountry.flag}</Text>
          <Text style={[styles.dialCode, { color: colors.inkSoft }]}>
            {selectedCountry.dialCode}
          </Text>
          <Ionicons
            name="chevron-down"
            size={13}
            color={colors.inkFaint}
            style={styles.chevron}
          />
        </Pressable>

        {/* Vertical divider */}
        <View style={[styles.separator, { backgroundColor: colors.border }]} />

        {/* Phone number input */}
        <TextInput
          ref={phoneInputRef}
          style={[styles.phoneInput, { color: colors.ink }]}
          value={localNumber}
          onChangeText={handleLocalChange}
          onFocus={() => setFocused(true)}
          onBlur={handleLocalBlur}
          placeholder="77 123 4567"
          placeholderTextColor={colors.inkFaint}
          keyboardType="number-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          returnKeyType="done"
          maxLength={15}
          accessible
          accessibilityLabel={`${label} number input`}
          accessibilityHint={`Enter local phone number without country code. ${selectedCountry.dialCode} is already selected.`}
        />

        {/* Inline state icon */}
        {showSuccess && (
          <Ionicons
            name="checkmark-circle"
            size={20}
            color={colors.success}
            style={styles.stateIcon}
          />
        )}
        {showError && (
          <Ionicons
            name="alert-circle"
            size={20}
            color={colors.error}
            style={styles.stateIcon}
          />
        )}
      </View>

      {/* Error / hint text */}
      {showError && (
        <View style={styles.messageRow}>
          <Ionicons name="alert-circle" size={13} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      )}
      {showHint && (
        <Text style={[styles.hintText, { color: colors.inkFaint }]}>{hint}</Text>
      )}

      {/* ── Country Picker Modal (bottom-sheet style) ─────────────────────── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setModalVisible(false);
          setSearchQuery('');
        }}
        statusBarTranslucent
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setModalVisible(false);
            setSearchQuery('');
          }}
        >
          {/* Prevent tap-through to overlay when pressing inside the sheet */}
          <Pressable
            style={[styles.modalSheet, { backgroundColor: colors.surface }]}
            onPress={() => {}}
          >
            {/* Handle bar */}
            <View style={[styles.handleBar, { backgroundColor: colors.border }]} />

            {/* Modal header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.ink }]}>Select Country</Text>
              <Pressable
                onPress={() => {
                  setModalVisible(false);
                  setSearchQuery('');
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close country picker"
              >
                <Ionicons name="close-circle" size={26} color={colors.inkFaint} />
              </Pressable>
            </View>

            {/* Search box */}
            <View
              style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Ionicons name="search" size={16} color={colors.inkFaint} />
              <TextInput
                style={[styles.searchInput, { color: colors.ink }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search country or dial code…"
                placeholderTextColor={colors.inkFaint}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>

            {/* Country list */}
            <FlatList
              data={listData}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              initialNumToRender={20}
              maxToRenderPerBatch={30}
              windowSize={10}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.inkFaint }]}>
                  No countries found
                </Text>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },

  // Input row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  focusedRow: {
    // Handled by borderColor prop — just declaring for clarity
  },

  // Country button
  countryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    gap: 4,
    minWidth: 90,
  },
  flagText: {
    fontSize: 22,
    lineHeight: 28,
  },
  dialCode: {
    fontSize: 14,
    fontWeight: '700',
  },
  chevron: {
    marginLeft: 1,
  },

  // Separator
  separator: {
    width: 1.5,
    alignSelf: 'stretch',
    marginVertical: 8,
  },

  // Phone number input
  phoneInput: {
    flex: 1,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: undefined,
  },

  // State icon
  stateIcon: {
    marginRight: spacing.sm,
  },

  // Error / hint
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  errorText: {
    ...typography.label,
    flex: 1,
  },
  hintText: {
    ...typography.label,
    marginTop: 4,
  },

  // ── Modal ───────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: Platform.OS === 'ios' ? 36 : spacing.lg,
    maxHeight: '82%',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },

  // Section headers
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: 2,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Divider between sections
  divider: {
    height: 1,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
  },

  // Country row
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
  },
  countryFlag: {
    fontSize: 22,
    lineHeight: 28,
    width: 32,
  },
  countryName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  countryCode: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // Empty state
  emptyText: {
    textAlign: 'center',
    padding: spacing.lg,
    ...typography.caption,
  },
});
