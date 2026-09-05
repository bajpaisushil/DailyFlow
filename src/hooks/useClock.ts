import { useEffect, useState } from 'react'
import { AppState } from 'react-native'

/**
 * A clock that ticks once per minute and re-syncs whenever the app comes back to the
 * foreground. It deliberately aligns to the top of each minute rather than polling on an
 * interval from mount, so the displayed time never lags behind the phone's own clock.
 */
export function useClock(): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const schedule = () => {
      const msToNextMinute = 60_000 - (Date.now() % 60_000)
      timer = setTimeout(() => {
        setNow(new Date())
        schedule()
      }, msToNextMinute + 50)
    }
    schedule()

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(new Date())
    })

    return () => {
      clearTimeout(timer)
      sub.remove()
    }
  }, [])

  return now
}
