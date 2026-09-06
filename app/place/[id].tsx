import React, { useCallback, useMemo, useState } from 'react'
import { View, StyleSheet, TextInput, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Animated, { FadeIn } from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { DetailHeader } from '@/components/ui/DetailHeader'
import { Card } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import { PressableScale } from '@/components/ui/PressableScale'
import { Button } from '@/components/ui/Button'
import { IconPicker } from '@/components/ui/IconPicker'
import { useData } from '@/stores/data'
import { newId } from '@/lib/db/repo'
import { getCurrentFix, requestForeground, type Fix } from '@/lib/location/service'
import { describe as describeCoords, type FoundPlace } from '@/lib/location/search'
import { mapsAvailable } from '@/lib/location/maps'
import { MapPicker, type MapMarker } from '@/components/places/MapPicker'
import { PlaceSearch } from '@/components/places/PlaceSearch'
import { RADIUS_PRESETS, type Place, type RadiusPresetKey } from '@/lib/types'
import { metresForPreset, nearestPreset } from '@/lib/places'
import { space, radius as r, font } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'
import { S } from '@/lib/strings'

/**
 * Place editor.
 *
 * Deliberately map-free (REQUIREMENTS.md #49). A map needs tiles, tiles need the internet,
 * and this app has no network layer at all — but more importantly, "I am here now" is a far
 * easier idea than pinching a map to a pin, which is exactly what our audience needs.
 */

const NAME_SUGGESTIONS = ['Home', 'Work', 'School', 'Shop', 'Gym', 'Doctor', 'Station', "Mum's house"]

const RADIUS_CHOICES: Array<{ key: RadiusPresetKey; label: string; help: string }> = [
  { key: 'exact', label: S.place.closeExact, help: S.place.closeExactHelp },
  { key: 'building', label: S.place.closeBuilding, help: S.place.closeBuildingHelp },
  { key: 'street', label: S.place.closeStreet, help: S.place.closeStreetHelp },
  { key: 'area', label: S.place.closeArea, help: S.place.closeAreaHelp },
]

export default function PlaceEditor() {
  const { id, name: presetName } = useLocalSearchParams<{ id: string; name?: string }>()
  const router = useRouter()
  const c = useColors()

  const places = useData((s) => s.places)
  const savePlace = useData((s) => s.savePlace)
  const removePlace = useData((s) => s.removePlace)

  const isNew = id === 'new'
  const existing = useMemo(() => places.find((p) => p.id === id), [places, id])

  // The Home/Work slots pass a name in, so those two land pre-filled.
  const [name, setName] = useState(existing?.name ?? presetName ?? '')
  const [icon, setIcon] = useState<string>(
    existing?.icon ?? (presetName === 'Home' ? 'home' : presetName === 'Work' ? 'work' : 'place'),
  )
  const [fix, setFix] = useState<Fix | null>(
    existing ? { lat: existing.lat, lon: existing.lon, accuracyM: 0, at: existing.updatedAt } : null,
  )
  const [preset, setPreset] = useState<RadiusPresetKey>(
    existing ? nearestPreset(existing.radiusM) : 'building',
  )
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState(false)
  const [showMap, setShowMap] = useState(false)
  /** Every candidate from the last search, so the map can plot them all. */
  const [candidates, setCandidates] = useState<FoundPlace[]>([])
  const [chosen, setChosen] = useState<FoundPlace | null>(null)
  /** Address the OS reports for the chosen spot, shown so the user can confirm it is right. */
  const [addressLabel, setAddressLabel] = useState<string | null>(null)

  const canUseMap = mapsAvailable()

  /**
   * Every search candidate plus the current pin. Showing all of them is the point of the
   * map here: a geocoder often returns several places with the same name, and where they
   * are is the only thing that tells them apart.
   */
  const mapMarkers: MapMarker[] = useMemo(() => {
    const fromSearch = candidates.map((p) => ({
      lat: p.lat,
      lon: p.lon,
      title: p.label,
      selected: chosen?.lat === p.lat && chosen?.lon === p.lon,
    }))
    if (fromSearch.length > 0) return fromSearch
    return fix ? [{ lat: fix.lat, lon: fix.lon, selected: true }] : []
  }, [candidates, chosen, fix])

  /**
   * Whenever the pin moves, ask the OS what is there and offer it as the name. Most users
   * can then finish without typing anything at all.
   */
  const adoptCoords = useCallback(async (nextLat: number, nextLon: number, suggestName: boolean) => {
    setFix({ lat: nextLat, lon: nextLon, accuracyM: 0, at: Date.now() })
    const described = await describeCoords(nextLat, nextLon)
    setAddressLabel(described ? [described.label, described.detail].filter(Boolean).join(', ') : null)
    if (suggestName && described && !name.trim()) setName(described.label)
  }, [name])

  const [addressLabelForSave, setAddressLabelForSave] = useState(existing?.address)
  React.useEffect(() => { setAddressLabelForSave(addressLabel ?? existing?.address) }, [addressLabel, existing?.address])

  const capture = useCallback(async () => {
    setLocating(true)
    setLocationError(false)
    const permission = await requestForeground()
    if (permission !== 'granted') {
      setLocating(false)
      setLocationError(true)
      return
    }
    const next = await getCurrentFix(true)
    if (next) await adoptCoords(next.lat, next.lon, true)
    setLocationError(next == null)
    setLocating(false)
  }, [adoptCoords])

  const onDone = useCallback(() => {
    const trimmed = name.trim()
    if (!trimmed || !fix) return
    const now = Date.now()
    const doc: Place = {
      id: existing?.id ?? newId(),
      name: trimmed,
      icon,
      lat: fix.lat,
      lon: fix.lon,
      address: addressLabelForSave,
      radiusM: metresForPreset(preset),
      checklistIds: existing?.checklistIds ?? [],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    savePlace(doc)
    router.back()
  }, [name, icon, fix, preset, addressLabelForSave, existing, savePlace, router])

  return (
    <Screen>
      <DetailHeader
        title={isNew ? S.place.addOne : (existing?.name ?? S.nav.places)}
        onDone={onDone}
        disabled={!name.trim() || !fix}
      />

      {/* Where. Three ways in, because one size does not fit every situation:
          standing there (GPS, works offline), knowing the name (search), or
          recognising it on a map (needs a development build). */}
      <Text variant="heading" style={styles.section}>{S.place.whereAreYou}</Text>
      <Card style={{ marginBottom: space.xl }}>
        {fix ? (
          <Animated.View entering={FadeIn} style={styles.gotFix}>
            <Icon name="checkCircle" size={22} color={c.good} />
            <View style={{ flex: 1 }}>
              <Text variant="body" tone="good">{S.place.gotLocation}</Text>
              {addressLabel ? (
                <Text variant="caption" tone="muted" numberOfLines={2}>{addressLabel}</Text>
              ) : null}
            </View>
          </Animated.View>
        ) : (
          <Text variant="caption" tone="muted" style={{ marginBottom: space.md }}>
            Choose where this place is.
          </Text>
        )}

        {/* Typing the address comes first: most places you save are ones you are NOT
            standing in — the temple across town, the office before you start the job. */}
        <PlaceSearch
          selected={chosen}
          onResults={(found) => {
            setCandidates(found)
            // Show the map as soon as there is something to compare, so a list of
            // similar-sounding names can be told apart by where they actually are.
            if (found.length > 0) setShowMap(true)
          }}
          onChoose={(found) => {
            setChosen(found)
            void adoptCoords(found.lat, found.lon, true)
            setShowMap(true)
          }}
        />

        <Text variant="caption" tone="faint" center style={{ marginVertical: space.md }}>
          or
        </Text>

        <Button
          label={locating ? 'Finding you…' : S.place.hereNow}
          icon="target"
          variant={fix ? 'secondary' : 'primary'}
          size="lg"
          full
          onPress={capture}
          disabled={locating}
        />

        {locating ? (
          <ActivityIndicator color={c.accent} style={{ marginTop: space.md }} />
        ) : null}

        {locationError ? (
          <Text variant="caption" tone="bad" style={{ marginTop: space.md }}>
            {S.place.noLocation}
          </Text>
        ) : null}

        {canUseMap && fix ? (
          <Button
            label={showMap ? 'Hide map' : 'Show on map'}
            icon="map"
            variant="quiet"
            full
            style={{ marginTop: space.sm }}
            onPress={() => setShowMap((v) => !v)}
          />
        ) : null}
      </Card>

      {/* The map fine-tunes a spot that GPS or search already found. */}
      {canUseMap && showMap && fix ? (
        <MapPicker
          lat={fix.lat}
          lon={fix.lon}
          markers={mapMarkers}
          hint={
            candidates.length > 1
              ? 'Tap a pin, or tap the map to move it'
              : 'Tap the map to move the pin'
          }
          onPick={(nextLat, nextLon) => void adoptCoords(nextLat, nextLon, false)}
        />
      ) : null}

      {/* How close — named options with help text, never metres */}
      <Text variant="heading" style={styles.section}>{S.place.howClose}</Text>
      <View style={{ gap: space.sm, marginBottom: space.xl }}>
        {RADIUS_CHOICES.map((choice) => {
          const active = preset === choice.key
          return (
            <PressableScale
              key={choice.key}
              onPress={() => setPreset(choice.key)}
              depth="sm"
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${choice.label}. ${choice.help}`}
            >
              <Card
                tone={active ? 'raised' : 'flat'}
                level={active ? 2 : 0}
                style={[styles.choice, active && { backgroundColor: c.accentSoft }]}
              >
                <View
                  style={[
                    styles.ring,
                    {
                      borderColor: active ? c.accent : c.lineStrong,
                      width: 22 + RADIUS_PRESETS.findIndex((p) => p.key === choice.key) * 9,
                      height: 22 + RADIUS_PRESETS.findIndex((p) => p.key === choice.key) * 9,
                    },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text variant="heading" style={{ color: active ? c.accent : c.ink }}>
                    {choice.label}
                  </Text>
                  <Text variant="caption" tone="muted">{choice.help}</Text>
                </View>
                {active ? <Icon name="checkCircle" size={22} color={c.accent} /> : null}
              </Card>
            </PressableScale>
          )
        })}
      </View>

      {/* Name — suggestions first, typing as a fallback */}
      <Text variant="heading" style={styles.section}>{S.place.nameIt}</Text>
      <View style={styles.chips}>
        {NAME_SUGGESTIONS.map((suggestion) => (
          <PressableScale
            key={suggestion}
            onPress={() => setName(suggestion)}
            depth="sm"
            style={[
              styles.chip,
              { backgroundColor: name === suggestion ? c.accentSoft : c.surfaceAlt },
            ]}
            accessibilityRole="button"
            accessibilityLabel={suggestion}
          >
            <Text variant="label" style={{ color: name === suggestion ? c.accent : c.inkMuted }}>
              {suggestion}
            </Text>
          </PressableScale>
        ))}
      </View>

      <Card tone="flat" padded={false} style={{ marginBottom: space.xl }}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Home"
          placeholderTextColor={c.inkFaint}
          style={[styles.input, { color: c.ink }]}
          accessibilityLabel={S.place.nameIt}
          returnKeyType="done"
        />
      </Card>

      {/* Picture */}
      <Text variant="heading" style={styles.section}>Picture</Text>
      <IconPicker value={icon} onChange={(i) => setIcon(i)} set="place" />

      {!isNew && existing ? (
        <Button
          label={S.action.remove}
          icon="trash"
          variant="danger"
          full
          style={{ marginTop: space['3xl'] }}
          onPress={() => {
            removePlace(existing.id)
            router.back()
          }}
        />
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  section: { marginBottom: space.sm },
  gotFix: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg },
  choice: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  ring: { borderWidth: 2.5, borderRadius: 999 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  chip: {
    paddingHorizontal: space.xl, minHeight: 48, borderRadius: r.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  input: { fontSize: font.base, paddingHorizontal: space.lg, paddingVertical: space.lg, minHeight: 52 },
})
