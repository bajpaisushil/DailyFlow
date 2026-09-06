package app.dailyflow.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Puts the alarms back after a reboot.
 *
 * Android clears the whole AlarmManager table when the phone restarts, and nothing else in
 * DailyFlow re-arms them until the app is next opened. A phone that reboots overnight — an OS
 * update, a flat battery, an OEM's nightly restart — therefore lost every alarm silently,
 * while the reminder still showed as set. Worst for the reminders that have NO other delivery
 * route: a notification-only reminder with the user's own sound has its OS notification
 * deliberately suppressed so it does not arrive twice, so AlarmManager is all it has.
 *
 * The re-arming itself is done by JavaScript (`boot()` -> `resyncAlarms()`), which is the one
 * place that knows what should be scheduled. This receiver's job is to make that run, by
 * starting the app's headless JS the same way any cold start would. Where that is not
 * possible, the next app open still repairs it — this shortens the window from "until you
 * happen to open DailyFlow" to "a few seconds after the phone finishes starting".
 */
class BootReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      Intent.ACTION_TIMEZONE_CHANGED,
      Intent.ACTION_TIME_CHANGED,
      "android.intent.action.QUICKBOOT_POWERON",
      -> Unit
      else -> return
    }

    rearm(context)
  }

  /**
   * Put every still-future alarm back into AlarmManager.
   *
   * Done entirely in Kotlin from the native mirror, because the app's own schedule lives in
   * SQLite behind the JS runtime and the whole point is to work before that runtime exists.
   * Alarms already in the past are dropped rather than fired: waking someone at 7am for a 6am
   * alarm they slept through is worse than staying quiet.
   */
  private fun rearm(context: Context) {
    val manager =
      context.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
    val now = System.currentTimeMillis()

    for (entry in AlarmStore.all(context)) {
      if (entry.at <= now) continue

      val intent = Intent(context, AlarmReceiver::class.java).apply {
        action = AlarmReceiver.ACTION_FIRE
        putExtra(AlarmService.EXTRA_TITLE, entry.title)
        putExtra(AlarmService.EXTRA_BODY, entry.body)
        putExtra(AlarmService.EXTRA_SOUND_URI, entry.soundUri)
        putExtra(AlarmService.EXTRA_DURATION_SECONDS, entry.durationSeconds)
        putExtra(AlarmService.EXTRA_VIBRATE, entry.vibrate)
        putExtra(AlarmService.EXTRA_STYLE, entry.style)
      }

      val pending = android.app.PendingIntent.getBroadcast(
        context,
        entry.id.hashCode(),
        intent,
        android.app.PendingIntent.FLAG_UPDATE_CURRENT or
          android.app.PendingIntent.FLAG_IMMUTABLE,
      )

      try {
        val exact = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
          manager.canScheduleExactAlarms()
        } else {
          true
        }
        if (exact) {
          manager.setAlarmClock(
            android.app.AlarmManager.AlarmClockInfo(entry.at, pending),
            pending,
          )
        } else {
          manager.setAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, entry.at, pending)
        }
      } catch (_: Exception) {
        // One alarm that will not re-arm must not stop the rest from being restored.
      }
    }
  }
}
